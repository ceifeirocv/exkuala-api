import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEntity, EventStatus } from './event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventResponseDto } from './dto/event-response.dto';
import { PaginatedEventsResponseDto } from './dto/paginated-events-response.dto';
import { EventPaginationQueryDto } from './dto/event-pagination-query.dto';
import { EventTranslationEntity } from './event-translation.entity';
import { PublicEventsQueryDto } from './dto/public-events-query.dto';
import { PaginatedPublicEventsResponseDto } from './dto/paginated-public-events-response.dto';
import { PublicEventListItemDto } from './dto/public-event-list-item.dto';
import { PublicEventDetailDto } from './dto/public-event-detail.dto';
import { UpsertEventTranslationDto } from './dto/upsert-event-translation.dto';
import { RsvpService } from '../rsvp/rsvp.service';
import { RsvpState } from '../rsvp/rsvp.entity';

// Required fields for publishing an event per D-10.
const PUBLISH_REQUIRED_FIELDS: (keyof EventEntity)[] = [
  'title',
  'description',
  'startAt',
  'venueName',
  'address',
  'categoryId',
];

// State machine: DRAFT→PUBLISHED, PUBLISHED→CANCELLED, CANCELLED is terminal.
const ALLOWED_TRANSITIONS: Partial<Record<EventStatus, EventStatus[]>> = {
  [EventStatus.DRAFT]: [EventStatus.PUBLISHED],
  [EventStatus.PUBLISHED]: [EventStatus.CANCELLED],
};

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectRepository(EventTranslationEntity)
    private readonly translationRepository: Repository<EventTranslationEntity>,
    // Phase 8 (RSVP-03): injected to call countByEventAndState() in findPublishedById()
    private readonly rsvpService: RsvpService,
  ) {}

  // create() — always sets status=DRAFT and organizerId from caller (never body) per T-06-04-01.
  // Converts dto.startAt string to Date before saving.
  async create(organizerId: string, dto: CreateEventDto): Promise<EventResponseDto> {
    const entity = this.eventRepository.create({
      ...dto,
      startAt: new Date(dto.startAt),
      endAt: dto.endAt ? new Date(dto.endAt) : null,
      organizerId,
      status: EventStatus.DRAFT,
    });
    const saved = await this.eventRepository.save(entity);
    return this.toResponseDto(saved);
  }

  // findOwned() — cursor pagination on (startAt, id) row-value comparison (D-17, D-18, D-19, D-20).
  // Fetches effectiveLimit+1 rows to detect hasMore without a COUNT query.
  async findOwned(organizerId: string, query: EventPaginationQueryDto): Promise<PaginatedEventsResponseDto> {
    const effectiveLimit = Math.min(query.limit ?? 20, 100);
    const qb = this.eventRepository
      .createQueryBuilder('event')
      .where('event."organizerId" = :organizerId', { organizerId })
      .orderBy('event.startAt', 'ASC')
      .addOrderBy('event.id', 'ASC')
      .take(effectiveLimit + 1);

    if (query.status) {
      qb.andWhere('event."status" = :status', { status: query.status });
    }

    if (query.cursor) {
      const { cursorStartAt, cursorId } = EventsService.decodeCursor(query.cursor);
      qb.andWhere(
        '(event."startAt", event."id") > (:cursorStartAt::timestamptz, :cursorId)',
        { cursorStartAt, cursorId },
      );
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > effectiveLimit;
    const data = hasMore ? rows.slice(0, effectiveLimit) : rows;
    const lastItem = data[data.length - 1];
    const nextCursor = hasMore && lastItem
      ? EventsService.encodeCursor(lastItem.startAt, lastItem.id)
      : null;

    return { data: data.map((e) => this.toResponseDto(e)), nextCursor, hasMore };
  }

  // findOwnedById() — 404 for non-owned events (D-21, T-06-04-06) — no 403 leakage.
  async findOwnedById(organizerId: string, eventId: string): Promise<EventResponseDto> {
    const event = await this.findOwnedOrThrow(eventId, organizerId);
    return this.toResponseDto(event);
  }

  // update() — ownership, frozen-cancelled guard, state machine, publish gate, then save (D-05, D-07, D-10).
  // assertPublishGate runs after field updates so required fields set in the same request are evaluated.
  async update(organizerId: string, eventId: string, dto: UpdateEventDto): Promise<EventResponseDto> {
    const event = await this.findOwnedOrThrow(eventId, organizerId);

    if (event.status === EventStatus.CANCELLED) {
      throw new ConflictException(
        `Event '${eventId}' is cancelled — cancelled events cannot be modified`,
      );
    }

    if (dto.status) {
      this.assertTransitionAllowed(event.status, dto.status);
    }

    this.applyFieldUpdates(event, dto);

    if (dto.status === EventStatus.PUBLISHED) {
      this.assertPublishGate(event);
      event.status = EventStatus.PUBLISHED;
    } else if (dto.status) {
      event.status = dto.status;
    }

    const saved = await this.eventRepository.save(event);
    return this.toResponseDto(saved);
  }

  // softDeleteDraft() — draft-only enforcement before soft-delete (D-15, T-06-04-05).
  async softDeleteDraft(organizerId: string, eventId: string): Promise<void> {
    const event = await this.findOwnedOrThrow(eventId, organizerId);

    if (event.status !== EventStatus.DRAFT) {
      throw new ConflictException(
        `Event '${eventId}' is ${event.status} — only DRAFT events can be deleted`,
      );
    }

    await this.eventRepository.softDelete(eventId);
  }

  // findPublished() — cursor-paginated public listing for unauthenticated clients.
  // Applies status=PUBLISHED filter, joins organizer+category+translations.
  // Filters: category slug (DISC-01), date range (DISC-02), city prefix (DISC-03),
  // full-text search (DISC-04), cursor (EVT-06). D-13 canonical pagination shape.
  async findPublished(query: PublicEventsQueryDto): Promise<PaginatedPublicEventsResponseDto> {
    const effectiveLimit = Math.min(query.limit ?? 20, 100);
    const qb = this.eventRepository
      .createQueryBuilder('event')
      .where('event."status" = :status', { status: EventStatus.PUBLISHED })
      .leftJoinAndSelect('event.organizer', 'organizer')
      .leftJoinAndSelect('event.category', 'category')
      .leftJoinAndSelect('category.translations', 'categoryTranslation')
      .leftJoinAndSelect('event.translations', 'translation')
      .orderBy('event.startAt', 'ASC')
      .addOrderBy('event.id', 'ASC')
      .take(effectiveLimit + 1);

    if (query.category) {
      qb.andWhere('category."slug" = :slug', { slug: query.category });
    }
    if (query.start) {
      qb.andWhere('event."startAt" >= :start', { start: query.start });
    }
    if (query.end) {
      qb.andWhere('event."startAt" <= :end', { end: query.end });
    }
    if (query.city) {
      // D-09: case-insensitive LIKE prefix — allows 'Pra' to match 'Praia'
      qb.andWhere("LOWER(event.\"city\") LIKE LOWER(:city) || '%'", { city: query.city });
    }
    if (query.q) {
      // D-07: plainto_tsquery handles multi-word phrases without requiring tsquery syntax knowledge
      qb.andWhere("event.search_vector @@ plainto_tsquery('simple', :q)", { q: query.q });
    }
    if (query.cursor) {
      const { cursorStartAt, cursorId } = EventsService.decodeCursor(query.cursor);
      qb.andWhere(
        '(event."startAt", event."id") > (:cursorStartAt::timestamptz, :cursorId)',
        { cursorStartAt, cursorId },
      );
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > effectiveLimit;
    const data = hasMore ? rows.slice(0, effectiveLimit) : rows;
    const lastItem = data[data.length - 1];
    const nextCursor =
      hasMore && lastItem
        ? EventsService.encodeCursor(lastItem.startAt, lastItem.id)
        : null;

    return {
      data: data.map((e) => this.toPublicListItemDto(e)),
      nextCursor,
      hasMore,
    };
  }

  // findPublishedById() — public event detail with live RSVP counts (RSVP-03, D-07).
  // Promise.all() runs the three async ops in parallel to avoid serial round-trips.
  async findPublishedById(id: string): Promise<PublicEventDetailDto> {
    const [event, interestedCount, goingCount] = await Promise.all([
      this.findPublishedOrThrow(id),
      this.rsvpService.countByEventAndState(id, RsvpState.INTERESTED),
      this.rsvpService.countByEventAndState(id, RsvpState.GOING),
    ]);
    return this.toPublicDetailDto(event, interestedCount, goingCount);
  }

  // upsertTranslation() — organizer adds/updates a per-locale translation (D-03, I18N-01).
  // Ownership check via findOwnedOrThrow — returns 404 (not 403) for non-owned events.
  async upsertTranslation(
    organizerId: string,
    eventId: string,
    locale: string,
    dto: UpsertEventTranslationDto,
  ): Promise<{ locale: string; title: string; description: string | null }> {
    await this.findOwnedOrThrow(eventId, organizerId);
    await this.translationRepository.upsert(
      { eventId, locale, title: dto.title, description: dto.description ?? null },
      { conflictPaths: ['eventId', 'locale'], skipUpdateIfNoValuesChanged: true },
    );
    const saved = await this.translationRepository.findOneOrFail({
      where: { eventId, locale },
    });
    return { locale: saved.locale, title: saved.title, description: saved.description };
  }

  // toResponseDto() — manual mapping; deletedAt is intentionally excluded.
  toResponseDto(event: EventEntity): EventResponseDto {
    return {
      id: event.id,
      organizerId: event.organizerId,
      categoryId: event.categoryId,
      title: event.title,
      description: event.description,
      startAt: event.startAt,
      endAt: event.endAt,
      venueName: event.venueName,
      address: event.address,
      ticketPrice: event.ticketPrice,
      externalTicketUrl: event.externalTicketUrl,
      status: event.status,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }

  // findPublishedOrThrow() — 404 for non-published or non-existent events (EVT-04).
  // No 403 — caller cannot distinguish unpublished from non-existent (no info leakage).
  private async findPublishedOrThrow(eventId: string): Promise<EventEntity> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId, status: EventStatus.PUBLISHED },
      relations: ['organizer', 'category', 'category.translations', 'translations'],
    });
    if (!event) {
      throw new NotFoundException(`Event with id '${eventId}' not found`);
    }
    return event;
  }

  // buildTranslationsMap() — reduce translations array to { locale: { title, description } }.
  // Client picks preferred locale (D-01 — client-side locale resolution).
  private buildTranslationsMap(
    translations: EventTranslationEntity[],
  ): Record<string, { title: string; description: string | null }> {
    return Object.fromEntries(
      translations.map((t) => [t.locale, { title: t.title, description: t.description }]),
    );
  }

  // toPublicListItemDto() — maps EventEntity to PublicEventListItemDto.
  // Excludes: ticketPrice, externalTicketUrl (D-12), deletedAt, organizerId scalar.
  private toPublicListItemDto(event: EventEntity): PublicEventListItemDto {
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      startAt: event.startAt,
      endAt: event.endAt,
      venueName: event.venueName,
      address: event.address,
      city: event.city ?? null,
      imageUrl: event.imageUrl ?? null,
      status: event.status,
      category: event.category
        ? { id: event.category.id, slug: event.category.slug, name: event.category.name }
        : null,
      organizer: { id: event.organizer!.id, name: event.organizer!.name },
      translations: this.buildTranslationsMap(event.translations ?? []),
      createdAt: event.createdAt,
    };
  }

  // toPublicDetailDto() — extends list item with ticket info, full organizer/category, and RSVP counts (D-11).
  // interestedCount and goingCount default to 0 for callers that haven't injected RsvpService yet.
  private toPublicDetailDto(
    event: EventEntity,
    interestedCount = 0,
    goingCount = 0,
  ): PublicEventDetailDto {
    const base = this.toPublicListItemDto(event);
    const categoryTranslations: Record<string, string> = event.category
      ? Object.fromEntries(
          (event.category.translations ?? []).map((t) => [t.locale, t.name]),
        )
      : {};
    return {
      ...base,
      ticketPrice: event.ticketPrice ?? null,
      externalTicketUrl: event.externalTicketUrl ?? null,
      // OrganizerEntity has no bio/contact fields in v1 (D-11 aspirational shape);
      // map available fields and null-fill the rest until entity is extended.
      organizer: {
        id: event.organizer!.id,
        name: event.organizer!.name,
        bio: null,
        contact: null,
      },
      category: event.category
        ? {
            id: event.category.id,
            slug: event.category.slug,
            name: event.category.name,
            translations: categoryTranslations,
          }
        : null,
      // Phase 8 (RSVP-03): live counts from countByEventAndState() (D-07, D-08)
      interestedCount,
      goingCount,
    } as PublicEventDetailDto;
  }

  // findOwnedOrThrow() — compound WHERE (id, organizerId) per D-21, T-06-04-02.
  // Returns 404 (not 403) — caller cannot distinguish owned vs. non-existent.
  private async findOwnedOrThrow(eventId: string, organizerId: string): Promise<EventEntity> {
    const event = await this.eventRepository.findOne({ where: { id: eventId, organizerId } });
    if (!event) {
      throw new NotFoundException(`Event with id '${eventId}' not found`);
    }
    return event;
  }

  // assertTransitionAllowed() — validates against ALLOWED_TRANSITIONS before any DB write (T-06-04-03).
  private assertTransitionAllowed(current: EventStatus, target: EventStatus): void {
    if (!ALLOWED_TRANSITIONS[current]?.includes(target)) {
      throw new ConflictException(
        `Event is already ${current} — transition to ${target} is not allowed`,
      );
    }
  }

  // assertPublishGate() — checks required fields non-null and startAt in the future (D-06, D-10, T-06-04-04).
  private assertPublishGate(event: EventEntity): void {
    const missing = PUBLISH_REQUIRED_FIELDS.filter((f) => event[f] == null);
    if (missing.length > 0) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        message: 'Cannot publish: missing required fields',
        missing,
      });
    }
    if (event.startAt <= new Date()) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        message: 'Cannot publish: event date has passed',
        missing: [],
      });
    }
  }

  // applyFieldUpdates() — copies DTO fields onto entity; string dates coerced to Date.
  private applyFieldUpdates(event: EventEntity, dto: UpdateEventDto): void {
    if (dto.title !== undefined) event.title = dto.title;
    if (dto.description !== undefined) event.description = dto.description ?? null;
    if (dto.startAt !== undefined) event.startAt = new Date(dto.startAt);
    if (dto.endAt !== undefined) event.endAt = dto.endAt ? new Date(dto.endAt) : null;
    if (dto.venueName !== undefined) event.venueName = dto.venueName ?? null;
    if (dto.address !== undefined) event.address = dto.address ?? null;
    if (dto.ticketPrice !== undefined) event.ticketPrice = dto.ticketPrice ?? null;
    if (dto.externalTicketUrl !== undefined) event.externalTicketUrl = dto.externalTicketUrl ?? null;
    if (dto.categoryId !== undefined) event.categoryId = dto.categoryId;
  }

  // encodeCursor() — base64url-encodes (startAt ISO string, id) for opaque pagination tokens.
  private static encodeCursor(startAt: Date, id: string): string {
    return Buffer.from(`${startAt.toISOString()}__${id}`).toString('base64url');
  }

  // decodeCursor() — decodes base64url cursor back to (cursorStartAt, cursorId).
  private static decodeCursor(cursor: string): { cursorStartAt: string; cursorId: string } {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const [cursorStartAt, cursorId] = raw.split('__');
    return { cursorStartAt, cursorId };
  }
}

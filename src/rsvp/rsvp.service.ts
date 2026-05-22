import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createId } from '@paralleldrive/cuid2';
import { RsvpEntity, RsvpState } from './rsvp.entity';
import { EventEntity, EventStatus } from '../events/event.entity';
import { CreateRsvpDto } from './dto/create-rsvp.dto';
import { RsvpResponseDto } from './dto/rsvp-response.dto';
import { RsvpHistoryItemDto } from './dto/rsvp-history-item.dto';
import { PaginatedRsvpHistoryDto } from './dto/paginated-rsvp-history.dto';
import { RsvpHistoryQueryDto } from './dto/rsvp-history-query.dto';

@Injectable()
export class RsvpService {
  private readonly logger = new Logger(RsvpService.name);

  constructor(
    @InjectRepository(RsvpEntity)
    private readonly rsvpRepository: Repository<RsvpEntity>,
    // EventEntity injection needed for the PUBLISHED guard in upsertRsvp() (T-08-04)
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
  ) {}

  // upsertRsvp() — insert-or-update RSVP row.
  // Uses createQueryBuilder().insert().orUpdate() (NOT repository.upsert()) so that
  // rsvpedAt is NOT overwritten on conflict — preserves original RSVP timestamp (RESEARCH.md pitfall).
  // T-08-01: userId sourced from JWT via caller (@CurrentUser()), never from request body.
  // T-08-04: event existence + PUBLISHED status checked before any DB write.
  async upsertRsvp(
    userId: string,
    eventId: string,
    dto: CreateRsvpDto,
  ): Promise<RsvpResponseDto> {
    const event = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException(`Event with id '${eventId}' not found`);
    }
    if (event.status !== EventStatus.PUBLISHED) {
      throw new UnprocessableEntityException('Event is not published');
    }

    await this.rsvpRepository
      .createQueryBuilder()
      .insert()
      .into(RsvpEntity)
      // id must be set explicitly — @BeforeInsert() does not fire on createQueryBuilder().insert()
      .values({ id: createId(), userId, eventId, state: dto.state })
      // orUpdate: on (userId, eventId) conflict, update only state + updatedAt.
      // rsvpedAt, id, createdAt are intentionally excluded — they must not change on re-RSVP.
      .orUpdate(['state', 'updatedAt'], ['userId', 'eventId'])
      .execute();

    const saved = await this.rsvpRepository.findOneOrFail({ where: { userId, eventId } });
    return { id: saved.id, state: saved.state, rsvpedAt: saved.rsvpedAt };
  }

  // cancelRsvp() — logical cancel: sets state = CANCELLED, row is never physically deleted (D-03).
  // T-08-02: userId sourced from JWT — a user can only cancel their own RSVP.
  // Returns 404 (not 403) if row not found — no info leakage about other users' RSVPs.
  async cancelRsvp(userId: string, eventId: string): Promise<void> {
    const existing = await this.rsvpRepository.findOne({ where: { userId, eventId } });
    if (!existing) {
      throw new NotFoundException('RSVP not found');
    }
    await this.rsvpRepository.update({ userId, eventId }, { state: RsvpState.CANCELLED });
  }

  // listUserRsvps() — cursor-paginated RSVP history for the authenticated user.
  // T-08-03: scoped to userId from JWT — user A cannot retrieve user B's history.
  // D-05: filters WHERE state != CANCELLED — cancelled RSVPs are invisible in history.
  // D-10: cursor on (rsvpedAt DESC, id ASC); uses < comparison for DESC sort direction.
  async listUserRsvps(
    userId: string,
    query: RsvpHistoryQueryDto,
  ): Promise<PaginatedRsvpHistoryDto> {
    const effectiveLimit = Math.min(query.limit ?? 20, 100);

    const qb = this.rsvpRepository
      .createQueryBuilder('rsvp')
      .leftJoinAndMapOne('rsvp.event', EventEntity, 'event', 'event.id = rsvp.eventId')
      .where('rsvp.userId = :userId', { userId })
      .andWhere('rsvp.state != :cancelled', { cancelled: RsvpState.CANCELLED })
      .orderBy('rsvp.rsvpedAt', 'DESC')
      .addOrderBy('rsvp.id', 'ASC')
      .take(effectiveLimit + 1);

    if (query.cursor) {
      // Cursor encodes rsvpedAt ISO string + rsvpId. Use < for DESC sort (opposite of ASC > pattern).
      const { cursorRsvpedAt, cursorRsvpId } = RsvpService.decodeCursor(query.cursor);
      qb.andWhere(
        '(rsvp."rsvpedAt", rsvp."id") < (:cursorRsvpedAt::timestamptz, :cursorRsvpId)',
        { cursorRsvpedAt, cursorRsvpId },
      );
    }

    const rows = (await qb.getMany()) as Array<RsvpEntity & { event: EventEntity }>;
    const hasMore = rows.length > effectiveLimit;
    const data = hasMore ? rows.slice(0, effectiveLimit) : rows;
    const lastItem = data[data.length - 1];
    const nextCursor =
      hasMore && lastItem ? RsvpService.encodeCursor(lastItem.rsvpedAt, lastItem.id) : null;

    return {
      data: data.map((r) => this.toRsvpHistoryItemDto(r)),
      nextCursor,
      hasMore,
    };
  }

  // countByEventAndState() — live COUNT for RSVP-03 (D-07: no denormalized columns).
  async countByEventAndState(eventId: string, state: RsvpState): Promise<number> {
    return this.rsvpRepository.count({ where: { eventId, state } });
  }

  // toRsvpHistoryItemDto() — maps a joined rsvp+event row to the slim history shape (D-09).
  private toRsvpHistoryItemDto(
    rsvp: RsvpEntity & { event: EventEntity },
  ): RsvpHistoryItemDto {
    return {
      rsvpState: rsvp.state,
      rsvpedAt: rsvp.rsvpedAt,
      event: {
        id: rsvp.event.id,
        title: rsvp.event.title,
        startAt: rsvp.event.startAt,
        city: rsvp.event.city ?? null,
        imageUrl: rsvp.event.imageUrl ?? null,
      },
    };
  }

  // encodeCursor() — base64url-encodes (rsvpedAt ISO, rsvpId) for opaque pagination tokens.
  private static encodeCursor(rsvpedAt: Date, rsvpId: string): string {
    return Buffer.from(`${rsvpedAt.toISOString()}__${rsvpId}`).toString('base64url');
  }

  // decodeCursor() — decodes base64url cursor back to (cursorRsvpedAt, cursorRsvpId).
  private static decodeCursor(cursor: string): {
    cursorRsvpedAt: string;
    cursorRsvpId: string;
  } {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const [cursorRsvpedAt, cursorRsvpId] = raw.split('__');
    return { cursorRsvpedAt, cursorRsvpId };
  }
}

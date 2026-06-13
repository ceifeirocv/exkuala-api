import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createId } from '@paralleldrive/cuid2';
import { EventEntity, EventStatus } from './event.entity';
import { EventAuditLogEntity, EventAuditAction } from './event-audit-log.entity';
import { AdminEventQueryDto } from './dto/admin-event-query.dto';
import { PaginatedAdminEventsResponseDto } from './dto/paginated-admin-events-response.dto';

// States from which an admin can suspend an event (D-02).
// CANCELLED/SUSPENDED are excluded — no double-suspend, no suspending terminal state.
const ADMIN_SUSPENDABLE: EventStatus[] = [EventStatus.DRAFT, EventStatus.PUBLISHED];

@Injectable()
export class AdminEventsService {
  private readonly logger = new Logger(AdminEventsService.name);

  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectRepository(EventAuditLogEntity)
    private readonly auditLogRepository: Repository<EventAuditLogEntity>,
  ) {}

  // findAllForAdmin() — cross-organizer, all-status list with optional soft-deleted rows.
  // Returns raw EventEntity (NOT toResponseDto) so admin sees statusBeforeSuspension, deletedAt (D-08).
  async findAllForAdmin(query: AdminEventQueryDto): Promise<PaginatedAdminEventsResponseDto> {
    const effectiveLimit = Math.min(query.limit ?? 20, 100);
    const qb = this.eventRepository
      .createQueryBuilder('event')
      .orderBy('event.startAt', 'ASC')
      .addOrderBy('event.id', 'ASC')
      .take(effectiveLimit + 1);

    if (query.includeDeleted) {
      qb.withDeleted();
    }
    if (query.status) {
      qb.where('event."status" = :status', { status: query.status });
    }
    if (query.organizerId) {
      qb.andWhere('event."organizerId" = :organizerId', { organizerId: query.organizerId });
    }
    if (query.cursor) {
      const { cursorStartAt, cursorId } = AdminEventsService.decodeCursor(query.cursor);
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
        ? AdminEventsService.encodeCursor(lastItem.startAt, lastItem.id)
        : null;

    // Admin list returns full EventEntity — NOT toResponseDto() (D-08, Pitfall 4)
    return { data, nextCursor, hasMore };
  }

  // adminSuspend() — DRAFT|PUBLISHED → SUSPENDED. Stores prior status for restore (D-02).
  async adminSuspend(eventId: string, adminUserId: string, note?: string): Promise<void> {
    const event = await this.findEventOrThrow(eventId);
    if (!ADMIN_SUSPENDABLE.includes(event.status)) {
      throw new ConflictException(
        `Event '${eventId}' is ${event.status} — only DRAFT and PUBLISHED events can be suspended`,
      );
    }
    event.statusBeforeSuspension = event.status;
    event.status = EventStatus.SUSPENDED;
    await this.eventRepository.save(event);
    await this.writeEventAuditLog(eventId, EventAuditAction.SUSPENDED, adminUserId, note);
  }

  // adminRestore() — SUSPENDED → prior status; defaults to DRAFT when statusBeforeSuspension is null (D-03).
  async adminRestore(eventId: string, adminUserId: string, note?: string): Promise<void> {
    const event = await this.findEventOrThrow(eventId);
    if (event.status !== EventStatus.SUSPENDED) {
      throw new ConflictException(
        `Event '${eventId}' is ${event.status} — only SUSPENDED events can be restored`,
      );
    }
    event.status = event.statusBeforeSuspension ?? EventStatus.DRAFT;
    event.statusBeforeSuspension = null;
    await this.eventRepository.save(event);
    await this.writeEventAuditLog(eventId, EventAuditAction.RESTORED, adminUserId, note);
  }

  // adminRemove() — soft-delete regardless of status or ownership (D-04).
  async adminRemove(eventId: string, adminUserId: string, note?: string): Promise<void> {
    await this.findEventOrThrow(eventId);
    await this.eventRepository.softDelete(eventId);
    await this.writeEventAuditLog(eventId, EventAuditAction.REMOVED, adminUserId, note);
  }

  // findEventOrThrow() — findOne by id only (no ownership filter — admin bypasses it).
  private async findEventOrThrow(eventId: string): Promise<EventEntity> {
    const event = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException(`Event with id '${eventId}' not found`);
    }
    return event;
  }

  // writeEventAuditLog() — always create()+save(), never insert() (Pitfall 3: @BeforeInsert skipped by insert()).
  private async writeEventAuditLog(
    eventId: string,
    action: EventAuditAction,
    adminUserId: string,
    note?: string,
  ): Promise<void> {
    const log = this.auditLogRepository.create({
      id: createId(),
      eventId,
      action,
      adminUserId,
      note: note ?? null,
    });
    await this.auditLogRepository.save(log);
  }

  private static encodeCursor(startAt: Date, id: string): string {
    return Buffer.from(`${startAt.toISOString()}__${id}`).toString('base64url');
  }

  private static decodeCursor(cursor: string): { cursorStartAt: string; cursorId: string } {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const [cursorStartAt, cursorId] = raw.split('__');
    return { cursorStartAt, cursorId };
  }
}

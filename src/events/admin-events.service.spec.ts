// Wave 2 RED stub — AdminEventsService does not exist yet.
// Import at module level so the suite fails at import resolution, not assertion time.
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEntity, EventStatus } from './event.entity';
import { EventAuditLogEntity, EventAuditAction } from './event-audit-log.entity';
import { AdminEventsService } from './admin-events.service'; // RED: file absent until Task 2

// Named fake repository classes per CLAUDE.md: "Mock external I/O with named fake classes, not inline stubs"
class FakeEventQueryBuilder {
  withDeleted = jest.fn().mockReturnThis();
  where = jest.fn().mockReturnThis();
  andWhere = jest.fn().mockReturnThis();
  orderBy = jest.fn().mockReturnThis();
  addOrderBy = jest.fn().mockReturnThis();
  take = jest.fn().mockReturnThis();
  getMany = jest.fn().mockResolvedValue([]);
}

let fakeQb: FakeEventQueryBuilder;

class FakeEventRepository {
  createQueryBuilder = jest.fn(() => fakeQb);
  findOne = jest.fn();
  save = jest.fn();
  softDelete = jest.fn();
}

class FakeAuditLogRepository {
  create = jest.fn();
  save = jest.fn();
}

describe('AdminEventsService', () => {
  let service: AdminEventsService;
  let eventRepo: FakeEventRepository;
  let auditRepo: FakeAuditLogRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    fakeQb = new FakeEventQueryBuilder();
    eventRepo = new FakeEventRepository();
    auditRepo = new FakeAuditLogRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminEventsService,
        { provide: getRepositoryToken(EventEntity), useValue: eventRepo },
        { provide: getRepositoryToken(EventAuditLogEntity), useValue: auditRepo },
      ],
    }).compile();

    service = module.get<AdminEventsService>(AdminEventsService);
  });

  describe('findAllForAdmin()', () => {
    it('returns { data, nextCursor, hasMore } with raw EventEntity items (no DTO mapping — D-08)', async () => {
      // Raw entity with admin-only field — proves toResponseDto() is NOT called (Pitfall 4)
      const rawEntity = {
        id: 'evt-01',
        status: EventStatus.SUSPENDED,
        statusBeforeSuspension: EventStatus.DRAFT,
        startAt: new Date('2027-01-01'),
      } as EventEntity;
      fakeQb.getMany.mockResolvedValue([rawEntity]);

      const result = await service.findAllForAdmin({});

      expect(result.data).toHaveLength(1);
      // Must expose statusBeforeSuspension — DTO mapping would strip this field
      expect(result.data[0].statusBeforeSuspension).toBe(EventStatus.DRAFT);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('calls qb.withDeleted() when includeDeleted=true', async () => {
      fakeQb.getMany.mockResolvedValue([]);

      await service.findAllForAdmin({ includeDeleted: true });

      expect(fakeQb.withDeleted).toHaveBeenCalled();
    });

    it('does NOT call qb.withDeleted() when includeDeleted is omitted', async () => {
      fakeQb.getMany.mockResolvedValue([]);

      await service.findAllForAdmin({});

      expect(fakeQb.withDeleted).not.toHaveBeenCalled();
    });

    it('adds status where-clause when status filter provided', async () => {
      fakeQb.getMany.mockResolvedValue([]);

      await service.findAllForAdmin({ status: EventStatus.SUSPENDED });

      expect(fakeQb.where).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.objectContaining({ status: EventStatus.SUSPENDED }),
      );
    });

    it('adds organizerId where-clause when organizerId filter provided', async () => {
      fakeQb.getMany.mockResolvedValue([]);

      await service.findAllForAdmin({ organizerId: 'org-01' });

      // where or andWhere — either is valid depending on clause ordering
      const allWhereCalls = [
        ...fakeQb.where.mock.calls,
        ...fakeQb.andWhere.mock.calls,
      ];
      const hasOrgFilter = allWhereCalls.some(([, params]) => params?.organizerId === 'org-01');
      expect(hasOrgFilter).toBe(true);
    });

    it('sets hasMore=true and non-null nextCursor when results exceed limit', async () => {
      // 3 rows with limit=2 → take(3), slice to 2, hasMore=true
      const rows = [
        { id: 'evt-01', startAt: new Date('2027-01-01') } as EventEntity,
        { id: 'evt-02', startAt: new Date('2027-01-02') } as EventEntity,
        { id: 'evt-03', startAt: new Date('2027-01-03') } as EventEntity,
      ];
      fakeQb.getMany.mockResolvedValue(rows);

      const result = await service.findAllForAdmin({ limit: 2 });

      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).not.toBeNull();
      expect(result.data).toHaveLength(2);
    });
  });

  describe('adminSuspend()', () => {
    it('DRAFT→SUSPENDED: saves statusBeforeSuspension=DRAFT and writes SUSPENDED audit row', async () => {
      const event = {
        id: 'evt-01',
        status: EventStatus.DRAFT,
        statusBeforeSuspension: null,
      } as EventEntity;
      eventRepo.findOne.mockResolvedValue(event);
      eventRepo.save.mockResolvedValue(event);
      auditRepo.create.mockReturnValue({});
      auditRepo.save.mockResolvedValue({});

      await service.adminSuspend('evt-01', 'admin-01', 'Policy violation');

      expect(eventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: EventStatus.SUSPENDED, statusBeforeSuspension: EventStatus.DRAFT }),
      );
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: EventAuditAction.SUSPENDED, adminUserId: 'admin-01' }),
      );
      expect(auditRepo.save).toHaveBeenCalled();
    });

    it('PUBLISHED→SUSPENDED: saves statusBeforeSuspension=PUBLISHED', async () => {
      const event = { id: 'evt-02', status: EventStatus.PUBLISHED, statusBeforeSuspension: null } as EventEntity;
      eventRepo.findOne.mockResolvedValue(event);
      eventRepo.save.mockResolvedValue(event);
      auditRepo.create.mockReturnValue({});
      auditRepo.save.mockResolvedValue({});

      await service.adminSuspend('evt-02', 'admin-01');

      expect(eventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ statusBeforeSuspension: EventStatus.PUBLISHED }),
      );
    });

    it('throws ConflictException when event is already SUSPENDED', async () => {
      const event = { id: 'evt-03', status: EventStatus.SUSPENDED } as EventEntity;
      eventRepo.findOne.mockResolvedValue(event);

      await expect(service.adminSuspend('evt-03', 'admin-01')).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when event is CANCELLED', async () => {
      const event = { id: 'evt-04', status: EventStatus.CANCELLED } as EventEntity;
      eventRepo.findOne.mockResolvedValue(event);

      await expect(service.adminSuspend('evt-04', 'admin-01')).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException for missing event', async () => {
      eventRepo.findOne.mockResolvedValue(null);

      await expect(service.adminSuspend('evt-999', 'admin-01')).rejects.toThrow(NotFoundException);
    });
  });

  describe('adminRestore()', () => {
    it('SUSPENDED→prior status: clears statusBeforeSuspension and writes RESTORED audit row', async () => {
      const event = {
        id: 'evt-01',
        status: EventStatus.SUSPENDED,
        statusBeforeSuspension: EventStatus.PUBLISHED,
      } as EventEntity;
      eventRepo.findOne.mockResolvedValue(event);
      eventRepo.save.mockResolvedValue(event);
      auditRepo.create.mockReturnValue({});
      auditRepo.save.mockResolvedValue({});

      await service.adminRestore('evt-01', 'admin-01', 'Resolved');

      expect(eventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: EventStatus.PUBLISHED, statusBeforeSuspension: null }),
      );
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: EventAuditAction.RESTORED, adminUserId: 'admin-01' }),
      );
    });

    it('defaults to DRAFT when statusBeforeSuspension is null', async () => {
      const event = {
        id: 'evt-02',
        status: EventStatus.SUSPENDED,
        statusBeforeSuspension: null,
      } as EventEntity;
      eventRepo.findOne.mockResolvedValue(event);
      eventRepo.save.mockResolvedValue(event);
      auditRepo.create.mockReturnValue({});
      auditRepo.save.mockResolvedValue({});

      await service.adminRestore('evt-02', 'admin-01');

      expect(eventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: EventStatus.DRAFT }),
      );
    });

    it('throws ConflictException when event is not SUSPENDED', async () => {
      const event = { id: 'evt-03', status: EventStatus.PUBLISHED } as EventEntity;
      eventRepo.findOne.mockResolvedValue(event);

      await expect(service.adminRestore('evt-03', 'admin-01')).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException for missing event', async () => {
      eventRepo.findOne.mockResolvedValue(null);

      await expect(service.adminRestore('evt-999', 'admin-01')).rejects.toThrow(NotFoundException);
    });
  });

  describe('adminRemove()', () => {
    it('soft-deletes event and writes REMOVED audit row regardless of status', async () => {
      const event = { id: 'evt-01', status: EventStatus.PUBLISHED } as EventEntity;
      eventRepo.findOne.mockResolvedValue(event);
      eventRepo.softDelete.mockResolvedValue({});
      auditRepo.create.mockReturnValue({});
      auditRepo.save.mockResolvedValue({});

      await service.adminRemove('evt-01', 'admin-01', 'Remove reason');

      expect(eventRepo.softDelete).toHaveBeenCalledWith('evt-01');
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: EventAuditAction.REMOVED, adminUserId: 'admin-01' }),
      );
      expect(auditRepo.save).toHaveBeenCalled();
    });

    it('removes a SUSPENDED event (ownership bypass)', async () => {
      const event = { id: 'evt-02', status: EventStatus.SUSPENDED } as EventEntity;
      eventRepo.findOne.mockResolvedValue(event);
      eventRepo.softDelete.mockResolvedValue({});
      auditRepo.create.mockReturnValue({});
      auditRepo.save.mockResolvedValue({});

      await service.adminRemove('evt-02', 'admin-01');

      expect(eventRepo.softDelete).toHaveBeenCalledWith('evt-02');
    });

    it('throws NotFoundException for missing event', async () => {
      eventRepo.findOne.mockResolvedValue(null);

      await expect(service.adminRemove('evt-999', 'admin-01')).rejects.toThrow(NotFoundException);
    });
  });
});

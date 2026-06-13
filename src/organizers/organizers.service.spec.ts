import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { OrganizersService } from './organizers.service';
import { OrganizerEntity, OrganizerStatus } from './organizer.entity';
import { OrganizerAuditLogEntity, OrganizerAuditAction } from './organizer-audit-log.entity';
// RED: these modules do not exist yet — import at top so the suite fails at compile time (not assertion time)
import { OrganizerPaginationQueryDto } from './dto/organizer-pagination-query.dto';
import { PaginatedOrganizersResponseDto } from './dto/paginated-organizers-response.dto';

// Named mock repositories per CLAUDE.md: "Mock external I/O with named fake classes, not inline stubs"
const mockQueryBuilder = {
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getMany: jest.fn(),
};

const mockOrganizerRepository = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
};

const mockAuditLogRepository = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
};

describe('OrganizersService', () => {
  let service: OrganizersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizersService,
        { provide: getRepositoryToken(OrganizerEntity), useValue: mockOrganizerRepository },
        { provide: getRepositoryToken(OrganizerAuditLogEntity), useValue: mockAuditLogRepository },
      ],
    }).compile();

    service = module.get<OrganizersService>(OrganizersService);
  });

  describe('apply() (ORG-01)', () => {
    it('creates a pending organizer and returns it', async () => {
      const userId = 'user-01';
      const dto = { name: 'Acme Events', description: 'We run cool events', email: 'acme@example.com' };
      const entity = {
        id: 'org-01',
        userId,
        ...dto,
        website: null,
        socialLinks: null,
        status: OrganizerStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as OrganizerEntity;

      mockOrganizerRepository.findOne.mockResolvedValue(null);
      mockOrganizerRepository.create.mockReturnValue(entity);
      mockOrganizerRepository.save.mockResolvedValue(entity);

      const result = await service.apply(userId, dto);

      expect(result.status).toBe(OrganizerStatus.PENDING);
      expect(result.userId).toBe(userId);
    });

    it('throws ConflictException (409) when userId already has an organizer row (23505)', async () => {
      const userId = 'user-01';
      const dto = { name: 'Acme Events', description: 'We run cool events', email: 'acme@example.com' };
      const existing = { id: 'org-01', userId, status: OrganizerStatus.PENDING } as OrganizerEntity;

      mockOrganizerRepository.findOne.mockResolvedValue(existing);

      // Approved organizer attempts to reapply — 409 per D-07
      const approvedExisting = { ...existing, status: OrganizerStatus.APPROVED } as OrganizerEntity;
      mockOrganizerRepository.findOne.mockResolvedValue(approvedExisting);

      const dbError = new QueryFailedError('INSERT', [], new Error('duplicate key'));
      (dbError as QueryFailedError & { code: string }).code = '23505';
      mockOrganizerRepository.save.mockRejectedValue(dbError);

      await expect(service.apply(userId, dto)).rejects.toThrow(ConflictException);
    });

    it('allows reapplication when status is rejected — overwrites in-place and resets to pending (D-06)', async () => {
      const userId = 'user-01';
      const dto = { name: 'Acme Events v2', description: 'Updated description', email: 'acme2@example.com' };
      const existing = {
        id: 'org-01',
        userId,
        name: 'Acme Events',
        description: 'Old description',
        email: 'acme@example.com',
        status: OrganizerStatus.REJECTED,
      } as OrganizerEntity;
      const updated = { ...existing, ...dto, status: OrganizerStatus.PENDING } as OrganizerEntity;

      mockOrganizerRepository.findOne.mockResolvedValue(existing);
      mockOrganizerRepository.save.mockResolvedValue(updated);

      const result = await service.apply(userId, dto);

      expect(result.status).toBe(OrganizerStatus.PENDING);
      expect(result.name).toBe('Acme Events v2');
    });

    it('throws ConflictException when approved organizer attempts to reapply (D-07)', async () => {
      const userId = 'user-01';
      const dto = { name: 'Acme Events', description: 'We run cool events', email: 'acme@example.com' };
      const existing = { id: 'org-01', userId, status: OrganizerStatus.APPROVED } as OrganizerEntity;

      mockOrganizerRepository.findOne.mockResolvedValue(existing);

      await expect(service.apply(userId, dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('approve() (ORG-02)', () => {
    it('transitions pending organizer to approved and inserts audit log row', async () => {
      const organizer = {
        id: 'org-01',
        userId: 'user-01',
        status: OrganizerStatus.PENDING,
      } as OrganizerEntity;
      const auditLog = {
        id: 'log-01',
        organizerId: 'org-01',
        action: OrganizerAuditAction.APPROVED,
        note: null,
      } as OrganizerAuditLogEntity;

      mockOrganizerRepository.findOne.mockResolvedValue(organizer);
      mockOrganizerRepository.save.mockResolvedValue({ ...organizer, status: OrganizerStatus.APPROVED });
      mockAuditLogRepository.create.mockReturnValue(auditLog);
      mockAuditLogRepository.save.mockResolvedValue(auditLog);

      // approve(id, adminUserId, note?) — updated signature per ADMIN-03 (D-12)
      await service.approve('org-01', 'admin-01');

      expect(mockOrganizerRepository.save).toHaveBeenCalled();
      expect(mockAuditLogRepository.save).toHaveBeenCalled();
    });

    it('throws ConflictException on invalid transition from approved', async () => {
      const organizer = {
        id: 'org-01',
        userId: 'user-01',
        status: OrganizerStatus.APPROVED,
      } as OrganizerEntity;

      mockOrganizerRepository.findOne.mockResolvedValue(organizer);

      await expect(service.approve('org-01', 'admin-01')).rejects.toThrow(ConflictException);
    });

    it('inserts audit log with action APPROVED and optional note', async () => {
      const organizer = {
        id: 'org-01',
        userId: 'user-01',
        status: OrganizerStatus.PENDING,
      } as OrganizerEntity;

      mockOrganizerRepository.findOne.mockResolvedValue(organizer);
      mockOrganizerRepository.save.mockResolvedValue({ ...organizer, status: OrganizerStatus.APPROVED });
      mockAuditLogRepository.create.mockReturnValue({ action: OrganizerAuditAction.APPROVED, note: 'Great application' });
      mockAuditLogRepository.save.mockResolvedValue({});

      // approve(id, adminUserId, note?) — updated signature per ADMIN-03 (D-12)
      await service.approve('org-01', 'admin-01', 'Great application');

      expect(mockAuditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: OrganizerAuditAction.APPROVED, note: 'Great application' }),
      );
    });
  });

  describe('reject() (ORG-02)', () => {
    it('transitions pending organizer to rejected with optional note and inserts audit log', async () => {
      const organizer = {
        id: 'org-01',
        userId: 'user-01',
        status: OrganizerStatus.PENDING,
      } as OrganizerEntity;

      mockOrganizerRepository.findOne.mockResolvedValue(organizer);
      mockOrganizerRepository.save.mockResolvedValue({ ...organizer, status: OrganizerStatus.REJECTED });
      mockAuditLogRepository.create.mockReturnValue({ action: OrganizerAuditAction.REJECTED, note: 'Incomplete info' });
      mockAuditLogRepository.save.mockResolvedValue({});

      // reject(id, adminUserId, note?) — updated signature per ADMIN-03 (D-12)
      await service.reject('org-01', 'admin-01', 'Incomplete info');

      expect(mockAuditLogRepository.save).toHaveBeenCalled();
    });

    it('throws ConflictException on invalid transition from approved', async () => {
      const organizer = {
        id: 'org-01',
        userId: 'user-01',
        status: OrganizerStatus.APPROVED,
      } as OrganizerEntity;

      mockOrganizerRepository.findOne.mockResolvedValue(organizer);

      await expect(service.reject('org-01', 'admin-01')).rejects.toThrow(ConflictException);
    });
  });

  describe('findApprovedById() (ORG-03)', () => {
    it('returns organizer when status is approved', async () => {
      const organizer = {
        id: 'org-01',
        userId: 'user-01',
        status: OrganizerStatus.APPROVED,
      } as OrganizerEntity;

      mockOrganizerRepository.findOne.mockResolvedValue(organizer);

      const result = await service.findApprovedById('org-01');

      expect(result.id).toBe('org-01');
      expect(result.status).toBe(OrganizerStatus.APPROVED);
    });

    it('throws NotFoundException when organizer does not exist', async () => {
      mockOrganizerRepository.findOne.mockResolvedValue(null);

      await expect(service.findApprovedById('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when organizer exists but is not approved', async () => {
      const organizer = {
        id: 'org-01',
        userId: 'user-01',
        status: OrganizerStatus.PENDING,
      } as OrganizerEntity;

      mockOrganizerRepository.findOne.mockResolvedValue(organizer);

      await expect(service.findApprovedById('org-01')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByStatusPaginated() (ADMIN-01)', () => {
    beforeEach(() => {
      // Reset query builder mocks between tests
      mockQueryBuilder.getMany.mockReset();
      mockOrganizerRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    });

    it('returns { data, nextCursor, hasMore } shape with hasMore false when results fit in limit', async () => {
      const organizers = [
        { id: 'org-01', status: OrganizerStatus.PENDING, createdAt: new Date('2026-01-01') } as OrganizerEntity,
      ];
      mockQueryBuilder.getMany.mockResolvedValue(organizers);

      const query: OrganizerPaginationQueryDto = { limit: 20 };
      const result: PaginatedOrganizersResponseDto = await service.findByStatusPaginated(query);

      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('orders results by (createdAt ASC, id ASC)', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.findByStatusPaginated({});

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('organizer.createdAt', 'ASC');
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('organizer.id', 'ASC');
    });

    it('adds status where-clause when status is provided', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.findByStatusPaginated({ status: OrganizerStatus.PENDING });

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.objectContaining({ status: OrganizerStatus.PENDING }),
      );
    });

    it('does not add status where-clause when status is omitted (returns all)', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.findByStatusPaginated({});

      expect(mockQueryBuilder.where).not.toHaveBeenCalled();
    });

    it('returns hasMore true and non-null nextCursor when more results exist', async () => {
      // Return limit+1 rows to signal more pages exist
      const rows = Array.from({ length: 21 }, (_, i) => ({
        id: `org-${i}`,
        status: OrganizerStatus.PENDING,
        createdAt: new Date(`2026-01-${String(i + 1).padStart(2, '0')}`),
      } as OrganizerEntity));
      mockQueryBuilder.getMany.mockResolvedValue(rows);

      const result = await service.findByStatusPaginated({ limit: 20 });

      expect(result.data).toHaveLength(20);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).not.toBeNull();
    });
  });

  describe('approve() with adminUserId (ADMIN-03)', () => {
    it('writes an audit row with the passed adminUserId', async () => {
      const organizer = {
        id: 'org-01',
        userId: 'user-01',
        status: OrganizerStatus.PENDING,
      } as OrganizerEntity;

      mockOrganizerRepository.findOne.mockResolvedValue(organizer);
      mockOrganizerRepository.save.mockResolvedValue({ ...organizer, status: OrganizerStatus.APPROVED });
      mockAuditLogRepository.create.mockReturnValue({ action: OrganizerAuditAction.APPROVED, adminUserId: 'admin-01' });
      mockAuditLogRepository.save.mockResolvedValue({});

      await service.approve('org-01', 'admin-01', 'Looks great');

      expect(mockAuditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ adminUserId: 'admin-01' }),
      );
    });
  });

  describe('reject() with adminUserId (ADMIN-03)', () => {
    it('writes an audit row with the passed adminUserId', async () => {
      const organizer = {
        id: 'org-01',
        userId: 'user-01',
        status: OrganizerStatus.PENDING,
      } as OrganizerEntity;

      mockOrganizerRepository.findOne.mockResolvedValue(organizer);
      mockOrganizerRepository.save.mockResolvedValue({ ...organizer, status: OrganizerStatus.REJECTED });
      mockAuditLogRepository.create.mockReturnValue({ action: OrganizerAuditAction.REJECTED, adminUserId: 'admin-01' });
      mockAuditLogRepository.save.mockResolvedValue({});

      await service.reject('org-01', 'admin-01', 'Incomplete info');

      expect(mockAuditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ adminUserId: 'admin-01' }),
      );
    });
  });

  describe('findSelfWithLatestNote() (ORG-01/ORG-03)', () => {
    it('returns organizer plus latestRejectionNote from most recent rejected audit log entry', async () => {
      const organizer = {
        id: 'org-01',
        userId: 'user-01',
        status: OrganizerStatus.REJECTED,
      } as OrganizerEntity;
      const latestLog = {
        id: 'log-01',
        organizerId: 'org-01',
        action: OrganizerAuditAction.REJECTED,
        note: 'Missing description',
        createdAt: new Date(),
      } as OrganizerAuditLogEntity;

      mockOrganizerRepository.findOne.mockResolvedValue(organizer);
      mockAuditLogRepository.findOne.mockResolvedValue(latestLog);

      const result = await service.findSelfWithLatestNote('user-01');

      expect(result.latestRejectionNote).toBe('Missing description');
    });

    it('returns latestRejectionNote as null when status is approved', async () => {
      const organizer = {
        id: 'org-01',
        userId: 'user-01',
        status: OrganizerStatus.APPROVED,
      } as OrganizerEntity;

      mockOrganizerRepository.findOne.mockResolvedValue(organizer);
      mockAuditLogRepository.findOne.mockResolvedValue(null);

      const result = await service.findSelfWithLatestNote('user-01');

      expect(result.latestRejectionNote).toBeNull();
    });
  });
});

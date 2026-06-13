import { ConflictException } from '@nestjs/common';
import { AdminOrganizersController } from './admin-organizers.controller';
import { OrganizersService } from './organizers.service';
import { OrganizerStatus } from './organizer.entity';
// RED: these modules do not exist yet — import at top so the suite fails at compile time (not assertion time)
import { OrganizerPaginationQueryDto } from './dto/organizer-pagination-query.dto';
import { PaginatedOrganizersResponseDto } from './dto/paginated-organizers-response.dto';

// Named mock service per CLAUDE.md: "Mock external I/O with named fake classes, not inline stubs"
const mockOrganizersService = {
  approve: jest.fn(),
  reject: jest.fn(),
  findByStatus: jest.fn(),
  findByStatusPaginated: jest.fn(),
  findAuditHistory: jest.fn(),
};

describe('AdminOrganizersController', () => {
  let controller: AdminOrganizersController;

  beforeEach(() => {
    jest.clearAllMocks();
    // Direct instantiation — no TestingModule (mirrors categories.controller.spec.ts pattern)
    controller = new AdminOrganizersController(mockOrganizersService as unknown as OrganizersService);
  });

  describe('PATCH /admin/organizers/:id/approve (ORG-02 / ADMIN-03)', () => {
    it('calls service.approve() with id and optional note, returns 204', async () => {
      mockOrganizersService.approve.mockResolvedValue(undefined);
      const user = { id: 'admin-user-01', auth0Id: 'auth0|abc', roles: ['admin'], createdAt: new Date(), updatedAt: new Date() };

      await controller.approve('org-01', { note: 'Looks great' }, user);

      expect(mockOrganizersService.approve).toHaveBeenCalledWith('org-01', 'admin-user-01', 'Looks great');
    });

    it('passes user.id (NOT user.sub) as adminUserId', async () => {
      mockOrganizersService.approve.mockResolvedValue(undefined);
      // AuthenticatedUser has id, not sub — verify the controller uses the correct field
      const user = { id: 'admin-user-01', auth0Id: 'auth0|abc', roles: ['admin'], createdAt: new Date(), updatedAt: new Date() };

      await controller.approve('org-01', {}, user);

      const [, adminUserId] = mockOrganizersService.approve.mock.calls[0];
      expect(adminUserId).toBe('admin-user-01');
    });

    it('propagates ConflictException on invalid transition', async () => {
      mockOrganizersService.approve.mockRejectedValue(
        new ConflictException('Organizer is already approved — transition to approved is not allowed'),
      );
      const user = { id: 'admin-user-01', auth0Id: 'auth0|abc', roles: ['admin'], createdAt: new Date(), updatedAt: new Date() };

      await expect(controller.approve('org-01', {}, user)).rejects.toThrow(ConflictException);
    });
  });

  describe('PATCH /admin/organizers/:id/reject (ORG-02 / ADMIN-03)', () => {
    it('calls service.reject() with id and optional note, returns 204', async () => {
      mockOrganizersService.reject.mockResolvedValue(undefined);
      const user = { id: 'admin-user-01', auth0Id: 'auth0|abc', roles: ['admin'], createdAt: new Date(), updatedAt: new Date() };

      await controller.reject('org-01', { note: 'Please provide more details' }, user);

      expect(mockOrganizersService.reject).toHaveBeenCalledWith('org-01', 'admin-user-01', 'Please provide more details');
    });

    it('passes user.id as adminUserId', async () => {
      mockOrganizersService.reject.mockResolvedValue(undefined);
      const user = { id: 'admin-user-99', auth0Id: 'auth0|xyz', roles: ['admin'], createdAt: new Date(), updatedAt: new Date() };

      await controller.reject('org-01', {}, user);

      const [, adminUserId] = mockOrganizersService.reject.mock.calls[0];
      expect(adminUserId).toBe('admin-user-99');
    });
  });

  describe('GET /admin/organizers (ADMIN-01 — cursor pagination)', () => {
    it('delegates to findByStatusPaginated with the query DTO', async () => {
      const paginatedResponse: PaginatedOrganizersResponseDto = {
        data: [{ id: 'org-01', status: OrganizerStatus.PENDING } as any],
        nextCursor: null,
        hasMore: false,
      };
      mockOrganizersService.findByStatusPaginated.mockResolvedValue(paginatedResponse);

      const query: OrganizerPaginationQueryDto = { status: OrganizerStatus.PENDING, limit: 10 };
      const result = await controller.findAll(query);

      expect(mockOrganizersService.findByStatusPaginated).toHaveBeenCalledWith(query);
      expect(result).toEqual(paginatedResponse);
    });

    it('passes query DTO with no status to return all organizers', async () => {
      const paginatedResponse: PaginatedOrganizersResponseDto = {
        data: [],
        nextCursor: null,
        hasMore: false,
      };
      mockOrganizersService.findByStatusPaginated.mockResolvedValue(paginatedResponse);

      const query: OrganizerPaginationQueryDto = {};
      await controller.findAll(query);

      expect(mockOrganizersService.findByStatusPaginated).toHaveBeenCalledWith(query);
    });
  });

  describe('GET /admin/organizers/:id/history (ORG-02)', () => {
    it('returns full audit log for organizer, newest first', async () => {
      const history = [
        { id: 'log-02', organizerId: 'org-01', action: 'rejected', note: 'Try again', createdAt: new Date('2026-05-05') },
        { id: 'log-01', organizerId: 'org-01', action: 'approved', note: null, createdAt: new Date('2026-05-01') },
      ];

      mockOrganizersService.findAuditHistory.mockResolvedValue(history);

      const result = await controller.findHistory('org-01');

      expect(mockOrganizersService.findAuditHistory).toHaveBeenCalledWith('org-01');
      // Newest entry is first
      expect(result[0].id).toBe('log-02');
    });
  });
});

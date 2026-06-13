// Wave 2 RED stub — AdminEventsController does not exist yet.
// Import at module level so the suite fails at import resolution, not assertion time.
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AdminEventsController } from './admin-events.controller'; // RED: file absent until Task 3
import { AdminEventsService } from './admin-events.service';       // RED: file absent until Task 2
import { AdminEventQueryDto } from './dto/admin-event-query.dto';
import { AdminEventModerationDto } from './dto/admin-event-moderation.dto';
import { EventEntity, EventStatus } from './event.entity';
import { PaginatedAdminEventsResponseDto } from './dto/paginated-admin-events-response.dto';
import type { AuthenticatedUser } from '../types/auth';

// Named mock service per CLAUDE.md: "Mock external I/O with named fake classes, not inline stubs"
const mockAdminEventsService = {
  findAllForAdmin: jest.fn(),
  adminSuspend: jest.fn(),
  adminRestore: jest.fn(),
  adminRemove: jest.fn(),
};

// Minimal AuthenticatedUser fixture — id is UserEntity.id (NOT sub, per 09-CONTEXT.md critical fact)
const adminUser: AuthenticatedUser = {
  id: 'user-admin-01',
  auth0Id: 'auth0|admin01',
  roles: ['admin'],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AdminEventsController', () => {
  let controller: AdminEventsController;

  beforeEach(() => {
    jest.clearAllMocks();
    // Direct instantiation — no TestingModule (mirrors admin-organizers.controller.spec.ts pattern)
    controller = new AdminEventsController(mockAdminEventsService as unknown as AdminEventsService);
  });

  describe('GET /admin/events — findAll()', () => {
    it('delegates to findAllForAdmin with the query DTO', async () => {
      const paginatedResponse: PaginatedAdminEventsResponseDto = {
        data: [{ id: 'evt-01', status: EventStatus.SUSPENDED } as EventEntity],
        nextCursor: null,
        hasMore: false,
      };
      mockAdminEventsService.findAllForAdmin.mockResolvedValue(paginatedResponse);

      const query: AdminEventQueryDto = { status: EventStatus.SUSPENDED, limit: 10 };
      const result = await controller.findAll(query);

      expect(mockAdminEventsService.findAllForAdmin).toHaveBeenCalledWith(query);
      expect(result).toEqual(paginatedResponse);
    });

    it('passes query with no filters to list all events', async () => {
      mockAdminEventsService.findAllForAdmin.mockResolvedValue({ data: [], nextCursor: null, hasMore: false });

      await controller.findAll({});

      expect(mockAdminEventsService.findAllForAdmin).toHaveBeenCalledWith({});
    });
  });

  describe('PATCH /admin/events/:id/suspend — suspend()', () => {
    it('calls adminSuspend with id, user.id (NOT user.sub), and dto.note', async () => {
      mockAdminEventsService.adminSuspend.mockResolvedValue(undefined);
      const dto: AdminEventModerationDto = { note: 'Policy violation' };

      await controller.suspend('evt-01', dto, adminUser);

      expect(mockAdminEventsService.adminSuspend).toHaveBeenCalledWith('evt-01', 'user-admin-01', 'Policy violation');
    });

    it('passes user.id (not user.sub) as adminUserId', async () => {
      mockAdminEventsService.adminSuspend.mockResolvedValue(undefined);

      await controller.suspend('evt-01', {}, adminUser);

      const [, adminUserId] = mockAdminEventsService.adminSuspend.mock.calls[0];
      expect(adminUserId).toBe('user-admin-01');
    });

    it('propagates ConflictException for invalid state (already SUSPENDED)', async () => {
      mockAdminEventsService.adminSuspend.mockRejectedValue(
        new ConflictException("Event 'evt-01' is SUSPENDED — only DRAFT and PUBLISHED events can be suspended"),
      );

      await expect(controller.suspend('evt-01', {}, adminUser)).rejects.toThrow(ConflictException);
    });

    it('propagates NotFoundException for missing event', async () => {
      mockAdminEventsService.adminSuspend.mockRejectedValue(
        new NotFoundException("Event with id 'evt-999' not found"),
      );

      await expect(controller.suspend('evt-999', {}, adminUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('PATCH /admin/events/:id/restore — restore()', () => {
    it('calls adminRestore with id, user.id, and dto.note', async () => {
      mockAdminEventsService.adminRestore.mockResolvedValue(undefined);
      const dto: AdminEventModerationDto = { note: 'Resolved' };

      await controller.restore('evt-01', dto, adminUser);

      expect(mockAdminEventsService.adminRestore).toHaveBeenCalledWith('evt-01', 'user-admin-01', 'Resolved');
    });

    it('passes user.id (not user.sub) as adminUserId', async () => {
      mockAdminEventsService.adminRestore.mockResolvedValue(undefined);

      await controller.restore('evt-01', {}, adminUser);

      const [, adminUserId] = mockAdminEventsService.adminRestore.mock.calls[0];
      expect(adminUserId).toBe('user-admin-01');
    });

    it('propagates ConflictException when event is not SUSPENDED', async () => {
      mockAdminEventsService.adminRestore.mockRejectedValue(
        new ConflictException("Event 'evt-01' is PUBLISHED — only SUSPENDED events can be restored"),
      );

      await expect(controller.restore('evt-01', {}, adminUser)).rejects.toThrow(ConflictException);
    });
  });

  describe('DELETE /admin/events/:id — remove()', () => {
    it('calls adminRemove with id, user.id, and dto.note', async () => {
      mockAdminEventsService.adminRemove.mockResolvedValue(undefined);
      const dto: AdminEventModerationDto = { note: 'Content removed' };

      await controller.remove('evt-01', dto, adminUser);

      expect(mockAdminEventsService.adminRemove).toHaveBeenCalledWith('evt-01', 'user-admin-01', 'Content removed');
    });

    it('passes user.id (not user.sub) as adminUserId', async () => {
      mockAdminEventsService.adminRemove.mockResolvedValue(undefined);

      await controller.remove('evt-01', {}, adminUser);

      const [, adminUserId] = mockAdminEventsService.adminRemove.mock.calls[0];
      expect(adminUserId).toBe('user-admin-01');
    });

    it('propagates NotFoundException for missing event', async () => {
      mockAdminEventsService.adminRemove.mockRejectedValue(
        new NotFoundException("Event with id 'evt-999' not found"),
      );

      await expect(controller.remove('evt-999', {}, adminUser)).rejects.toThrow(NotFoundException);
    });
  });
});

import { ConflictException } from '@nestjs/common';
import { AdminOrganizersController } from './admin-organizers.controller';
import { OrganizersService } from './organizers.service';
import { OrganizerStatus } from './organizer.entity';

// Named mock service per CLAUDE.md: "Mock external I/O with named fake classes, not inline stubs"
const mockOrganizersService = {
  approve: jest.fn(),
  reject: jest.fn(),
  findByStatus: jest.fn(),
  findAuditHistory: jest.fn(),
};

describe('AdminOrganizersController', () => {
  let controller: AdminOrganizersController;

  beforeEach(() => {
    jest.clearAllMocks();
    // Direct instantiation — no TestingModule (mirrors categories.controller.spec.ts pattern)
    controller = new AdminOrganizersController(mockOrganizersService as unknown as OrganizersService);
  });

  describe('PATCH /admin/organizers/:id/approve (ORG-02)', () => {
    it('calls service.approve() with id and optional note, returns 204', async () => {
      mockOrganizersService.approve.mockResolvedValue(undefined);

      await controller.approve('org-01', { note: 'Looks great' });

      expect(mockOrganizersService.approve).toHaveBeenCalledWith('org-01', 'Looks great');
    });

    it('propagates ConflictException on invalid transition', async () => {
      mockOrganizersService.approve.mockRejectedValue(
        new ConflictException('Organizer is already approved — transition to approved is not allowed'),
      );

      await expect(controller.approve('org-01', {})).rejects.toThrow(ConflictException);
    });
  });

  describe('PATCH /admin/organizers/:id/reject (ORG-02)', () => {
    it('calls service.reject() with id and optional note, returns 204', async () => {
      mockOrganizersService.reject.mockResolvedValue(undefined);

      await controller.reject('org-01', { note: 'Please provide more details' });

      expect(mockOrganizersService.reject).toHaveBeenCalledWith('org-01', 'Please provide more details');
    });
  });

  describe('GET /admin/organizers (ORG-02)', () => {
    it('returns list of organizers filtered by status when status param provided', async () => {
      const pending = [
        { id: 'org-01', status: OrganizerStatus.PENDING, name: 'Acme Events' },
        { id: 'org-02', status: OrganizerStatus.PENDING, name: 'Beta Events' },
      ];

      mockOrganizersService.findByStatus.mockResolvedValue(pending);

      const result = await controller.findAll({ status: OrganizerStatus.PENDING });

      expect(mockOrganizersService.findByStatus).toHaveBeenCalledWith(OrganizerStatus.PENDING);
      expect(result).toHaveLength(2);
    });

    it('returns all organizers when status param is omitted', async () => {
      const all = [
        { id: 'org-01', status: OrganizerStatus.PENDING },
        { id: 'org-02', status: OrganizerStatus.APPROVED },
        { id: 'org-03', status: OrganizerStatus.REJECTED },
      ];

      mockOrganizersService.findByStatus.mockResolvedValue(all);

      const result = await controller.findAll({});

      expect(mockOrganizersService.findByStatus).toHaveBeenCalledWith(undefined);
      expect(result).toHaveLength(3);
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

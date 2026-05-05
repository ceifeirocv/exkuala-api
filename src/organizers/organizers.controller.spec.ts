import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrganizersController } from './organizers.controller';
import { OrganizersService } from './organizers.service';
import { OrganizerStatus } from './organizer.entity';

// Named mock service per CLAUDE.md: "Mock external I/O with named fake classes, not inline stubs"
const mockOrganizersService = {
  apply: jest.fn(),
  findSelfWithLatestNote: jest.fn(),
  findApprovedById: jest.fn(),
};

describe('OrganizersController', () => {
  let controller: OrganizersController;

  beforeEach(() => {
    jest.clearAllMocks();
    // Direct instantiation — no TestingModule (mirrors categories.controller.spec.ts pattern)
    controller = new OrganizersController(mockOrganizersService as unknown as OrganizersService);
  });

  describe('POST /organizers (ORG-01)', () => {
    it('returns 201 with the created organizer when service.apply() succeeds', async () => {
      const userId = 'user-01';
      const dto = { name: 'Acme Events', description: 'We run cool events', email: 'acme@example.com' };
      const created = {
        id: 'org-01',
        userId,
        ...dto,
        website: null,
        socialLinks: null,
        status: OrganizerStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockOrganizersService.apply.mockResolvedValue(created);

      const result = await controller.apply({ id: userId } as any, dto as any);

      expect(mockOrganizersService.apply).toHaveBeenCalledWith(userId, dto);
      expect(result).toEqual(created);
    });

    it('propagates ConflictException from service', async () => {
      mockOrganizersService.apply.mockRejectedValue(
        new ConflictException('Organizer is already approved — transition to pending is not allowed'),
      );

      await expect(
        controller.apply({ id: 'user-01' } as any, {} as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('GET /organizers/me (ORG-01)', () => {
    it('returns organizer self-view with latestRejectionNote', async () => {
      const selfView = {
        id: 'org-01',
        userId: 'user-01',
        name: 'Acme Events',
        description: 'We run cool events',
        email: 'acme@example.com',
        website: null,
        socialLinks: null,
        status: OrganizerStatus.REJECTED,
        latestRejectionNote: 'Please provide more details',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockOrganizersService.findSelfWithLatestNote.mockResolvedValue(selfView);

      const result = await controller.findMe({ id: 'user-01' } as any);

      expect(mockOrganizersService.findSelfWithLatestNote).toHaveBeenCalledWith('user-01');
      expect(result.latestRejectionNote).toBe('Please provide more details');
    });
  });

  describe('GET /organizers/:id (ORG-03)', () => {
    it('returns public profile (no email field) when organizer is approved', async () => {
      const publicProfile = {
        id: 'org-01',
        name: 'Acme Events',
        description: 'We run cool events',
        website: 'https://acme.example.com',
        socialLinks: { instagram: 'https://instagram.com/acme' },
      };

      mockOrganizersService.findApprovedById.mockResolvedValue(publicProfile);

      const result = await controller.findById('org-01');

      expect(mockOrganizersService.findApprovedById).toHaveBeenCalledWith('org-01');
      // Email must not be present in the public response per D-03
      expect(result).not.toHaveProperty('email');
    });

    it('propagates NotFoundException from service when not found or not approved', async () => {
      mockOrganizersService.findApprovedById.mockRejectedValue(
        new NotFoundException('Organizer not found or not approved'),
      );

      await expect(controller.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});

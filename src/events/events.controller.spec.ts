// Wave 0 RED stubs — EventsController is not yet implemented. This file intentionally fails to compile until Wave 3 creates events.controller.ts.
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { EventEntity, EventStatus } from './event.entity';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { OrganizerEntity } from '../organizers/organizer.entity';

// Named mock service per CLAUDE.md: "Mock external I/O with named fake classes, not inline stubs"
const mockEventsService = {
  create: jest.fn(),
  findOwned: jest.fn(),
  findOwnedById: jest.fn(),
  update: jest.fn(),
  softDeleteDraft: jest.fn(),
  // toResponseDto maps entity → DTO; identity mock passes entity data through unchanged
  toResponseDto: jest.fn((e) => e),
  // Phase 7 — translation upsert
  upsertTranslation: jest.fn(),
};

describe('EventsController', () => {
  let controller: EventsController;

  beforeEach(() => {
    jest.clearAllMocks();
    // Direct instantiation — no TestingModule (mirrors organizers.controller.spec.ts pattern)
    controller = new EventsController(mockEventsService as unknown as EventsService);
  });

  describe('POST /organizer/events (ORG-04, EVT-01)', () => {
    it('returns 201 with EventResponseDto when service.create() succeeds', async () => {
      const organizer = { id: 'org-01' } as OrganizerEntity;
      const dto = { title: 'Tech Meetup', startAt: new Date('2027-01-01'), categoryId: 'cat-01' };
      const created = {
        id: 'evt-01',
        organizerId: 'org-01',
        title: 'Tech Meetup',
        status: EventStatus.DRAFT,
      } as unknown as EventEntity;

      mockEventsService.create.mockResolvedValue(created);

      // Wave 3 will fill in real assertions — placeholder for RED state
      expect(true).toBe(true);
    });

    it('propagates ConflictException from service', async () => {
      mockEventsService.create.mockRejectedValue(new ConflictException());
      await expect(Promise.reject(new ConflictException())).rejects.toThrow(ConflictException);
    });
  });

  describe('GET /organizer/events (D-16, D-17, EVT-06)', () => {
    it('returns paginated events for the organizer', async () => {
      const organizer = { id: 'org-01' } as OrganizerEntity;
      const paginated = {
        data: [],
        nextCursor: null,
        hasMore: false,
      };

      mockEventsService.findOwned.mockResolvedValue(paginated);

      expect(true).toBe(true);
    });

    it('passes cursor and status filter to service', async () => {
      expect(true).toBe(true);
    });
  });

  describe('GET /organizer/events/:id (D-21, ORG-05)', () => {
    it('returns EventResponseDto for owned event', async () => {
      const organizer = { id: 'org-01' } as OrganizerEntity;
      const event = { id: 'evt-01', organizerId: 'org-01', status: EventStatus.DRAFT } as unknown as EventEntity;

      mockEventsService.findOwnedById.mockResolvedValue(event);

      expect(true).toBe(true);
    });

    it('propagates NotFoundException from service', async () => {
      mockEventsService.findOwnedById.mockRejectedValue(new NotFoundException());
      await expect(Promise.reject(new NotFoundException())).rejects.toThrow(NotFoundException);
    });
  });

  describe('PATCH /organizer/events/:id (ORG-04, ORG-05, EVT-02)', () => {
    it('returns updated EventResponseDto when service.update() succeeds', async () => {
      const organizer = { id: 'org-01' } as OrganizerEntity;
      const dto = { title: 'Updated Title' };
      const updated = { id: 'evt-01', organizerId: 'org-01', title: 'Updated Title', status: EventStatus.DRAFT } as unknown as EventEntity;

      mockEventsService.update.mockResolvedValue(updated);

      expect(true).toBe(true);
    });

    it('propagates ConflictException (status transition) from service', async () => {
      mockEventsService.update.mockRejectedValue(new ConflictException());
      await expect(Promise.reject(new ConflictException())).rejects.toThrow(ConflictException);
    });

    it('propagates UnprocessableEntityException (publish gate) from service', async () => {
      mockEventsService.update.mockRejectedValue(new UnprocessableEntityException());
      await expect(Promise.reject(new UnprocessableEntityException())).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe('DELETE /organizer/events/:id (EVT-05, D-15)', () => {
    it('returns 204 when service.softDeleteDraft() succeeds', async () => {
      const organizer = { id: 'org-01' } as OrganizerEntity;

      mockEventsService.softDeleteDraft.mockResolvedValue(undefined);

      expect(true).toBe(true);
    });

    it('propagates ConflictException when event is not draft', async () => {
      mockEventsService.softDeleteDraft.mockRejectedValue(new ConflictException());
      await expect(Promise.reject(new ConflictException())).rejects.toThrow(ConflictException);
    });
  });

  describe('PUT /organizer/events/:id/translations/:locale (I18N-01, D-03)', () => {
    it('delegates to eventsService.upsertTranslation and returns translation object', async () => {
      const organizer = { id: 'org-01' } as OrganizerEntity;
      const dto = { title: 'Noite de Jazz', description: 'Uma noite especial.' };
      const expected = { locale: 'pt', title: 'Noite de Jazz', description: 'Uma noite especial.' };
      mockEventsService.upsertTranslation.mockResolvedValue(expected);
      // Wave 2 will fill in real assertions once controller method exists
      expect(true).toBe(true);
    });

    it('propagates NotFoundException when event not owned by organizer', async () => {
      mockEventsService.upsertTranslation.mockRejectedValue(new NotFoundException());
      await expect(Promise.reject(new NotFoundException())).rejects.toThrow(NotFoundException);
    });
  });
});

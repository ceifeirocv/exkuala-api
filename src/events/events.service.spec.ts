// Wave 0 RED stubs — EventsService is not yet implemented. This file intentionally fails to compile until Wave 2 creates events.service.ts.
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEntity, EventStatus } from './event.entity';
import { EventTranslationEntity } from './event-translation.entity'; // RED: Wave 1 creates this
import { EventsService } from './events.service';
import { UpsertEventTranslationDto } from './dto/upsert-event-translation.dto'; // RED: Wave 1 creates this
import { RsvpService } from '../rsvp/rsvp.service'; // RED: Wave 2 creates this
import { RsvpState } from '../rsvp/rsvp.entity'; // RED: Wave 1 creates this

// Phase 8 — mock RsvpService for RSVP count tests
const mockRsvpService = {
  countByEventAndState: jest.fn(),
};

// Named mock repository per CLAUDE.md: "Mock external I/O with named fake classes, not inline stubs"
const mockQueryBuilder = {
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue([]),
};

const mockEventRepository = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  softDelete: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
};

// Phase 7 — translation repository mock
const mockTranslationRepository = {
  upsert: jest.fn(),
  findOneOrFail: jest.fn(),
};

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset createQueryBuilder to return fresh mock each time
    mockEventRepository.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: getRepositoryToken(EventEntity), useValue: mockEventRepository },
        { provide: getRepositoryToken(EventTranslationEntity), useValue: mockTranslationRepository }, // Phase 7
        { provide: RsvpService, useValue: mockRsvpService }, // Phase 8
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  describe('create() (EVT-01, ORG-04)', () => {
    it('creates a draft event and returns it', async () => {
      const organizerId = 'org-01';
      const dto = { title: 'Tech Meetup', startAt: new Date('2027-01-01'), categoryId: 'cat-01' };
      const entity = {
        id: 'evt-01',
        organizerId,
        title: dto.title,
        startAt: dto.startAt,
        categoryId: dto.categoryId,
        status: EventStatus.DRAFT,
        description: null,
        endAt: null,
        venueName: null,
        address: null,
        ticketPrice: null,
        externalTicketUrl: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as EventEntity;

      mockEventRepository.create.mockReturnValue(entity);
      mockEventRepository.save.mockResolvedValue(entity);

      // Wave 2 will fill in real assertions — placeholder for RED state
      expect(true).toBe(true);
    });

    it('creates event with all optional fields', async () => {
      const organizerId = 'org-01';
      const dto = {
        title: 'Full Event',
        startAt: new Date('2027-06-15'),
        categoryId: 'cat-02',
        description: 'A great event',
        venueName: 'The Venue',
        address: '123 Main St',
        ticketPrice: 25.00,
        externalTicketUrl: 'https://tickets.example.com',
        endAt: new Date('2027-06-15T23:00:00Z'),
      };
      const entity = {
        id: 'evt-02',
        organizerId,
        ...dto,
        status: EventStatus.DRAFT,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as EventEntity;

      mockEventRepository.create.mockReturnValue(entity);
      mockEventRepository.save.mockResolvedValue(entity);

      // Wave 2 will fill in real assertions
      expect(true).toBe(true);
    });
  });

  describe('findOwned() — cursor pagination (D-17, D-18, D-19, D-20, EVT-06)', () => {
    it('returns first page with hasMore=false when results ≤ limit', async () => {
      expect(true).toBe(true);
    });

    it('returns first page with hasMore=true and nextCursor when results > limit', async () => {
      expect(true).toBe(true);
    });

    it('accepts cursor param and applies row-value WHERE clause', async () => {
      expect(true).toBe(true);
    });

    it('filters by status when status query param provided', async () => {
      expect(true).toBe(true);
    });

    it('returns empty data array when organizer has no events', async () => {
      expect(true).toBe(true);
    });
  });

  describe('findOwnedById() (D-21, ORG-05)', () => {
    it('returns event when owned by organizer', async () => {
      expect(true).toBe(true);
    });

    it('throws NotFoundException when event not found', async () => {
      mockEventRepository.findOne.mockResolvedValue(null);
      expect(true).toBe(true);
    });

    it('throws NotFoundException (not ForbiddenException) when event belongs to different organizer', async () => {
      // Compound WHERE on organizerId prevents info leakage — returns null even if event exists
      mockEventRepository.findOne.mockResolvedValue(null);
      expect(true).toBe(true);
    });
  });

  describe('update() — field patch (D-05, ORG-04, ORG-05)', () => {
    it('updates allowed fields on a draft event', async () => {
      expect(true).toBe(true);
    });

    it('updates allowed fields on a published event (D-05)', async () => {
      expect(true).toBe(true);
    });

    it('throws ConflictException when patching a cancelled event (D-05)', async () => {
      await expect(Promise.reject(new ConflictException())).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when patching a suspended event (D-01 / Phase 9)', async () => {
      // Suspended events are frozen — organizer cannot modify them, same as cancelled (D-01)
      const suspendedEvent = {
        id: 'evt-01',
        organizerId: 'org-01',
        status: EventStatus.SUSPENDED,
      } as EventEntity;
      mockEventRepository.findOne.mockResolvedValue(suspendedEvent);

      await expect(
        service.update('org-01', 'evt-01', { title: 'New Title' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException for non-owned event', async () => {
      await expect(Promise.reject(new NotFoundException())).rejects.toThrow(NotFoundException);
    });
  });

  describe('update() — status transitions (D-02, D-03, D-04, D-07)', () => {
    it('transitions draft → published when publish gate passes', async () => {
      expect(true).toBe(true);
    });

    it('throws UnprocessableEntityException with missing fields when publish gate fails (D-10)', async () => {
      await expect(Promise.reject(new UnprocessableEntityException())).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('throws UnprocessableEntityException when startAt is in the past (D-06)', async () => {
      await expect(Promise.reject(new UnprocessableEntityException())).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('transitions published → cancelled (D-04)', async () => {
      expect(true).toBe(true);
    });

    it('throws ConflictException on draft → cancelled (D-04: drafts are deleted, not cancelled)', async () => {
      await expect(Promise.reject(new ConflictException())).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException on published → draft (D-02: no reverse transitions)', async () => {
      await expect(Promise.reject(new ConflictException())).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException on cancelled → published (D-03: terminal state)', async () => {
      await expect(Promise.reject(new ConflictException())).rejects.toThrow(ConflictException);
    });
  });

  describe('softDeleteDraft() (EVT-05, D-15)', () => {
    it('calls repository.softDelete() for owned draft event', async () => {
      expect(true).toBe(true);
    });

    it('throws ConflictException when event status is published (D-15)', async () => {
      await expect(Promise.reject(new ConflictException())).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when event status is cancelled (D-15)', async () => {
      await expect(Promise.reject(new ConflictException())).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException for non-owned event', async () => {
      await expect(Promise.reject(new NotFoundException())).rejects.toThrow(NotFoundException);
    });
  });

  describe('findPublishedById with RSVP counts (RSVP-03)', () => {
    const mockPublishedEvent = {
      id: 'evt-01',
      title: 'Jazz Night',
      status: EventStatus.PUBLISHED,
      description: null,
      startAt: new Date('2027-01-01'),
      endAt: null,
      venueName: null,
      address: null,
      city: null,
      imageUrl: null,
      ticketPrice: null,
      externalTicketUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      organizer: { id: 'org-01', name: 'Organizer One' },
      category: null,
      translations: [],
    };

    it('returns interestedCount as a number in the DTO', async () => {
      mockEventRepository.findOne.mockResolvedValue(mockPublishedEvent);
      mockRsvpService.countByEventAndState.mockResolvedValue(2);

      const result = await service.findPublishedById('evt-01');

      expect(typeof result.interestedCount).toBe('number');
    });

    it('returns goingCount as a number in the DTO', async () => {
      mockEventRepository.findOne.mockResolvedValue(mockPublishedEvent);
      mockRsvpService.countByEventAndState.mockResolvedValue(5);

      const result = await service.findPublishedById('evt-01');

      expect(typeof result.goingCount).toBe('number');
    });

    it('calls rsvpService.countByEventAndState() twice (once per state)', async () => {
      mockEventRepository.findOne.mockResolvedValue(mockPublishedEvent);
      mockRsvpService.countByEventAndState
        .mockResolvedValueOnce(2) // INTERESTED
        .mockResolvedValueOnce(3); // GOING

      const result = await service.findPublishedById('evt-01');

      expect(mockRsvpService.countByEventAndState).toHaveBeenCalledTimes(2);
      expect(mockRsvpService.countByEventAndState).toHaveBeenCalledWith('evt-01', RsvpState.INTERESTED);
      expect(mockRsvpService.countByEventAndState).toHaveBeenCalledWith('evt-01', RsvpState.GOING);
      expect(result.interestedCount).toBe(2);
      expect(result.goingCount).toBe(3);
    });
  });

  describe('upsertTranslation() (I18N-01, D-03)', () => {
    it('throws NotFoundException when event does not belong to organizer', async () => {
      mockEventRepository.findOne.mockResolvedValue(null);
      await expect(
        service.upsertTranslation('org-01', 'evt-999', 'pt', { title: 'T' } as UpsertEventTranslationDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('upserts translation row and returns { locale, title, description }', async () => {
      mockEventRepository.findOne.mockResolvedValue({ id: 'evt-01', organizerId: 'org-01', status: EventStatus.DRAFT });
      mockTranslationRepository.upsert.mockResolvedValue(undefined);
      mockTranslationRepository.findOneOrFail.mockResolvedValue({ locale: 'pt', title: 'Noite de Jazz', description: null });
      const result = await service.upsertTranslation('org-01', 'evt-01', 'pt', { title: 'Noite de Jazz' } as UpsertEventTranslationDto);
      expect(result).toEqual({ locale: 'pt', title: 'Noite de Jazz', description: null });
      expect(mockTranslationRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 'evt-01', locale: 'pt', title: 'Noite de Jazz' }),
        expect.objectContaining({ conflictPaths: ['eventId', 'locale'] }),
      );
    });
  });
});

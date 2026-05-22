// Wave 0 RED stubs — RsvpService does not yet exist. Imports below fail until Wave 2.
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RsvpEntity, RsvpState } from './rsvp.entity'; // RED: Wave 1 creates rsvp.entity
import { RsvpService } from './rsvp.service'; // RED: Wave 2 creates rsvp.service
import { EventEntity, EventStatus } from '../events/event.entity';

// Named mock repositories per CLAUDE.md: "Mock external I/O with named fake classes, not inline stubs"
const mockInsertQb = {
  into: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  orUpdate: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue(undefined),
};

const mockRsvpRepository = {
  createQueryBuilder: jest.fn().mockReturnValue({
    insert: jest.fn().mockReturnValue(mockInsertQb),
  }),
  count: jest.fn(),
  update: jest.fn(),
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
};

const mockEventRepository = {
  findOne: jest.fn(),
};

describe('RsvpService', () => {
  let service: RsvpService;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset createQueryBuilder for insert path
    mockRsvpRepository.createQueryBuilder.mockReturnValue({
      insert: jest.fn().mockReturnValue({
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        orUpdate: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      }),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RsvpService,
        { provide: getRepositoryToken(RsvpEntity), useValue: mockRsvpRepository },
        { provide: getRepositoryToken(EventEntity), useValue: mockEventRepository },
      ],
    }).compile();

    service = module.get<RsvpService>(RsvpService);
  });

  describe('upsertRsvp()', () => {
    it('calls repository insert().orUpdate() and returns fetched entity', async () => {
      const mockEvent = { id: 'evt-01', status: EventStatus.PUBLISHED } as EventEntity;
      const mockRsvp = {
        id: 'rsvp-01',
        state: RsvpState.INTERESTED,
        rsvpedAt: new Date('2026-01-01'),
      } as RsvpEntity;
      mockEventRepository.findOne.mockResolvedValue(mockEvent);
      mockRsvpRepository.findOneOrFail.mockResolvedValue(mockRsvp);

      const result = await service.upsertRsvp('user-01', 'evt-01', { state: RsvpState.INTERESTED });

      expect(result).toEqual({ id: 'rsvp-01', state: RsvpState.INTERESTED, rsvpedAt: mockRsvp.rsvpedAt });
      expect(mockRsvpRepository.findOneOrFail).toHaveBeenCalledWith({ where: { userId: 'user-01', eventId: 'evt-01' } });
    });

    it('throws NotFoundException when event does not exist', async () => {
      mockEventRepository.findOne.mockResolvedValue(null);

      await expect(
        service.upsertRsvp('user-01', 'evt-missing', { state: RsvpState.GOING }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws UnprocessableEntityException when event.status != PUBLISHED', async () => {
      const draftEvent = { id: 'evt-01', status: EventStatus.DRAFT } as EventEntity;
      mockEventRepository.findOne.mockResolvedValue(draftEvent);

      await expect(
        service.upsertRsvp('user-01', 'evt-01', { state: RsvpState.INTERESTED }),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('cancelRsvp()', () => {
    it('calls repository.update({ userId, eventId }, { state: CANCELLED }) and returns void', async () => {
      const mockRsvpRow = {
        id: 'rsvp-01',
        userId: 'user-01',
        eventId: 'evt-01',
        state: RsvpState.GOING,
      } as RsvpEntity;
      mockRsvpRepository.findOne.mockResolvedValue(mockRsvpRow);
      mockRsvpRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.cancelRsvp('user-01', 'evt-01');

      expect(result).toBeUndefined();
      expect(mockRsvpRepository.update).toHaveBeenCalledWith(
        { userId: 'user-01', eventId: 'evt-01' },
        { state: RsvpState.CANCELLED },
      );
    });

    it('throws NotFoundException when no RSVP row found', async () => {
      mockRsvpRepository.findOne.mockResolvedValue(null);

      await expect(service.cancelRsvp('user-01', 'evt-01')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listUserRsvps()', () => {
    it('returns paginated envelope { data, nextCursor, hasMore }', async () => {
      const mockRows: Array<RsvpEntity & { event: EventEntity }> = [];
      const listQb = {
        leftJoinAndMapOne: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockRows),
      };
      mockRsvpRepository.createQueryBuilder.mockReturnValue(listQb);

      const result = await service.listUserRsvps('user-01', {});

      expect(result).toEqual({ data: [], nextCursor: null, hasMore: false });
    });

    it('filters out CANCELLED RSVPs (WHERE state != CANCELLED)', async () => {
      const mockRows: Array<RsvpEntity & { event: EventEntity }> = [];
      const listQb = {
        leftJoinAndMapOne: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockRows),
      };
      mockRsvpRepository.createQueryBuilder.mockReturnValue(listQb);

      await service.listUserRsvps('user-01', {});

      // andWhere called with state != CANCELLED filter
      expect(listQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('state'),
        expect.objectContaining({ cancelled: RsvpState.CANCELLED }),
      );
    });

    it('with cursor decodes and applies < comparison', async () => {
      const cursor = Buffer.from('2026-01-01T00:00:00.000Z__rsvp-01').toString('base64url');
      const listQb = {
        leftJoinAndMapOne: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockRsvpRepository.createQueryBuilder.mockReturnValue(listQb);

      await service.listUserRsvps('user-01', { cursor });

      // Cursor triggers an andWhere with < comparison
      expect(listQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('<'),
        expect.any(Object),
      );
    });
  });

  describe('countByEventAndState()', () => {
    it('returns count from repository', async () => {
      mockRsvpRepository.count.mockResolvedValue(3);

      const result = await service.countByEventAndState('evt-01', RsvpState.INTERESTED);

      expect(result).toBe(3);
      expect(mockRsvpRepository.count).toHaveBeenCalledWith({ where: { eventId: 'evt-01', state: RsvpState.INTERESTED } });
    });
  });
});

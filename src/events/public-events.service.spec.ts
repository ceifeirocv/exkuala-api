// Wave 0 RED stub — EventTranslationEntity does not exist yet.
// Tests for new EventsService methods (findPublished, findPublishedById) added in Wave 2.
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEntity, EventStatus } from './event.entity';
import { EventTranslationEntity } from './event-translation.entity'; // RED: file doesn't exist
import { EventsService } from './events.service';
import { PublicEventsQueryDto } from './dto/public-events-query.dto'; // RED: file doesn't exist

const makeQb = () => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue([]),
});

const mockEventRepository = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  softDelete: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockTranslationRepository = {
  upsert: jest.fn(),
  findOneOrFail: jest.fn(),
};

describe('EventsService — Phase 7 public methods', () => {
  let service: EventsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockEventRepository.createQueryBuilder.mockReturnValue(makeQb());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: getRepositoryToken(EventEntity), useValue: mockEventRepository },
        { provide: getRepositoryToken(EventTranslationEntity), useValue: mockTranslationRepository },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  describe('findPublished() (EVT-04, EVT-06, DISC-01, DISC-02, DISC-03)', () => {
    it('returns empty page when no published events exist', async () => {
      const result = await service.findPublished({} as PublicEventsQueryDto);
      expect(result).toEqual({ data: [], nextCursor: null, hasMore: false });
    });

    it('applies category slug filter when query.category is provided (DISC-01)', async () => {
      const qb = makeQb();
      mockEventRepository.createQueryBuilder.mockReturnValue(qb);
      await service.findPublished({ category: 'music' } as PublicEventsQueryDto);
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('slug'),
        expect.objectContaining({ slug: 'music' }),
      );
    });

    it('applies city prefix filter using LOWER LIKE when query.city is provided (DISC-03)', async () => {
      const qb = makeQb();
      mockEventRepository.createQueryBuilder.mockReturnValue(qb);
      await service.findPublished({ city: 'Praia' } as PublicEventsQueryDto);
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('LOWER'),
        expect.objectContaining({ city: 'Praia' }),
      );
    });

    it('applies plainto_tsquery filter when query.q is provided (DISC-04)', async () => {
      const qb = makeQb();
      mockEventRepository.createQueryBuilder.mockReturnValue(qb);
      await service.findPublished({ q: 'jazz night' } as PublicEventsQueryDto);
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('plainto_tsquery'),
        expect.objectContaining({ q: 'jazz night' }),
      );
    });

    it('applies date range filters when start and end provided (DISC-02)', async () => {
      const qb = makeQb();
      mockEventRepository.createQueryBuilder.mockReturnValue(qb);
      await service.findPublished({ start: '2026-01-01', end: '2026-12-31' } as PublicEventsQueryDto);
      const andWhereCalls = qb.andWhere.mock.calls.map((c: unknown[]) => c[0]);
      expect(andWhereCalls.some((c: unknown) => typeof c === 'string' && c.includes('startAt') && c.includes('>=')))
        .toBe(true);
      expect(andWhereCalls.some((c: unknown) => typeof c === 'string' && c.includes('startAt') && c.includes('<=')))
        .toBe(true);
    });

    it('decodes and applies cursor when query.cursor is provided (EVT-06)', async () => {
      const qb = makeQb();
      mockEventRepository.createQueryBuilder.mockReturnValue(qb);
      const cursor = Buffer.from('2026-01-01T00:00:00.000Z__evt-01').toString('base64url');
      await service.findPublished({ cursor } as PublicEventsQueryDto);
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('startAt'),
        expect.objectContaining({ cursorId: 'evt-01' }),
      );
    });

    it('sets hasMore=true and encodes nextCursor when rows exceed limit', async () => {
      const qb = makeQb();
      const rows = Array.from({ length: 21 }, (_, i) => ({
        id: `evt-${i}`,
        startAt: new Date('2026-09-15T20:00:00Z'),
        status: EventStatus.PUBLISHED,
        organizer: { id: 'org-01', name: 'Jazz Org' },
        category: null,
        translations: [],
      }));
      qb.getMany.mockResolvedValue(rows);
      mockEventRepository.createQueryBuilder.mockReturnValue(qb);
      const result = await service.findPublished({ limit: 20 } as PublicEventsQueryDto);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).not.toBeNull();
      expect(result.data).toHaveLength(20);
    });
  });

  describe('findPublishedById() (EVT-04, I18N-01)', () => {
    it('returns PublicEventDetailDto with translations map when event is published', async () => {
      mockEventRepository.findOne.mockResolvedValue({
        id: 'evt-01',
        title: 'Jazz Night',
        status: EventStatus.PUBLISHED,
        organizer: { id: 'org-01', name: 'Jazz Org', bio: null, contact: null },
        category: null,
        translations: [{ locale: 'pt', title: 'Noite de Jazz', description: null }],
      });
      const result = await service.findPublishedById('evt-01');
      expect(result.id).toBe('evt-01');
      expect(result.translations).toEqual({ pt: { title: 'Noite de Jazz', description: null } });
    });

    it('throws NotFoundException for non-published or non-existent events', async () => {
      mockEventRepository.findOne.mockResolvedValue(null);
      await expect(service.findPublishedById('draft-id')).rejects.toThrow(NotFoundException);
    });
  });
});

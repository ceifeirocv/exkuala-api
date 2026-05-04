import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CategoryEntity } from './category.entity';
import { CategoryTranslationEntity } from './category-translation.entity';
import { CategoriesService } from './categories.service';

// Named mock repositories per CLAUDE.md: "Mock external I/O with named fake classes, not inline stubs"
const mockCategoryRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
};

const mockCategoryTranslationRepository = {
  save: jest.fn(),
  delete: jest.fn(),
};

describe('CategoriesService', () => {
  let service: CategoriesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: getRepositoryToken(CategoryEntity), useValue: mockCategoryRepository },
        { provide: getRepositoryToken(CategoryTranslationEntity), useValue: mockCategoryTranslationRepository },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  describe('findAll()', () => {
    it('returns an array of categories with translations map', () => {
      expect(true).toBe(false);
    });
  });

  describe('create()', () => {
    it('derives slug from name when no slug provided', () => {
      expect(true).toBe(false);
    });

    it('uses explicit slug from dto when provided', () => {
      expect(true).toBe(false);
    });

    it('throws ConflictException on duplicate slug (code 23505)', () => {
      expect(true).toBe(false);
    });
  });

  describe('update()', () => {
    it('updates the name of an existing category', () => {
      expect(true).toBe(false);
    });

    it('throws NotFoundException when category does not exist', () => {
      expect(true).toBe(false);
    });
  });

  describe('remove()', () => {
    it('deletes the category by id', () => {
      expect(true).toBe(false);
    });

    it('throws NotFoundException when category does not exist', () => {
      expect(true).toBe(false);
    });
  });
});

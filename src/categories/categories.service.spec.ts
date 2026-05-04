import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
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
    it('returns an array of categories with translations map', async () => {
      const rawCategories = [
        { id: 'c1', name: 'Music', slug: 'music', translations: [{ locale: 'pt', name: 'Música' }] },
      ];
      mockCategoryRepository.find.mockResolvedValue(rawCategories);

      const result = await service.findAll();

      expect(result).toEqual([
        { id: 'c1', slug: 'music', name: 'Music', translations: { pt: 'Música' } },
      ]);
    });
  });

  describe('create()', () => {
    it('derives slug from name when no slug provided', async () => {
      const entity = { id: 'c1', name: 'Visual Arts', slug: 'visual-arts', translations: [] };
      mockCategoryRepository.create.mockReturnValue(entity);
      mockCategoryRepository.save.mockResolvedValue(entity);

      await service.create({ name: 'Visual Arts' });

      expect(mockCategoryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'visual-arts' }),
      );
    });

    it('uses explicit slug from dto when provided', async () => {
      const entity = { id: 'c2', name: 'Visual Arts', slug: 'visual-artes', translations: [] };
      mockCategoryRepository.create.mockReturnValue(entity);
      mockCategoryRepository.save.mockResolvedValue(entity);

      await service.create({ name: 'Visual Arts', slug: 'visual-artes' });

      expect(mockCategoryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'visual-artes' }),
      );
    });

    it('throws ConflictException on duplicate slug (code 23505)', async () => {
      const entity = { id: 'c3', name: 'Music', slug: 'music', translations: [] };
      mockCategoryRepository.create.mockReturnValue(entity);

      // Simulate PostgreSQL unique constraint violation
      const dbError = new QueryFailedError('INSERT', [], new Error('duplicate key'));
      (dbError as QueryFailedError & { code: string }).code = '23505';
      mockCategoryRepository.save.mockRejectedValue(dbError);

      await expect(service.create({ name: 'Music' })).rejects.toThrow(ConflictException);
      await expect(service.create({ name: 'Music' })).rejects.toThrow('music');
    });
  });

  describe('update()', () => {
    it('updates the name of an existing category', async () => {
      const existing = { id: 'c1', name: 'Music', slug: 'music', translations: [] };
      const updated = { ...existing, name: 'Rock Music' };
      mockCategoryRepository.findOne.mockResolvedValue(existing);
      mockCategoryRepository.save.mockResolvedValue(updated);

      await service.update('c1', { name: 'Rock Music' });

      expect(mockCategoryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Rock Music' }),
      );
    });

    it('throws NotFoundException when category does not exist', async () => {
      mockCategoryRepository.findOne.mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove()', () => {
    it('deletes the category by id', async () => {
      const existing = { id: 'c1', name: 'Music', slug: 'music', translations: [] };
      mockCategoryRepository.findOne.mockResolvedValue(existing);
      mockCategoryRepository.delete.mockResolvedValue({ affected: 1 });

      await service.remove('c1');

      expect(mockCategoryRepository.delete).toHaveBeenCalledWith({ id: 'c1' });
    });

    it('throws NotFoundException when category does not exist', async () => {
      mockCategoryRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});

import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { createId } from '@paralleldrive/cuid2';
import slugify from 'slugify';
import { CategoryEntity } from './category.entity';
import { CategoryTranslationEntity } from './category-translation.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryResponseItem } from './dto/category-response.dto';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @InjectRepository(CategoryEntity)
    private readonly categoryRepository: Repository<CategoryEntity>,
    @InjectRepository(CategoryTranslationEntity)
    private readonly translationRepository: Repository<CategoryTranslationEntity>,
  ) {}

  // Returns all categories with translations map assembled per D-10.
  // Uses find({ relations: ['translations'] }) — single LEFT JOIN query, avoids N+1 (RESEARCH.md Pitfall 3).
  async findAll(): Promise<CategoryResponseItem[]> {
    const categories = await this.categoryRepository.find({ relations: ['translations'] });
    return categories.map((cat) => this.toResponseItem(cat));
  }

  // Creates a category. Derives slug from name if not provided (D-01).
  // id is pre-generated because @BeforeInsert does NOT fire on upsert paths (RESEARCH.md Pitfall 2).
  // Catches PostgreSQL unique constraint violation (code 23505) and rethrows as 409 (D-03).
  async create(dto: CreateCategoryDto): Promise<CategoryResponseItem> {
    const slug = dto.slug ?? this.deriveSlug(dto.name);
    const entity = this.categoryRepository.create({ id: createId(), name: dto.name, slug });
    try {
      const saved = await this.categoryRepository.save(entity);
      return this.toResponseItem(saved);
    } catch (err) {
      if (err instanceof QueryFailedError && (err as QueryFailedError & { code: string }).code === '23505') {
        throw new ConflictException(`Slug '${slug}' is already taken`);
      }
      this.logger.error({ event: 'category_create_failed', slug, error: (err as Error).message });
      throw err;
    }
  }

  // Updates a category name. Slug is write-once — any slug in dto is ignored because
  // UpdateCategoryDto intentionally omits the slug field (D-02).
  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryResponseItem> {
    const category = await this.findOneOrThrow(id);
    if (dto.name !== undefined) {
      category.name = dto.name;
    }
    const saved = await this.categoryRepository.save(category);
    return this.toResponseItem(saved);
  }

  // Removes a category. CategoryTranslationEntity rows cascade-deleted by FK ON DELETE CASCADE.
  async remove(id: string): Promise<void> {
    await this.findOneOrThrow(id);
    await this.categoryRepository.delete({ id });
  }

  // Derives a URL-safe slug from a category name.
  // slugify(name, { lower: true, strict: true }) handles Unicode transliteration:
  // 'Música' → 'musica', 'Exposições' → 'exposicoes' — critical for Portuguese domain (RESEARCH.md Pattern 3).
  private deriveSlug(name: string): string {
    return slugify(name, { lower: true, strict: true });
  }

  private toResponseItem(cat: CategoryEntity): CategoryResponseItem {
    const translations = cat.translations
      ? Object.fromEntries(cat.translations.map((t) => [t.locale, t.name]))
      : {};
    return { id: cat.id, slug: cat.slug, name: cat.name, translations };
  }

  private async findOneOrThrow(id: string): Promise<CategoryEntity> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category with id '${id}' not found`);
    }
    return category;
  }
}

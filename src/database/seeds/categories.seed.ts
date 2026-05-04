import 'dotenv/config';
import { createId } from '@paralleldrive/cuid2';
import { AppDataSource } from '../data-source';
import { CategoryEntity } from '../../categories/category.entity';
import { CategoryTranslationEntity } from '../../categories/category-translation.entity';

/**
 * Standalone category seeder. Idempotent — safe to re-run.
 * Upserts categories on slug conflict; upserts translations on (categoryId, locale) conflict.
 *
 * Run via: pnpm seed:categories
 * Requires DATABASE_URL in .env (loaded via dotenv/config at top of file).
 *
 * Data: 10 cultural categories with English default names + Portuguese (pt) translations (D-13, D-14).
 */

interface SeedCategory {
  name: string;
  slug: string;
  translations: Array<{ locale: string; name: string }>;
}

const SEED_CATEGORIES: SeedCategory[] = [
  { name: 'Music', slug: 'music', translations: [{ locale: 'pt', name: 'Música' }] },
  { name: 'Theatre', slug: 'theatre', translations: [{ locale: 'pt', name: 'Teatro' }] },
  { name: 'Cinema', slug: 'cinema', translations: [{ locale: 'pt', name: 'Cinema' }] },
  { name: 'Dance', slug: 'dance', translations: [{ locale: 'pt', name: 'Dança' }] },
  { name: 'Visual Arts', slug: 'visual-arts', translations: [{ locale: 'pt', name: 'Artes Visuais' }] },
  { name: 'Festivals', slug: 'festivals', translations: [{ locale: 'pt', name: 'Festivais' }] },
  { name: 'Talks', slug: 'talks', translations: [{ locale: 'pt', name: 'Palestras' }] },
  { name: 'Workshops', slug: 'workshops', translations: [{ locale: 'pt', name: 'Workshops' }] },
  { name: 'Comedy', slug: 'comedy', translations: [{ locale: 'pt', name: 'Comédia' }] },
  { name: 'Exhibitions', slug: 'exhibitions', translations: [{ locale: 'pt', name: 'Exposições' }] },
];

async function seed(): Promise<void> {
  await AppDataSource.initialize();
  const catRepo = AppDataSource.getRepository(CategoryEntity);
  const transRepo = AppDataSource.getRepository(CategoryTranslationEntity);

  for (const data of SEED_CATEGORIES) {
    // Find-or-insert for categories: upsert updating id breaks FK on category_translations.
    // Insert only if slug does not already exist — idempotent on re-run.
    let saved = await catRepo.findOne({ where: { slug: data.slug } });
    if (!saved) {
      saved = catRepo.create({ id: createId(), name: data.name, slug: data.slug });
      await catRepo.save(saved);
    }

    for (const t of data.translations) {
      // Upsert on (categoryId, locale) — idempotent on re-run
      await transRepo.upsert(
        { id: createId(), categoryId: saved.id, locale: t.locale, name: t.name },
        { conflictPaths: ['categoryId', 'locale'] },
      );
    }
  }

  console.log(`Seeded ${SEED_CATEGORIES.length} categories.`);
  await AppDataSource.destroy();
}

seed().catch((err: Error) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});

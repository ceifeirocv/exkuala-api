import { createId } from '@paralleldrive/cuid2';
import {
  BeforeInsert,
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { CategoryEntity } from './category.entity';

// Unique constraint on (categoryId, locale) — one translation per locale per category (D-06)
@Entity('category_translations')
@Index(['categoryId', 'locale'], { unique: true })
export class CategoryTranslationEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  id: string;

  @Column({ type: 'varchar', length: 30 })
  categoryId: string;

  // Open varchar, any valid BCP-47 tag (D-07). Examples: 'pt', 'fr', 'en-US'
  @Column({ type: 'varchar', length: 10 })
  locale: string;

  // Locale-specific name override for the parent category (D-05)
  @Column({ type: 'varchar', length: 100 })
  name: string;

  // onDelete: CASCADE — translations removed automatically when parent category is deleted
  @ManyToOne(() => CategoryEntity, (cat) => cat.translations, { onDelete: 'CASCADE' })
  category: CategoryEntity;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = createId();
    }
  }
}

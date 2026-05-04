import { createId } from '@paralleldrive/cuid2';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CategoryTranslationEntity } from './category-translation.entity';

@Entity('categories')
export class CategoryEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  id: string;

  // Default (English) name — overrides per locale live in CategoryTranslationEntity (D-05)
  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  // URL-safe slug, write-once after creation (D-01, D-02). Pattern: ^[a-z0-9-]+$
  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // eager: false — only load translations when explicitly requested (avoid N+1, RESEARCH.md Pitfall 3)
  @OneToMany(() => CategoryTranslationEntity, (t) => t.category, { eager: false })
  translations: CategoryTranslationEntity[];

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = createId();
    }
  }
}

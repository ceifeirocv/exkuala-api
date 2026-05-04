import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates categories and category_translations tables.
 * Categories: managed reference list with unique name + slug (CAT-01).
 * CategoryTranslations: per-locale name overrides with (categoryId, locale) unique constraint (CAT-03, I18N-02).
 */
export class Categories1746000000000 implements MigrationInterface {
  name = 'Categories1746000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id"        varchar(30)  NOT NULL,
        "name"      varchar(100) NOT NULL,
        "slug"      varchar(100) NOT NULL,
        "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_categories" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_categories_name" UNIQUE ("name"),
        CONSTRAINT "UQ_categories_slug" UNIQUE ("slug")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "category_translations" (
        "id"         varchar(30)  NOT NULL,
        "categoryId" varchar(30)  NOT NULL,
        "locale"     varchar(10)  NOT NULL,
        "name"       varchar(100) NOT NULL,
        CONSTRAINT "PK_category_translations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_category_translations_category"
          FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_category_translations_cat_locale"
          UNIQUE ("categoryId", "locale")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop child table first — FK prevents dropping parent while child rows exist
    await queryRunner.query(`DROP TABLE "category_translations"`);
    await queryRunner.query(`DROP TABLE "categories"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

// Phase 6 migration: wire FK constraints onto the events table, make organizerId NOT NULL,
// and add indexes for ownership queries and cursor pagination (D-23, D-24, D-25).
export class EventsFk1748000000000 implements MigrationInterface {
  name = 'EventsFk1748000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Remove orphaned events with NULL organizerId.
    // These rows cannot satisfy the NOT NULL constraint below.
    // Deletion is safer than assigning a placeholder — no valid organizer to assign to (D-24).
    await queryRunner.query(`DELETE FROM "events" WHERE "organizerId" IS NULL`);

    // Step 2: Make organizerId NOT NULL.
    // Safe after step 1 — no NULL rows remain.
    await queryRunner.query(`
      ALTER TABLE "events"
      ALTER COLUMN "organizerId" SET NOT NULL
    `);

    // Step 3: Add FK constraint — organizerId → organizers(id) ON DELETE CASCADE.
    // Cascades ensure no orphaned events when an organizer is removed.
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD CONSTRAINT "fk_events_organizer_id"
      FOREIGN KEY ("organizerId")
      REFERENCES "organizers"("id")
      ON DELETE CASCADE
    `);

    // Step 4: Add FK constraint — categoryId → categories(id) ON DELETE SET NULL.
    // Categories are tags; removing a category should not remove events.
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD CONSTRAINT "fk_events_category_id"
      FOREIGN KEY ("categoryId")
      REFERENCES "categories"("id")
      ON DELETE SET NULL
    `);

    // Step 5: Index on organizerId — used by all ownership queries (WHERE organizerId = :id).
    await queryRunner.query(`
      CREATE INDEX "idx_events_organizer_id"
      ON "events" ("organizerId")
    `);

    // Step 6: Composite index on (startAt, id) — used by cursor pagination ORDER BY and WHERE.
    // The (startAt, id) row-value comparison in findOwned() benefits from this index.
    await queryRunner.query(`
      CREATE INDEX "idx_events_start_at_id"
      ON "events" ("startAt" ASC, "id" ASC)
    `);

    // Step 7: Index on status — used by optional ?status= filter in findOwned().
    await queryRunner.query(`
      CREATE INDEX "idx_events_status"
      ON "events" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse in opposite order of up()
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_events_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_events_start_at_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_events_organizer_id"`);
    await queryRunner.query(`
      ALTER TABLE "events"
      DROP CONSTRAINT IF EXISTS "fk_events_category_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "events"
      DROP CONSTRAINT IF EXISTS "fk_events_organizer_id"
    `);
    // Restore nullable organizerId (original state before Phase 6)
    await queryRunner.query(`
      ALTER TABLE "events"
      ALTER COLUMN "organizerId" DROP NOT NULL
    `);
  }
}

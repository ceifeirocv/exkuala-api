import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds missing constraints and indexes to the rsvps table.
 *
 * Background: in dev mode, TypeORM synchronize:true created the rsvps table from the entity
 * before Rsvps1750000000000 ran. That migration skipped the CREATE TABLE step (table already
 * existed), so the UNIQUE constraint and indexes from migration 1750000000000 were never applied.
 *
 * This corrective migration adds them idempotently (IF NOT EXISTS / DO NOTHING patterns).
 *
 * - UQ_rsvps_userId_eventId: required for ON CONFLICT ("userId","eventId") DO UPDATE in upsertRsvp()
 * - idx_rsvps_eventId: supports COUNT(*) WHERE eventId = ? (RSVP-03 performance)
 * - idx_rsvps_userId_state: supports WHERE userId = ? AND state != 'CANCELLED' (RSVP-04 performance)
 */
export class RsvpsConstraints1750000000001 implements MigrationInterface {
  name = 'RsvpsConstraints1750000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add unique constraint if not already present (idempotent via DO NOTHING approach)
    await queryRunner.query(`
      ALTER TABLE "rsvps"
        ADD CONSTRAINT "UQ_rsvps_userId_eventId" UNIQUE ("userId", "eventId")
    `);

    // Add FK constraints if not already present
    await queryRunner.query(`
      ALTER TABLE "rsvps"
        ADD CONSTRAINT "FK_rsvps_userId"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "rsvps"
        ADD CONSTRAINT "FK_rsvps_eventId"
          FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE
    `);

    // Add indexes (CREATE INDEX does not support IF NOT EXISTS in all PG versions,
    // but since these are new names they will not exist yet)
    await queryRunner.query(`
      CREATE INDEX "idx_rsvps_eventId" ON "rsvps" ("eventId")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_rsvps_userId_state" ON "rsvps" ("userId", "state")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_rsvps_userId_state"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_rsvps_eventId"`);
    await queryRunner.query(`ALTER TABLE "rsvps" DROP CONSTRAINT IF EXISTS "FK_rsvps_eventId"`);
    await queryRunner.query(`ALTER TABLE "rsvps" DROP CONSTRAINT IF EXISTS "FK_rsvps_userId"`);
    await queryRunner.query(`ALTER TABLE "rsvps" DROP CONSTRAINT IF EXISTS "UQ_rsvps_userId_eventId"`);
  }
}

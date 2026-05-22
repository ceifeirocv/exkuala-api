import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates rsvps table with:
 * - rsvp_state enum (D-04): INTERESTED | GOING | CANCELLED — single state column for both
 *   RSVP state and cancel state; no separate status/deletedAt column.
 * - UNIQUE constraint on (userId, eventId): upsert target for orUpdate() pattern (D-06).
 *   Ensures one row per user-event pair regardless of state transitions.
 * - rsvpedAt: set on INSERT via DEFAULT now(), never overwritten on UPDATE (insert-only semantics).
 *   The orUpdate() call in RsvpService explicitly excludes rsvpedAt from the conflict update list.
 * - CASCADE FK on userId → users.id: deleting a user removes their RSVPs.
 * - CASCADE FK on eventId → events.id: deleting an event removes its RSVPs.
 * - idx_rsvps_eventId: supports COUNT(*) WHERE eventId = ? for RSVP-03 live count queries.
 * - idx_rsvps_userId_state: supports WHERE userId = ? AND state != 'CANCELLED' for RSVP-04 history.
 */
export class Rsvps1750000000000 implements MigrationInterface {
  name = 'Rsvps1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Create enum type before the table that references it
    await queryRunner.query(`
      CREATE TYPE "rsvp_state" AS ENUM ('INTERESTED', 'GOING', 'CANCELLED')
    `);

    // Step 2: Create rsvps table
    await queryRunner.query(`
      CREATE TABLE "rsvps" (
        "id"        varchar(30)   NOT NULL,
        "userId"    varchar(30)   NOT NULL,
        "eventId"   varchar(30)   NOT NULL,
        "state"     "rsvp_state"  NOT NULL,
        "rsvpedAt"  TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "createdAt" TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rsvps" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_rsvps_userId_eventId" UNIQUE ("userId", "eventId"),
        CONSTRAINT "FK_rsvps_userId"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_rsvps_eventId"
          FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE
      )
    `);

    // Step 3: Index for COUNT(*) WHERE eventId = ? (RSVP-03 performance)
    await queryRunner.query(`
      CREATE INDEX "idx_rsvps_eventId" ON "rsvps" ("eventId")
    `);

    // Step 4: Index for WHERE userId = ? AND state != 'CANCELLED' (RSVP-04 history performance)
    await queryRunner.query(`
      CREATE INDEX "idx_rsvps_userId_state" ON "rsvps" ("userId", "state")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse in opposite order of up()
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_rsvps_userId_state"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_rsvps_eventId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rsvps"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "rsvp_state"`);
  }
}

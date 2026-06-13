import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates event_audit_log table and adds adminUserId to organizer_audit_log.
 * event_audit_log mirrors organizer_audit_log schema with eventId FK and extended action enum.
 * organizer_audit_log.adminUserId is nullable — existing rows predate Phase 9 (D-12, Pitfall 5).
 */
export class AdminAuditLog1751000000001 implements MigrationInterface {
  name = 'AdminAuditLog1751000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "event_audit_action" AS ENUM ('suspended', 'restored', 'removed')
    `);
    await queryRunner.query(`
      CREATE TABLE "event_audit_log" (
        "id"           varchar(30)            NOT NULL,
        "eventId"      varchar(30)            NOT NULL,
        "action"       "event_audit_action"   NOT NULL,
        "note"         varchar(2000)          NULL,
        "adminUserId"  varchar(30)            NULL,
        "createdAt"    TIMESTAMPTZ            NOT NULL DEFAULT now(),
        CONSTRAINT "PK_event_audit_log" PRIMARY KEY ("id"),
        CONSTRAINT "FK_event_audit_log_event"
          FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_event_audit_log_admin"
          FOREIGN KEY ("adminUserId") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_event_audit_log_eventId" ON "event_audit_log" ("eventId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_event_audit_log_createdAt" ON "event_audit_log" ("createdAt")
    `);
    // Add adminUserId to organizer_audit_log — nullable for existing rows (D-12, Pitfall 5: no backfill)
    await queryRunner.query(`
      ALTER TABLE "organizer_audit_log"
      ADD COLUMN IF NOT EXISTS "adminUserId" varchar(30) NULL
        REFERENCES "users"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse in inverse order: child constraints first, then tables, then types
    await queryRunner.query(`ALTER TABLE "organizer_audit_log" DROP COLUMN IF EXISTS "adminUserId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_event_audit_log_createdAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_event_audit_log_eventId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "event_audit_log"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "event_audit_action"`);
  }
}

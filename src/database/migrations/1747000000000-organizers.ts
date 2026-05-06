import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates organizers and organizer_audit_log tables.
 * Organizers: one-per-user application with status lifecycle (ORG-01, ORG-02).
 * AuditLog: immutable approve/reject history with optional admin note (D-13).
 * FK constraint: organizers.userId → users.id ON DELETE CASCADE (D-08).
 * FK constraint: organizer_audit_log.organizerId → organizers.id ON DELETE CASCADE.
 */
export class Organizers1747000000000 implements MigrationInterface {
  name = 'Organizers1747000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types before tables that reference them
    await queryRunner.query(`
      CREATE TYPE "organizer_status" AS ENUM ('pending', 'approved', 'rejected')
    `);
    await queryRunner.query(`
      CREATE TYPE "organizer_audit_action" AS ENUM ('approved', 'rejected')
    `);
    await queryRunner.query(`
      CREATE TABLE "organizers" (
        "id"          varchar(30)            NOT NULL,
        "userId"      varchar(30)            NOT NULL,
        "name"        varchar(200)           NOT NULL,
        "description" varchar(2000)          NOT NULL,
        "email"       varchar(254)           NOT NULL,
        "website"     varchar(2048)          NULL,
        "socialLinks" jsonb                  NULL,
        "status"      "organizer_status"     NOT NULL DEFAULT 'pending',
        "createdAt"   TIMESTAMPTZ            NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMPTZ            NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organizers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_organizers_userId" UNIQUE ("userId"),
        CONSTRAINT "FK_organizers_userId"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "organizer_audit_log" (
        "id"           varchar(30)              NOT NULL,
        "organizerId"  varchar(30)              NOT NULL,
        "action"       "organizer_audit_action" NOT NULL,
        "note"         varchar(2000)            NULL,
        "createdAt"    TIMESTAMPTZ              NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organizer_audit_log" PRIMARY KEY ("id"),
        CONSTRAINT "FK_audit_log_organizer"
          FOREIGN KEY ("organizerId") REFERENCES "organizers"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop child table first — FK prevents dropping parent while child rows exist
    await queryRunner.query(`DROP TABLE "organizer_audit_log"`);
    await queryRunner.query(`DROP TABLE "organizers"`);
    // Drop enum types after tables that referenced them are gone
    await queryRunner.query(`DROP TYPE "organizer_audit_action"`);
    await queryRunner.query(`DROP TYPE "organizer_status"`);
  }
}

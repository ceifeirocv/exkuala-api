import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline migration — squashes the entire schema from Phase 1 (Prisma) into a
 * single TypeORM migration. This replaces all previous Prisma migration history.
 *
 * Per D-03: existing prisma/migrations/ history is not carried forward.
 * This file is the single authoritative baseline for TypeORM schema management.
 */
export class Baseline1745000000000 implements MigrationInterface {
  name = 'Baseline1745000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create event_status enum type
    await queryRunner.query(
      `CREATE TYPE "public"."event_status" AS ENUM('DRAFT', 'PUBLISHED', 'CANCELLED')`,
    );

    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"        varchar(30)  NOT NULL,
        "auth0Id"   varchar(128) NOT NULL,
        "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_auth0Id" UNIQUE ("auth0Id")
      )
    `);

    // Create events table
    await queryRunner.query(`
      CREATE TABLE "events" (
        "id"                varchar(30)                    NOT NULL,
        "title"             varchar(200)                   NOT NULL,
        "description"       varchar(5000)                  NULL,
        "startAt"           TIMESTAMPTZ                    NOT NULL,
        "endAt"             TIMESTAMPTZ                    NULL,
        "venueName"         varchar(200)                   NULL,
        "address"           varchar(500)                   NULL,
        "categoryId"        varchar(30)                    NULL,
        "ticketPrice"       DECIMAL(10,2)                  NULL,
        "externalTicketUrl" varchar(2048)                  NULL,
        "status"            "public"."event_status"        NOT NULL DEFAULT 'DRAFT',
        "organizerId"       varchar(30)                    NULL,
        "deletedAt"         TIMESTAMPTZ                    NULL,
        "createdAt"         TIMESTAMPTZ                    NOT NULL DEFAULT now(),
        "updatedAt"         TIMESTAMPTZ                    NOT NULL DEFAULT now(),
        CONSTRAINT "PK_events" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "events"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."event_status"`);
  }
}

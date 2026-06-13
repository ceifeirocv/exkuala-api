import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extends event_status enum with SUSPENDED value and adds statusBeforeSuspension column.
 * ALTER TYPE ADD VALUE cannot run inside a transaction (PostgreSQL restriction).
 * transaction = false tells TypeORM to skip BEGIN/COMMIT for this migration (RESEARCH.md Pitfall 1).
 */
export class AdminEventStatus1751000000000 implements MigrationInterface {
  name = 'AdminEventStatus1751000000000';

  // PostgreSQL: ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
  public readonly transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "event_status" ADD VALUE IF NOT EXISTS 'SUSPENDED'
    `);
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN IF NOT EXISTS "statusBeforeSuspension" "event_status" NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support DROP VALUE from enum without full type recreate.
    // Drop column only; leave the enum value (safe — no rows will have it after rollback).
    await queryRunner.query(`
      ALTER TABLE "events" DROP COLUMN IF EXISTS "statusBeforeSuspension"
    `);
  }
}

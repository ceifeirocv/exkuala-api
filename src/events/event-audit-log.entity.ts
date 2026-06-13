import { createId } from '@paralleldrive/cuid2';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BeforeInsert, Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

// Immutable audit record — no UpdateDateColumn. Rows are never updated, only inserted.
export enum EventAuditAction {
  SUSPENDED = 'suspended',
  RESTORED = 'restored',
  REMOVED = 'removed',
}

@Entity('event_audit_log')
export class EventAuditLogEntity {
  @ApiProperty()
  @PrimaryColumn({ type: 'varchar', length: 30 })
  id: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 30, name: 'eventId' })
  eventId: string;

  // enumName prevents TypeORM auto-generated name collision with 'organizer_audit_action'
  @ApiProperty({ enum: EventAuditAction })
  @Column({
    type: 'enum',
    enum: EventAuditAction,
    enumName: 'event_audit_action',
  })
  action: EventAuditAction;

  // Optional admin note explaining the decision. varchar(2000) matches SEC-01 constraint.
  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', length: 2000, nullable: true })
  note: string | null;

  // adminUserId — which admin acted. NOT NULL for new rows (Phase 9+); nullable at DB for FK SET NULL.
  // name: 'adminUserId' matches migration DDL to prevent TypeORM sync drift (Phase 7 lesson).
  @ApiProperty()
  @Column({ type: 'varchar', length: 30, name: 'adminUserId' })
  adminUserId: string;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  // id pre-generated at construction time — repository.insert() skips @BeforeInsert
  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = createId();
    }
  }
}

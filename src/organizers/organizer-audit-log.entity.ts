import { createId } from '@paralleldrive/cuid2';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BeforeInsert, Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

// Immutable audit record — no UpdateDateColumn. Rows are never updated, only inserted.
export enum OrganizerAuditAction {
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('organizer_audit_log')
export class OrganizerAuditLogEntity {
  @ApiProperty()
  @PrimaryColumn({ type: 'varchar', length: 30 })
  id: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 30 })
  organizerId: string;

  // enumName prevents TypeORM auto-generated name collision (RESEARCH.md Pitfall 1)
  @ApiProperty({ enum: OrganizerAuditAction })
  @Column({
    type: 'enum',
    enum: OrganizerAuditAction,
    enumName: 'organizer_audit_action',
  })
  action: OrganizerAuditAction;

  // Optional admin note explaining the decision (D-13)
  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', length: 2000, nullable: true })
  note: string | null;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  // id also pre-generated at construction time via createId() in service (anti-pattern: don't use
  // repository.insert() for audit log rows — @BeforeInsert does not fire on bulk insert)
  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = createId();
    }
  }
}

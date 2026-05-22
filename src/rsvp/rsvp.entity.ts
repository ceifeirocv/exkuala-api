import { createId } from '@paralleldrive/cuid2';
import { ApiProperty } from '@nestjs/swagger';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum RsvpState {
  INTERESTED = 'INTERESTED',
  GOING = 'GOING',
  CANCELLED = 'CANCELLED',
}

/**
 * RSVP row: one per (userId, eventId) pair.
 * State transitions: INTERESTED ↔ GOING (upsert), either → CANCELLED (logical cancel).
 * rsvpedAt is set on INSERT only — never overwritten on state update (@CreateDateColumn semantics).
 * Physical rows are never deleted; cancel sets state = CANCELLED.
 */
@Entity('rsvps')
export class RsvpEntity {
  @ApiProperty()
  @PrimaryColumn({ type: 'varchar', length: 30 })
  id: string;

  // FK → users.id (scalar only — no @ManyToOne relation property)
  @ApiProperty()
  @Column({ type: 'varchar', length: 30 })
  userId: string;

  // FK → events.id (scalar only — no @ManyToOne relation property)
  @ApiProperty()
  @Column({ type: 'varchar', length: 30 })
  eventId: string;

  // enumName is REQUIRED to prevent TypeORM auto-generated name collision (RESEARCH.md pitfall)
  @ApiProperty({ enum: RsvpState })
  @Column({ type: 'enum', enum: RsvpState, enumName: 'rsvp_state' })
  state: RsvpState;

  // @CreateDateColumn: set on INSERT, never updated on subsequent PATCH/UPDATE (D-08 of 08-CONTEXT.md).
  // This preserves the original RSVP timestamp even when the user changes state (INTERESTED → GOING).
  @ApiProperty()
  @CreateDateColumn()
  rsvpedAt: Date;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = createId();
    }
  }
}

import { createId } from '@paralleldrive/cuid2';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum OrganizerStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('organizers')
export class OrganizerEntity {
  @ApiProperty()
  @PrimaryColumn({ type: 'varchar', length: 30 })
  id: string;

  // 1:1 FK to users.id — unique constraint enforces one organizer profile per user (D-08)
  @ApiProperty()
  @Column({ type: 'varchar', length: 30, unique: true })
  userId: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 200 })
  name: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 2000 })
  description: string;

  // Business contact email — manually entered, not pulled from Auth0 (D-01)
  @ApiProperty()
  @Column({ type: 'varchar', length: 254 })
  email: string;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', length: 2048, nullable: true })
  website: string | null;

  // Open map — any key accepted, no platform allowlist (D-02)
  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  socialLinks: Record<string, string> | null;

  // enumName prevents TypeORM auto-generated name collision (RESEARCH.md Pitfall 1)
  @ApiProperty({ enum: OrganizerStatus })
  @Column({
    type: 'enum',
    enum: OrganizerStatus,
    enumName: 'organizer_status',
    default: OrganizerStatus.PENDING,
  })
  status: OrganizerStatus;

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

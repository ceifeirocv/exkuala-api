import { createId } from '@paralleldrive/cuid2';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum EventStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CANCELLED = 'CANCELLED',
}

@Entity('events')
export class EventEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  id: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 5000, nullable: true })
  description: string | null;

  @Column({ type: 'timestamptz' })
  startAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endAt: Date | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  venueName: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  categoryId: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: {
      to: (v: number | null) => v,
      from: (v: string | null) => (v === null ? null : parseFloat(v)),
    },
  })
  ticketPrice: number | null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  externalTicketUrl: string | null;

  @Column({
    type: 'enum',
    enum: EventStatus,
    enumName: 'event_status',
    default: EventStatus.DRAFT,
  })
  status: EventStatus;

  @Column({ type: 'varchar', length: 30, nullable: true })
  organizerId: string | null;

  // @DeleteDateColumn enables TypeORM automatic soft-delete filtering:
  // - repository.softDelete(id) sets this column
  // - find() / findOne() automatically add WHERE deletedAt IS NULL
  // - use repository.find({ withDeleted: true }) to include soft-deleted rows
  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = createId();
    }
  }
}

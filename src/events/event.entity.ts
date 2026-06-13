import { createId } from '@paralleldrive/cuid2';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizerEntity } from '../organizers/organizer.entity';
import { CategoryEntity } from '../categories/category.entity';
import { EventTranslationEntity } from './event-translation.entity';

export enum EventStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CANCELLED = 'CANCELLED',
  SUSPENDED = 'SUSPENDED', // admin-only state (Phase 9 D-01)
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

  // Phase 7: deferred from Phase 6 (06-CONTEXT.md D-14)
  @Column({ type: 'varchar', length: 2048, nullable: true })
  imageUrl: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  // tsvector column — kept in sync by DB trigger (D-04), never written by TypeORM.
  // select: false prevents TypeORM from including it in default SELECT * queries.
  // name: 'search_vector' — migration uses snake_case; explicit name prevents TypeORM
  // synchronize from creating a separate searchVector column (camelCase default).
  @Column({ name: 'search_vector', type: 'tsvector', nullable: true, select: false })
  searchVector: unknown;

  @Column({
    type: 'enum',
    enum: EventStatus,
    enumName: 'event_status',
    default: EventStatus.DRAFT,
  })
  status: EventStatus;

  // Remembers pre-suspend status for admin restore (D-02, D-03).
  // nullable — only set when status is SUSPENDED; null on all other events.
  // name: 'statusBeforeSuspension' matches migration DDL to prevent TypeORM sync drift (Phase 7 lesson).
  @ApiPropertyOptional({ enum: EventStatus, nullable: true })
  @Column({
    type: 'enum',
    enum: EventStatus,
    enumName: 'event_status',
    nullable: true,
    name: 'statusBeforeSuspension',
  })
  statusBeforeSuspension: EventStatus | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  // TypeScript type is string (not null) per D-24: organizerId always set at create time.
  // The @Column keeps nullable: true until migration 06-03 applies the NOT NULL DB constraint (D-04).
  organizerId: string;

  // Relation properties are optional (?) — not eagerly loaded; callers must explicitly join.
  // Phase 6 service layer works with scalar organizerId/categoryId only.
  @ManyToOne(() => OrganizerEntity, { nullable: false })
  @JoinColumn({ name: 'organizerId' })
  organizer?: OrganizerEntity;

  @ManyToOne(() => CategoryEntity, { nullable: true })
  @JoinColumn({ name: 'categoryId' })
  category?: CategoryEntity;

  // eager: false — join translations explicitly when needed (avoids N+1 on organizer listing)
  @OneToMany(() => EventTranslationEntity, (t) => t.event, { eager: false })
  translations: EventTranslationEntity[];

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

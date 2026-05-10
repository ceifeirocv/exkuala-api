import { Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import { EventEntity } from './event.entity';

// Composite PK (eventId, locale) — no surrogate id per D-01 (07-CONTEXT.md).
// One translation per locale per event; upsert semantics on PUT endpoint (D-03).
@Entity('event_translations')
export class EventTranslationEntity {
  // varchar(30) matches EventEntity.id length (cuid2 output is ~24 chars)
  @PrimaryColumn({ type: 'varchar', length: 30 })
  eventId: string;

  // Open string — no enum, no DB check constraint (D-02)
  @PrimaryColumn({ type: 'varchar', length: 10 })
  locale: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 5000, nullable: true })
  description: string | null;

  // onDelete: CASCADE — translations removed when parent event is deleted
  @ManyToOne(() => EventEntity, (e) => e.translations, { onDelete: 'CASCADE' })
  event: EventEntity;
}

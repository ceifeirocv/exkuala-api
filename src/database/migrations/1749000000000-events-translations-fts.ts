import { MigrationInterface, QueryRunner } from 'typeorm';

// Phase 7 migration: add imageUrl/city/search_vector to events, create event_translations table,
// add GIN + city indexes, and wire tsvector auto-update triggers (D-04, D-05, D-06, D-07).
export class EventsTranslationsFts1749000000000 implements MigrationInterface {
  name = 'EventsTranslationsFts1749000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Add new columns to events table (D-08, D-10)
    // imageUrl: varchar(2048) — external URL only, no upload pipeline (SEC-01)
    // city: varchar(100) — free-text, organizer-entered, nullable
    // search_vector: tsvector — maintained by trigger (D-04), never written by app
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN "imageUrl" varchar(2048),
      ADD COLUMN "city"     varchar(100),
      ADD COLUMN "search_vector" tsvector
    `);

    // Step 2: Create event_translations table with composite PK (eventId, locale) per D-01, D-02.
    // CASCADE DELETE: translations removed automatically when parent event is soft-deleted
    // or hard-deleted. No orphan translations possible.
    await queryRunner.query(`
      CREATE TABLE "event_translations" (
        "eventId"     varchar(30)   NOT NULL,
        "locale"      varchar(10)   NOT NULL,
        "title"       varchar(200)  NOT NULL,
        "description" varchar(5000),
        CONSTRAINT "PK_event_translations" PRIMARY KEY ("eventId", "locale"),
        CONSTRAINT "FK_event_translations_event"
          FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE
      )
    `);

    // Step 3: GIN index on search_vector for full-text search (D-07).
    // GIN is optimal for tsvector — supports @@ operator efficiently.
    await queryRunner.query(`
      CREATE INDEX "idx_events_search_vector"
      ON "events" USING GIN ("search_vector")
    `);

    // Step 4: Functional index on city for case-insensitive LIKE prefix filter (D-09).
    // LOWER(city) index makes "WHERE LOWER(city) LIKE LOWER(:city) || '%'" use the index.
    await queryRunner.query(`
      CREATE INDEX "idx_events_city"
      ON "events" (LOWER("city"))
    `);

    // Step 5: Create tsvector update function for the events table (D-04, D-05, D-06).
    // 'simple' config: no stemming, no stop words — correct for multilingual content.
    // Concatenates default title+description AND all event_translations rows for this event.
    // tsvector_agg() requires PostgreSQL 14+.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION events_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector :=
          to_tsvector('simple', COALESCE(NEW.title, '')) ||
          to_tsvector('simple', COALESCE(NEW.description, '')) ||
          (SELECT COALESCE(
            tsvector_agg(to_tsvector('simple',
              COALESCE(t.title, '') || ' ' || COALESCE(t.description, '')
            )),
            to_tsvector('simple', '')
          )
          FROM event_translations t WHERE t."eventId" = NEW.id);
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    // Step 6: Trigger on events INSERT or UPDATE to keep search_vector current (D-04).
    // BEFORE trigger so NEW.search_vector is set before the row is written.
    await queryRunner.query(`
      CREATE TRIGGER events_search_vector_trigger
      BEFORE INSERT OR UPDATE ON "events"
      FOR EACH ROW EXECUTE FUNCTION events_search_vector_update()
    `);

    // Step 7: Create tsvector update function for event_translations changes (D-04, D-06).
    // When a translation is inserted, updated, or deleted, we must re-compute the parent
    // event's search_vector to keep it consistent (translation content is part of the vector).
    // COALESCE(NEW.eventId, OLD.eventId) handles DELETE (NEW is null on delete).
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION event_translations_search_vector_update() RETURNS trigger AS $$
      DECLARE target_id varchar;
      BEGIN
        target_id := COALESCE(NEW."eventId", OLD."eventId");
        UPDATE "events" SET "search_vector" = (
          SELECT
            to_tsvector('simple', COALESCE(e.title, '')) ||
            to_tsvector('simple', COALESCE(e.description, '')) ||
            COALESCE(
              tsvector_agg(to_tsvector('simple',
                COALESCE(t.title, '') || ' ' || COALESCE(t.description, '')
              )),
              to_tsvector('simple', '')
            )
          FROM "events" e
          LEFT JOIN event_translations t ON t."eventId" = e.id
          WHERE e.id = target_id
          GROUP BY e.id, e.title, e.description
        )
        WHERE id = target_id;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    // Step 8: Trigger on event_translations INSERT, UPDATE, or DELETE (D-04).
    // AFTER trigger — translation row is already committed when parent update fires.
    await queryRunner.query(`
      CREATE TRIGGER event_translations_search_vector_trigger
      AFTER INSERT OR UPDATE OR DELETE ON "event_translations"
      FOR EACH ROW EXECUTE FUNCTION event_translations_search_vector_update()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse in opposite order of up() steps
    await queryRunner.query(`DROP TRIGGER IF EXISTS event_translations_search_vector_trigger ON "event_translations"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS event_translations_search_vector_update`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS events_search_vector_trigger ON "events"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS events_search_vector_update`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_events_city"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_events_search_vector"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "event_translations"`);
    await queryRunner.query(`
      ALTER TABLE "events"
      DROP COLUMN IF EXISTS "search_vector",
      DROP COLUMN IF EXISTS "city",
      DROP COLUMN IF EXISTS "imageUrl"
    `);
  }
}

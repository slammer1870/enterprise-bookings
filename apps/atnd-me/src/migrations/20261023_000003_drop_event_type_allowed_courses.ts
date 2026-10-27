import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Move paymentMethods.allowedCourses onto the course's allowedEventTypes, then
 * drop it from event types. The backup table remembers the old rows so down
 * can put them back and remove only the course links this migration added.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF to_regclass('public.event_types_rels') IS NULL THEN
        RETURN;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'event_types_rels'
          AND column_name = 'courses_id'
      ) THEN
        RETURN;
      END IF;

      CREATE TABLE IF NOT EXISTS "event_type_allowed_courses_backup" (
        "event_type_id" integer NOT NULL,
        "course_id" integer NOT NULL,
        "rel_order" integer,
        "added_to_course" boolean DEFAULT false NOT NULL
      );

      INSERT INTO "event_type_allowed_courses_backup" (
        "event_type_id",
        "course_id",
        "rel_order",
        "added_to_course"
      )
      SELECT rels.parent_id, rels.courses_id, rels."order", false
      FROM "event_types_rels" rels
      WHERE rels.path IN ('paymentMethods.allowedCourses', 'allowedCourses')
        AND rels.courses_id IS NOT NULL
        AND rels.parent_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "event_type_allowed_courses_backup" existing
          WHERE existing.event_type_id = rels.parent_id
            AND existing.course_id = rels.courses_id
        );

      IF to_regclass('public.courses_rels') IS NOT NULL THEN
        UPDATE "event_type_allowed_courses_backup" backup
        SET "added_to_course" = true
        WHERE NOT EXISTS (
          SELECT 1 FROM "courses_rels" course_rel
          WHERE course_rel.parent_id = backup.course_id
            AND course_rel.path = 'allowedEventTypes'
            AND course_rel.event_types_id = backup.event_type_id
        )
          AND EXISTS (SELECT 1 FROM "courses" course WHERE course.id = backup.course_id)
          AND EXISTS (
            SELECT 1 FROM "event_types" event_type WHERE event_type.id = backup.event_type_id
          );

        INSERT INTO "courses_rels" ("order", parent_id, path, event_types_id)
        SELECT
          COALESCE((
            SELECT MAX(existing."order")
            FROM "courses_rels" existing
            WHERE existing.parent_id = backup.course_id
              AND existing.path = 'allowedEventTypes'
          ), 0) + ROW_NUMBER() OVER (PARTITION BY backup.course_id ORDER BY backup.event_type_id),
          backup.course_id,
          'allowedEventTypes',
          backup.event_type_id
        FROM "event_type_allowed_courses_backup" backup
        WHERE backup.added_to_course = true
          AND EXISTS (SELECT 1 FROM "courses" course WHERE course.id = backup.course_id)
          AND EXISTS (SELECT 1 FROM "event_types" event_type WHERE event_type.id = backup.event_type_id);
      END IF;

      DELETE FROM "event_types_rels"
      WHERE path IN ('paymentMethods.allowedCourses', 'allowedCourses');
      ALTER TABLE "event_types_rels" DROP CONSTRAINT IF EXISTS "event_types_rels_courses_fk";
      DROP INDEX IF EXISTS "event_types_rels_courses_id_idx";
      ALTER TABLE "event_types_rels" DROP COLUMN IF EXISTS "courses_id";
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF to_regclass('public.event_types_rels') IS NULL THEN
        RETURN;
      END IF;

      ALTER TABLE "event_types_rels" ADD COLUMN IF NOT EXISTS "courses_id" integer;

      IF to_regclass('public.courses') IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'event_types_rels_courses_fk'
      ) THEN
        ALTER TABLE "event_types_rels"
          ADD CONSTRAINT "event_types_rels_courses_fk"
          FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;

      CREATE INDEX IF NOT EXISTS "event_types_rels_courses_id_idx"
        ON "event_types_rels" USING btree ("courses_id");

      IF to_regclass('public.event_type_allowed_courses_backup') IS NULL THEN
        RETURN;
      END IF;

      INSERT INTO "event_types_rels" ("order", parent_id, path, courses_id)
      SELECT
        backup.rel_order,
        backup.event_type_id,
        'paymentMethods.allowedCourses',
        backup.course_id
      FROM "event_type_allowed_courses_backup" backup
      WHERE EXISTS (SELECT 1 FROM "courses" course WHERE course.id = backup.course_id)
        AND EXISTS (
          SELECT 1 FROM "event_types" event_type WHERE event_type.id = backup.event_type_id
        )
        AND NOT EXISTS (
          SELECT 1 FROM "event_types_rels" existing
          WHERE existing.parent_id = backup.event_type_id
            AND existing.path = 'paymentMethods.allowedCourses'
            AND existing.courses_id = backup.course_id
        );

      IF to_regclass('public.courses_rels') IS NOT NULL THEN
        DELETE FROM "courses_rels" course_rel
        USING "event_type_allowed_courses_backup" backup
        WHERE backup.added_to_course = true
          AND course_rel.parent_id = backup.course_id
          AND course_rel.path = 'allowedEventTypes'
          AND course_rel.event_types_id = backup.event_type_id;
      END IF;

      DROP TABLE "event_type_allowed_courses_backup";
    END $$;
  `)
}

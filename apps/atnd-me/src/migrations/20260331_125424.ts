import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DO $$ BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'timeslots'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'timeslots' AND column_name = 'date'
    ) THEN
      ALTER TABLE "timeslots" ALTER COLUMN "date" SET DEFAULT '2026-03-31T12:54:24.427Z';
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'lessons'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'date'
    ) THEN
      ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-03-31T12:54:24.427Z';
    END IF;
  END $$;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DO $$ BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'timeslots'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'timeslots' AND column_name = 'date'
    ) THEN
      ALTER TABLE "timeslots" ALTER COLUMN "date" SET DEFAULT '2026-03-29T20:27:33.768Z';
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'lessons'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'date'
    ) THEN
      ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-03-29T20:27:33.768Z';
    END IF;
  END $$;`)
}

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
      ALTER TABLE "timeslots" ALTER COLUMN "date" SET DEFAULT '2026-04-09T14:44:41.197Z';
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'lessons'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'date'
    ) THEN
      ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-04-09T14:44:41.197Z';
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
      ALTER TABLE "timeslots" ALTER COLUMN "date" SET DEFAULT '2026-04-09T14:43:19.614Z';
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'lessons'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'date'
    ) THEN
      ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-04-09T14:43:19.614Z';
    END IF;
  END $$;`)
}

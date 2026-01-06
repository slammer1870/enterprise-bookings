import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-12-05T18:31:20.195Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-12-05T18:31:20.195Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-12-05T18:31:20.195Z';
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'scheduler_week_days_time_slot'
        AND column_name = 'active'
    ) THEN
      ALTER TABLE "scheduler_week_days_time_slot" ADD COLUMN "active" boolean DEFAULT true;
    END IF;
  END $$;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-11-25T19:19:47.014Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-11-25T19:19:47.014Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-11-25T19:19:47.014Z';
  ALTER TABLE "scheduler_week_days_time_slot" DROP COLUMN IF EXISTS "active";`)
}

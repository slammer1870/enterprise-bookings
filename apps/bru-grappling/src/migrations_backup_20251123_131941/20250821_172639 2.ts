import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_hero" ALTER COLUMN "secondary_button_text" DROP NOT NULL;
  ALTER TABLE "pages_blocks_hero" ALTER COLUMN "secondary_button_link" DROP NOT NULL;
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-08-21T17:26:39.032Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-08-21T17:26:39.032Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-08-21T17:26:39.032Z';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_hero" ALTER COLUMN "secondary_button_text" SET NOT NULL;
  ALTER TABLE "pages_blocks_hero" ALTER COLUMN "secondary_button_link" SET NOT NULL;
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-08-16T20:20:24.679Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-08-16T20:20:24.680Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-08-16T20:20:24.680Z';`)
}

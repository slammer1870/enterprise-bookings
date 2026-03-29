import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-01-20T20:06:12.106Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2026-01-20T20:06:12.276Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2026-01-20T20:06:12.276Z';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-01-15T13:58:28.335Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2026-01-15T13:58:28.432Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2026-01-15T13:58:28.432Z';`)
}

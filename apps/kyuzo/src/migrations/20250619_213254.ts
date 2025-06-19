import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-06-19T21:32:53.922Z';
  ALTER TABLE "scheduler_schedule_monday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-06-19T21:32:54.073Z';
  ALTER TABLE "scheduler_schedule_monday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-06-19T21:32:54.073Z';
  ALTER TABLE "scheduler_schedule_tuesday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-06-19T21:32:54.073Z';
  ALTER TABLE "scheduler_schedule_tuesday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-06-19T21:32:54.073Z';
  ALTER TABLE "scheduler_schedule_wednesday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-06-19T21:32:54.073Z';
  ALTER TABLE "scheduler_schedule_wednesday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-06-19T21:32:54.073Z';
  ALTER TABLE "scheduler_schedule_thursday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-06-19T21:32:54.073Z';
  ALTER TABLE "scheduler_schedule_thursday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-06-19T21:32:54.073Z';
  ALTER TABLE "scheduler_schedule_friday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-06-19T21:32:54.073Z';
  ALTER TABLE "scheduler_schedule_friday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-06-19T21:32:54.073Z';
  ALTER TABLE "scheduler_schedule_saturday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-06-19T21:32:54.073Z';
  ALTER TABLE "scheduler_schedule_saturday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-06-19T21:32:54.073Z';
  ALTER TABLE "scheduler_schedule_sunday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-06-19T21:32:54.073Z';
  ALTER TABLE "scheduler_schedule_sunday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-06-19T21:32:54.073Z';
  ALTER TABLE "scheduler" ALTER COLUMN "start_date" SET DEFAULT '2025-06-19T21:32:54.073Z';
  ALTER TABLE "scheduler" ALTER COLUMN "end_date" SET DEFAULT '2025-06-19T21:32:54.073Z';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-06-19T15:15:03.131Z';
  ALTER TABLE "scheduler_schedule_monday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-06-19T15:15:03.279Z';
  ALTER TABLE "scheduler_schedule_monday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-06-19T15:15:03.279Z';
  ALTER TABLE "scheduler_schedule_tuesday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-06-19T15:15:03.279Z';
  ALTER TABLE "scheduler_schedule_tuesday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-06-19T15:15:03.279Z';
  ALTER TABLE "scheduler_schedule_wednesday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-06-19T15:15:03.279Z';
  ALTER TABLE "scheduler_schedule_wednesday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-06-19T15:15:03.279Z';
  ALTER TABLE "scheduler_schedule_thursday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-06-19T15:15:03.279Z';
  ALTER TABLE "scheduler_schedule_thursday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-06-19T15:15:03.279Z';
  ALTER TABLE "scheduler_schedule_friday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-06-19T15:15:03.279Z';
  ALTER TABLE "scheduler_schedule_friday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-06-19T15:15:03.279Z';
  ALTER TABLE "scheduler_schedule_saturday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-06-19T15:15:03.279Z';
  ALTER TABLE "scheduler_schedule_saturday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-06-19T15:15:03.279Z';
  ALTER TABLE "scheduler_schedule_sunday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-06-19T15:15:03.279Z';
  ALTER TABLE "scheduler_schedule_sunday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-06-19T15:15:03.279Z';
  ALTER TABLE "scheduler" ALTER COLUMN "start_date" SET DEFAULT '2025-06-19T15:15:03.278Z';
  ALTER TABLE "scheduler" ALTER COLUMN "end_date" SET DEFAULT '2025-06-19T15:15:03.278Z';`)
}

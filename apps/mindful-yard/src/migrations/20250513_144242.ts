import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-05-13T14:42:41.712Z';
  ALTER TABLE "scheduler_schedule_monday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-05-13T14:42:41.723Z';
  ALTER TABLE "scheduler_schedule_monday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-05-13T14:42:41.723Z';
  ALTER TABLE "scheduler_schedule_tuesday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-05-13T14:42:41.723Z';
  ALTER TABLE "scheduler_schedule_tuesday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-05-13T14:42:41.723Z';
  ALTER TABLE "scheduler_schedule_wednesday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-05-13T14:42:41.723Z';
  ALTER TABLE "scheduler_schedule_wednesday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-05-13T14:42:41.723Z';
  ALTER TABLE "scheduler_schedule_thursday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-05-13T14:42:41.723Z';
  ALTER TABLE "scheduler_schedule_thursday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-05-13T14:42:41.723Z';
  ALTER TABLE "scheduler_schedule_friday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-05-13T14:42:41.723Z';
  ALTER TABLE "scheduler_schedule_friday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-05-13T14:42:41.723Z';
  ALTER TABLE "scheduler_schedule_saturday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-05-13T14:42:41.723Z';
  ALTER TABLE "scheduler_schedule_saturday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-05-13T14:42:41.723Z';
  ALTER TABLE "scheduler_schedule_sunday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-05-13T14:42:41.723Z';
  ALTER TABLE "scheduler_schedule_sunday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-05-13T14:42:41.723Z';
  ALTER TABLE "scheduler" ALTER COLUMN "start_date" SET DEFAULT '2025-05-13T14:42:41.723Z';
  ALTER TABLE "scheduler" ALTER COLUMN "end_date" SET DEFAULT '2025-05-13T14:42:41.723Z';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-04-30T19:42:38.320Z';
  ALTER TABLE "scheduler_schedule_monday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-04-30T19:42:38.330Z';
  ALTER TABLE "scheduler_schedule_monday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-04-30T19:42:38.330Z';
  ALTER TABLE "scheduler_schedule_tuesday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-04-30T19:42:38.330Z';
  ALTER TABLE "scheduler_schedule_tuesday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-04-30T19:42:38.330Z';
  ALTER TABLE "scheduler_schedule_wednesday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-04-30T19:42:38.330Z';
  ALTER TABLE "scheduler_schedule_wednesday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-04-30T19:42:38.330Z';
  ALTER TABLE "scheduler_schedule_thursday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-04-30T19:42:38.330Z';
  ALTER TABLE "scheduler_schedule_thursday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-04-30T19:42:38.330Z';
  ALTER TABLE "scheduler_schedule_friday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-04-30T19:42:38.330Z';
  ALTER TABLE "scheduler_schedule_friday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-04-30T19:42:38.330Z';
  ALTER TABLE "scheduler_schedule_saturday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-04-30T19:42:38.330Z';
  ALTER TABLE "scheduler_schedule_saturday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-04-30T19:42:38.330Z';
  ALTER TABLE "scheduler_schedule_sunday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-04-30T19:42:38.330Z';
  ALTER TABLE "scheduler_schedule_sunday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-04-30T19:42:38.330Z';
  ALTER TABLE "scheduler" ALTER COLUMN "start_date" SET DEFAULT '2025-04-30T19:42:38.330Z';
  ALTER TABLE "scheduler" ALTER COLUMN "end_date" SET DEFAULT '2025-04-30T19:42:38.330Z';`)
}

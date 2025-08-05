import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_class_options_type" AS ENUM('adult', 'child', 'family');
  CREATE TYPE "public"."enum_plans_type" AS ENUM('adult', 'child');
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-08-05T11:06:51.181Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-08-05T11:06:51.181Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-08-05T11:06:51.181Z';
  ALTER TABLE "lessons" ADD COLUMN "active" boolean DEFAULT true;
  ALTER TABLE "class_options" ADD COLUMN "type" "enum_class_options_type" DEFAULT 'adult' NOT NULL;
  ALTER TABLE "plans" ADD COLUMN "type" "enum_plans_type" DEFAULT 'adult';
  ALTER TABLE "plans" ADD COLUMN "quantity" numeric DEFAULT 1;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-07-25T19:56:35.596Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-07-25T19:56:35.596Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-07-25T19:56:35.596Z';
  ALTER TABLE "lessons" DROP COLUMN "active";
  ALTER TABLE "class_options" DROP COLUMN "type";
  ALTER TABLE "plans" DROP COLUMN "type";
  ALTER TABLE "plans" DROP COLUMN "quantity";
  DROP TYPE "public"."enum_class_options_type";
  DROP TYPE "public"."enum_plans_type";`)
}

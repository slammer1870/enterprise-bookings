import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_booking_transactions_payment_method" AS ENUM('stripe', 'class_pass');
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'syncStripeSubscriptions';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'syncStripeSubscriptions';
  CREATE TABLE "booking_transactions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"booking_id" integer NOT NULL,
  	"payment_method" "enum_booking_transactions_payment_method" NOT NULL,
  	"class_pass_id" numeric,
  	"stripe_payment_intent_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-01-27T19:00:08.519Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2026-01-27T19:00:08.707Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2026-01-27T19:00:08.707Z';
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "booking_transactions_id" integer;
  ALTER TABLE "booking_transactions" ADD CONSTRAINT "booking_transactions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "booking_transactions_booking_idx" ON "booking_transactions" USING btree ("booking_id");
  CREATE INDEX "booking_transactions_updated_at_idx" ON "booking_transactions" USING btree ("updated_at");
  CREATE INDEX "booking_transactions_created_at_idx" ON "booking_transactions" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_booking_transactions_fk" FOREIGN KEY ("booking_transactions_id") REFERENCES "public"."booking_transactions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_booking_transactions_id_idx" ON "payload_locked_documents_rels" USING btree ("booking_transactions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "booking_transactions" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "booking_transactions" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_booking_transactions_fk";
  
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'generateLessonsFromSchedule');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'generateLessonsFromSchedule');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "payload_locked_documents_rels_booking_transactions_id_idx";
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-01-23T07:10:19.125Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2026-01-23T07:10:19.235Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2026-01-23T07:10:19.235Z';
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "booking_transactions_id";
  DROP TYPE "public"."enum_booking_transactions_payment_method";`)
}

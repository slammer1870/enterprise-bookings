import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_booking_transactions_payment_method" AS ENUM('stripe', 'class_pass', 'subscription');
  CREATE TABLE "bookings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"booking_transactions_id" integer
  );
  
  CREATE TABLE "booking_transactions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"booking_id" integer NOT NULL,
  	"payment_method" "enum_booking_transactions_payment_method" NOT NULL,
  	"class_pass_id" numeric,
  	"stripe_payment_intent_id" varchar,
  	"subscription_id" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "transactions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_transactions_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_transactions_id_idx";
  DROP TABLE "transactions" CASCADE;
  ALTER TABLE "timeslots" ALTER COLUMN "date" SET DEFAULT '2026-02-11T20:06:19.183Z';
  ALTER TABLE "drop_ins" ALTER COLUMN "adjustable" SET DEFAULT true;
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2026-02-11T20:06:19.281Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2026-02-11T20:06:19.281Z';
  ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "sessions_information_allow_multiple_bookings_per_lesson" boolean DEFAULT false;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "booking_transactions_id" integer;
  ALTER TABLE "bookings_rels" ADD CONSTRAINT "bookings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "bookings_rels" ADD CONSTRAINT "bookings_rels_transactions_fk" FOREIGN KEY ("booking_transactions_id") REFERENCES "public"."booking_transactions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "booking_transactions" ADD CONSTRAINT "booking_transactions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "bookings_rels_order_idx" ON "bookings_rels" USING btree ("order");
  CREATE INDEX "bookings_rels_parent_idx" ON "bookings_rels" USING btree ("parent_id");
  CREATE INDEX "bookings_rels_path_idx" ON "bookings_rels" USING btree ("path");
  CREATE INDEX "bookings_rels_booking_transactions_id_idx" ON "bookings_rels" USING btree ("booking_transactions_id");
  CREATE INDEX "booking_transactions_booking_idx" ON "booking_transactions" USING btree ("booking_id");
  CREATE INDEX "booking_transactions_updated_at_idx" ON "booking_transactions" USING btree ("updated_at");
  CREATE INDEX "booking_transactions_created_at_idx" ON "booking_transactions" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_transactions_fk" FOREIGN KEY ("booking_transactions_id") REFERENCES "public"."booking_transactions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_booking_transactions_id_idx" ON "payload_locked_documents_rels" USING btree ("booking_transactions_id");
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "transactions_id";
  DROP TYPE "public"."enum_transactions_currency";
  DROP TYPE "public"."enum_transactions_status";
  DROP TYPE "public"."enum_transactions_payment_method";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_transactions_currency" AS ENUM('EUR', 'USD');
  CREATE TYPE "public"."enum_transactions_status" AS ENUM('pending', 'completed', 'failed');
  CREATE TYPE "public"."enum_transactions_payment_method" AS ENUM('cash', 'card');
  CREATE TABLE "transactions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"amount" numeric NOT NULL,
  	"currency" "enum_transactions_currency" DEFAULT 'EUR' NOT NULL,
  	"status" "enum_transactions_status" NOT NULL,
  	"payment_method" "enum_transactions_payment_method" NOT NULL,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "bookings_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "booking_transactions" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "bookings_rels" CASCADE;
  DROP TABLE "booking_transactions" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_transactions_fk";
  
  DROP INDEX "payload_locked_documents_rels_booking_transactions_id_idx";
  ALTER TABLE "timeslots" ALTER COLUMN "date" SET DEFAULT '2026-01-22T20:55:31.283Z';
  ALTER TABLE "drop_ins" ALTER COLUMN "adjustable" SET DEFAULT false;
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2026-01-22T20:55:31.425Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2026-01-22T20:55:31.425Z';
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "transactions_id" integer;
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "transactions_created_by_idx" ON "transactions" USING btree ("created_by_id");
  CREATE INDEX "transactions_updated_at_idx" ON "transactions" USING btree ("updated_at");
  CREATE INDEX "transactions_created_at_idx" ON "transactions" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_transactions_fk" FOREIGN KEY ("transactions_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_transactions_id_idx" ON "payload_locked_documents_rels" USING btree ("transactions_id");
  ALTER TABLE "plans" DROP COLUMN "sessions_information_allow_multiple_bookings_per_lesson";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "booking_transactions_id";
  DROP TYPE "public"."enum_booking_transactions_payment_method";`)
}

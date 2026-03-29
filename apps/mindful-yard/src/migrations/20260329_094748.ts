import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_transactions_payment_method" RENAME TO "enum_booking_transactions_payment_method";
  CREATE TABLE "bookings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"booking_transactions_id" integer
  );
  
  CREATE TABLE "users_role" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_users_role",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "users_stripe_customers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"stripe_account_id" varchar NOT NULL,
  	"stripe_customer_id" varchar NOT NULL
  );
  
  ALTER TABLE "transactions" RENAME TO "booking_transactions";
  ALTER TABLE "payload_locked_documents_rels" RENAME COLUMN "transactions_id" TO "booking_transactions_id";
  ALTER TABLE "bookings" DROP CONSTRAINT "bookings_transaction_id_transactions_id_fk";
  
  ALTER TABLE "booking_transactions" DROP CONSTRAINT "transactions_created_by_id_users_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_transactions_fk";
  
  ALTER TABLE "drop_ins_payment_methods" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_drop_ins_payment_methods";
  CREATE TYPE "public"."enum_drop_ins_payment_methods" AS ENUM('card');
  ALTER TABLE "drop_ins_payment_methods" ALTER COLUMN "value" SET DATA TYPE "public"."enum_drop_ins_payment_methods" USING "value"::"public"."enum_drop_ins_payment_methods";
  ALTER TABLE "booking_transactions" ALTER COLUMN "payment_method" SET DATA TYPE text;
  DROP TYPE "public"."enum_booking_transactions_payment_method";
  CREATE TYPE "public"."enum_booking_transactions_payment_method" AS ENUM('stripe', 'class_pass', 'subscription');
  ALTER TABLE "booking_transactions" ALTER COLUMN "payment_method" SET DATA TYPE "public"."enum_booking_transactions_payment_method" USING "payment_method"::"public"."enum_booking_transactions_payment_method";
  DROP INDEX "transactions_created_by_idx";
  DROP INDEX "transactions_updated_at_idx";
  DROP INDEX "transactions_created_at_idx";
  DROP INDEX "payload_locked_documents_rels_transactions_id_idx";
  ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL;
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-03-29T09:47:48.103Z';
  ALTER TABLE "drop_ins" ALTER COLUMN "adjustable" SET DEFAULT true;
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2026-03-29T09:47:48.227Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2026-03-29T09:47:48.227Z';
  ALTER TABLE "users" ADD COLUMN "stripe_customer_id" varchar DEFAULT '';
  ALTER TABLE "booking_transactions" ADD COLUMN "booking_id" integer NOT NULL;
  ALTER TABLE "booking_transactions" ADD COLUMN "class_pass_id" numeric;
  ALTER TABLE "booking_transactions" ADD COLUMN "stripe_payment_intent_id" varchar;
  ALTER TABLE "booking_transactions" ADD COLUMN "subscription_id" numeric;
  ALTER TABLE "bookings_rels" ADD CONSTRAINT "bookings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "bookings_rels" ADD CONSTRAINT "bookings_rels_transactions_fk" FOREIGN KEY ("booking_transactions_id") REFERENCES "public"."booking_transactions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_role" ADD CONSTRAINT "users_role_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  DO $$ BEGIN
    ALTER TABLE "users_stripe_customers" ADD CONSTRAINT "users_stripe_customers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END $$;
  CREATE INDEX "bookings_rels_order_idx" ON "bookings_rels" USING btree ("order");
  CREATE INDEX "bookings_rels_parent_idx" ON "bookings_rels" USING btree ("parent_id");
  CREATE INDEX "bookings_rels_path_idx" ON "bookings_rels" USING btree ("path");
  CREATE INDEX "bookings_rels_booking_transactions_id_idx" ON "bookings_rels" USING btree ("booking_transactions_id");
  CREATE INDEX "users_role_order_idx" ON "users_role" USING btree ("order");
  CREATE INDEX "users_role_parent_idx" ON "users_role" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "users_stripe_customers_order_idx" ON "users_stripe_customers" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "users_stripe_customers_parent_id_idx" ON "users_stripe_customers" USING btree ("_parent_id");
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_transaction_id_booking_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."booking_transactions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "booking_transactions" ADD CONSTRAINT "booking_transactions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_transactions_fk" FOREIGN KEY ("booking_transactions_id") REFERENCES "public"."booking_transactions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "accounts_access_token_expires_at_idx" ON "accounts" USING btree ("access_token_expires_at");
  CREATE INDEX "accounts_refresh_token_expires_at_idx" ON "accounts" USING btree ("refresh_token_expires_at");
  CREATE INDEX "verifications_expires_at_idx" ON "verifications" USING btree ("expires_at");
  CREATE INDEX "booking_transactions_booking_idx" ON "booking_transactions" USING btree ("booking_id");
  CREATE INDEX "booking_transactions_updated_at_idx" ON "booking_transactions" USING btree ("updated_at");
  CREATE INDEX "booking_transactions_created_at_idx" ON "booking_transactions" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_booking_transactions_id_idx" ON "payload_locked_documents_rels" USING btree ("booking_transactions_id");
  ALTER TABLE "users" DROP COLUMN "role";
  ALTER TABLE "booking_transactions" DROP COLUMN "amount";
  ALTER TABLE "booking_transactions" DROP COLUMN "currency";
  ALTER TABLE "booking_transactions" DROP COLUMN "status";
  ALTER TABLE "booking_transactions" DROP COLUMN "created_by_id";
  DROP TYPE "public"."enum_transactions_currency";
  DROP TYPE "public"."enum_transactions_status";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_transactions_currency" AS ENUM('EUR', 'USD');
  CREATE TYPE "public"."enum_transactions_status" AS ENUM('pending', 'completed', 'failed');
  ALTER TYPE "public"."enum_booking_transactions_payment_method" RENAME TO "enum_transactions_payment_method";
  ALTER TABLE "bookings_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "users_role" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "users_stripe_customers" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "bookings_rels" CASCADE;
  DROP TABLE "users_role" CASCADE;
  DROP TABLE "users_stripe_customers" CASCADE;
  ALTER TABLE "booking_transactions" RENAME TO "transactions";
  ALTER TABLE "payload_locked_documents_rels" RENAME COLUMN "booking_transactions_id" TO "transactions_id";
  ALTER TABLE "bookings" DROP CONSTRAINT "bookings_transaction_id_booking_transactions_id_fk";
  
  ALTER TABLE "transactions" DROP CONSTRAINT "booking_transactions_booking_id_bookings_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_transactions_fk";
  
  ALTER TABLE "drop_ins_payment_methods" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_drop_ins_payment_methods";
  CREATE TYPE "public"."enum_drop_ins_payment_methods" AS ENUM('cash');
  ALTER TABLE "drop_ins_payment_methods" ALTER COLUMN "value" SET DATA TYPE "public"."enum_drop_ins_payment_methods" USING "value"::"public"."enum_drop_ins_payment_methods";
  ALTER TABLE "transactions" ALTER COLUMN "payment_method" SET DATA TYPE text;
  DROP TYPE "public"."enum_transactions_payment_method";
  CREATE TYPE "public"."enum_transactions_payment_method" AS ENUM('cash', 'card');
  ALTER TABLE "transactions" ALTER COLUMN "payment_method" SET DATA TYPE "public"."enum_transactions_payment_method" USING "payment_method"::"public"."enum_transactions_payment_method";
  DROP INDEX "accounts_access_token_expires_at_idx";
  DROP INDEX "accounts_refresh_token_expires_at_idx";
  DROP INDEX "verifications_expires_at_idx";
  DROP INDEX "booking_transactions_booking_idx";
  DROP INDEX "booking_transactions_updated_at_idx";
  DROP INDEX "booking_transactions_created_at_idx";
  DROP INDEX "payload_locked_documents_rels_booking_transactions_id_idx";
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-01-20T20:13:16.977Z';
  ALTER TABLE "drop_ins" ALTER COLUMN "adjustable" SET DEFAULT false;
  ALTER TABLE "users" ALTER COLUMN "name" DROP NOT NULL;
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2026-01-20T20:13:17.080Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2026-01-20T20:13:17.080Z';
  ALTER TABLE "transactions" ADD COLUMN "amount" numeric NOT NULL;
  ALTER TABLE "transactions" ADD COLUMN "currency" "enum_transactions_currency" DEFAULT 'EUR' NOT NULL;
  ALTER TABLE "transactions" ADD COLUMN "status" "enum_transactions_status" NOT NULL;
  ALTER TABLE "transactions" ADD COLUMN "created_by_id" integer;
  ALTER TABLE "users" ADD COLUMN "role" "enum_users_role" DEFAULT 'customer' NOT NULL;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_transactions_fk" FOREIGN KEY ("transactions_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "transactions_created_by_idx" ON "transactions" USING btree ("created_by_id");
  CREATE INDEX "transactions_updated_at_idx" ON "transactions" USING btree ("updated_at");
  CREATE INDEX "transactions_created_at_idx" ON "transactions" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_transactions_id_idx" ON "payload_locked_documents_rels" USING btree ("transactions_id");
  ALTER TABLE "transactions" DROP COLUMN "booking_id";
  ALTER TABLE "transactions" DROP COLUMN "class_pass_id";
  ALTER TABLE "transactions" DROP COLUMN "stripe_payment_intent_id";
  ALTER TABLE "transactions" DROP COLUMN "subscription_id";
  ALTER TABLE "users" DROP COLUMN "stripe_customer_id";`)
}

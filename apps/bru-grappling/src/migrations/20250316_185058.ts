import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_transactions_currency" AS ENUM('EUR', 'USD');
  CREATE TYPE "public"."enum_transactions_status" AS ENUM('pending', 'completed', 'failed');
  CREATE TYPE "public"."enum_transactions_payment_method" AS ENUM('cash', 'card');
  CREATE TABLE IF NOT EXISTS "transactions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"amount" numeric NOT NULL,
  	"currency" "enum_transactions_currency" NOT NULL,
  	"status" "enum_transactions_status" NOT NULL,
  	"payment_method" "enum_transactions_payment_method" NOT NULL,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-03-16T18:50:58.561Z';
  ALTER TABLE "lessons" ADD COLUMN "instructor_id" integer;
  ALTER TABLE "bookings" ADD COLUMN "transaction_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "transactions_id" integer;
  DO $$ BEGIN
   ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "transactions_created_by_idx" ON "transactions" USING btree ("created_by_id");
  CREATE INDEX IF NOT EXISTS "transactions_updated_at_idx" ON "transactions" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "transactions_created_at_idx" ON "transactions" USING btree ("created_at");
  DO $$ BEGIN
   ALTER TABLE "lessons" ADD CONSTRAINT "lessons_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "bookings" ADD CONSTRAINT "bookings_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_transactions_fk" FOREIGN KEY ("transactions_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "lessons_instructor_idx" ON "lessons" USING btree ("instructor_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "class_options_name_idx" ON "class_options" USING btree ("name");
  CREATE INDEX IF NOT EXISTS "bookings_transaction_idx" ON "bookings" USING btree ("transaction_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_transactions_id_idx" ON "payload_locked_documents_rels" USING btree ("transactions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "transactions" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "transactions" CASCADE;
  ALTER TABLE "lessons" DROP CONSTRAINT "lessons_instructor_id_users_id_fk";
  
  ALTER TABLE "bookings" DROP CONSTRAINT "bookings_transaction_id_transactions_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_transactions_fk";
  
  DROP INDEX IF EXISTS "lessons_instructor_idx";
  DROP INDEX IF EXISTS "class_options_name_idx";
  DROP INDEX IF EXISTS "bookings_transaction_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_transactions_id_idx";
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-03-07T17:51:35.544Z';
  ALTER TABLE "lessons" DROP COLUMN IF EXISTS "instructor_id";
  ALTER TABLE "bookings" DROP COLUMN IF EXISTS "transaction_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "transactions_id";
  DROP TYPE "public"."enum_transactions_currency";
  DROP TYPE "public"."enum_transactions_status";
  DROP TYPE "public"."enum_transactions_payment_method";`)
}

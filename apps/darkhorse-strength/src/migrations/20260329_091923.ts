import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE IF NOT EXISTS "users_stripe_customers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"stripe_account_id" varchar NOT NULL,
  	"stripe_customer_id" varchar NOT NULL
  );

  DO $$ BEGIN
    ALTER TABLE "users_stripe_customers" ADD CONSTRAINT "users_stripe_customers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "users_stripe_customers_order_idx" ON "users_stripe_customers" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "users_stripe_customers_parent_id_idx" ON "users_stripe_customers" USING btree ("_parent_id");
  
  ALTER TABLE "timeslots" ALTER COLUMN "date" SET DEFAULT '2026-03-29T09:19:23.673Z';
  ALTER TABLE "plans" ALTER COLUMN "sessions_information_allow_multiple_bookings_per_lesson" SET NOT NULL;
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2026-03-29T09:19:23.797Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2026-03-29T09:19:23.797Z';
  DO $$ BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users_stripe_customers'
        AND column_name = 'stripe_account_id'
        AND is_nullable = 'YES'
    ) AND NOT EXISTS (
      SELECT 1 FROM "users_stripe_customers" WHERE "stripe_account_id" IS NULL LIMIT 1
    ) THEN
      ALTER TABLE "users_stripe_customers" ALTER COLUMN "stripe_account_id" SET NOT NULL;
    END IF;
  END $$;

  DO $$ BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users_stripe_customers'
        AND column_name = 'stripe_customer_id'
        AND is_nullable = 'YES'
    ) AND NOT EXISTS (
      SELECT 1 FROM "users_stripe_customers" WHERE "stripe_customer_id" IS NULL LIMIT 1
    ) THEN
      ALTER TABLE "users_stripe_customers" ALTER COLUMN "stripe_customer_id" SET NOT NULL;
    END IF;
  END $$;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DO $$ BEGIN
    ALTER TABLE "users_stripe_customers" DISABLE ROW LEVEL SECURITY;
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END $$;
  DROP TABLE IF EXISTS "users_stripe_customers" CASCADE;
  ALTER TABLE "timeslots" ALTER COLUMN "date" SET DEFAULT '2026-02-11T20:09:34.271Z';
  ALTER TABLE "plans" ALTER COLUMN "sessions_information_allow_multiple_bookings_per_lesson" DROP NOT NULL;
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2026-02-11T20:09:34.383Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2026-02-11T20:09:34.383Z';`)
}

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
  
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-03-30T10:50:16.037Z';
  ALTER TABLE "plans" ALTER COLUMN "sessions_information_allow_multiple_bookings_per_lesson" SET NOT NULL;
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2026-03-30T10:50:16.167Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2026-03-30T10:50:16.167Z';
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'users_stripe_customers_parent_id_fk'
    ) THEN
      ALTER TABLE "users_stripe_customers"
        ADD CONSTRAINT "users_stripe_customers_parent_id_fk"
        FOREIGN KEY ("_parent_id")
        REFERENCES "public"."users"("id")
        ON DELETE cascade
        ON UPDATE no action;
    END IF;
  END $$;
  CREATE INDEX IF NOT EXISTS "users_stripe_customers_order_idx" ON "users_stripe_customers" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "users_stripe_customers_parent_id_idx" ON "users_stripe_customers" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users_stripe_customers" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "users_stripe_customers" CASCADE;
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-02-11T20:07:55.792Z';
  ALTER TABLE "plans" ALTER COLUMN "sessions_information_allow_multiple_bookings_per_lesson" DROP NOT NULL;
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2026-02-11T20:07:55.901Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2026-02-11T20:07:55.901Z';`)
}

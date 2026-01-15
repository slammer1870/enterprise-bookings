import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'subscriptions_stripe_subscription_id_idx') THEN
     DROP INDEX "subscriptions_stripe_subscription_id_idx";
    END IF;
   EXCEPTION WHEN OTHERS THEN null;
   END $$;
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-11-25T19:19:47.043Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-11-25T19:19:47.043Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-11-25T19:19:47.043Z';
  DO $$ BEGIN
   IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lessons' AND column_name = 'active') THEN
    ALTER TABLE "lessons" ADD COLUMN "active" boolean DEFAULT true;
   END IF;
  EXCEPTION WHEN OTHERS THEN null;
  END $$;`)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-07-25T19:56:53.615Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-07-25T19:56:53.615Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-07-25T19:56:53.615Z';
  DO $$ BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'subscriptions_stripe_subscription_id_idx') THEN
    CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_idx" ON "subscriptions" USING btree ("stripe_subscription_id");
   END IF;
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  DO $$ BEGIN
   IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lessons' AND column_name = 'active') THEN
    ALTER TABLE "lessons" DROP COLUMN "active";
   END IF;
  EXCEPTION WHEN OTHERS THEN null;
  END $$;`)
}

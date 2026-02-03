import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Support subscription transactions: add 'subscription' to payment_method enum
 * and subscription_id column. When a booking is made by subscription, a transaction
 * is created with paymentMethod 'subscription' and subscriptionId.
 * Note: ALTER TYPE ADD VALUE cannot run inside a transaction/DO block; run as separate statement.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql`ALTER TYPE "enum_booking_transactions_payment_method" ADD VALUE IF NOT EXISTS 'subscription'`
  )
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_transactions') THEN
        ALTER TABLE "booking_transactions"
          ADD COLUMN IF NOT EXISTS "subscription_id" integer;
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscriptions') THEN
          ALTER TABLE "booking_transactions"
            DROP CONSTRAINT IF EXISTS "booking_transactions_subscription_id_subscriptions_id_fk";
          ALTER TABLE "booking_transactions"
            ADD CONSTRAINT "booking_transactions_subscription_id_subscriptions_id_fk"
            FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_transactions') THEN
        ALTER TABLE "booking_transactions"
          DROP CONSTRAINT IF EXISTS "booking_transactions_subscription_id_subscriptions_id_fk";
        ALTER TABLE "booking_transactions"
          DROP COLUMN IF EXISTS "subscription_id";
      END IF;
    END $$;
  `)
  /* Note: removing 'subscription' from the enum requires recreating the type; we leave it. */
}

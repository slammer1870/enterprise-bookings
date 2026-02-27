import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add Stripe Connect linkage fields to subscriptions:
 * - stripeAccountId (connected account)
 * - stripeCustomerId (customer on that connected account)
 *
 * These are additive + idempotent for rolling deploys.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "subscriptions"
      ADD COLUMN IF NOT EXISTS "stripe_account_id" varchar;

    ALTER TABLE "subscriptions"
      ADD COLUMN IF NOT EXISTS "stripe_customer_id" varchar;

    CREATE INDEX IF NOT EXISTS "subscriptions_stripe_account_id_idx"
      ON "subscriptions" USING btree ("stripe_account_id");

    CREATE INDEX IF NOT EXISTS "subscriptions_stripe_customer_id_idx"
      ON "subscriptions" USING btree ("stripe_customer_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "subscriptions_stripe_customer_id_idx";
    DROP INDEX IF EXISTS "subscriptions_stripe_account_id_idx";

    ALTER TABLE "subscriptions"
      DROP COLUMN IF EXISTS "stripe_customer_id";

    ALTER TABLE "subscriptions"
      DROP COLUMN IF EXISTS "stripe_account_id";
  `)
}


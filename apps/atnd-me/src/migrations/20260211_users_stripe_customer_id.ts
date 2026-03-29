import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add stripe_customer_id to users (from @repo/bookings-payments payments feature).
 * Required for subscription webhook to resolve user by Stripe customer id.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "stripe_customer_id" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users"
      DROP COLUMN IF EXISTS "stripe_customer_id";
  `)
}

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add Stripe Connect fields to tenants (step 2.1).
 * Columns: stripe_connect_account_id, stripe_connect_onboarding_status,
 * stripe_connect_last_error, stripe_connect_connected_at.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "stripe_connect_account_id" varchar UNIQUE,
      ADD COLUMN IF NOT EXISTS "stripe_connect_onboarding_status" varchar DEFAULT 'not_connected',
      ADD COLUMN IF NOT EXISTS "stripe_connect_last_error" varchar,
      ADD COLUMN IF NOT EXISTS "stripe_connect_connected_at" timestamp(3) with time zone;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants"
      DROP COLUMN IF EXISTS "stripe_connect_account_id",
      DROP COLUMN IF EXISTS "stripe_connect_onboarding_status",
      DROP COLUMN IF EXISTS "stripe_connect_last_error",
      DROP COLUMN IF EXISTS "stripe_connect_connected_at";
  `)
}

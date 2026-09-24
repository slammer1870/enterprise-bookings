import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Persist the charged class amount (after discounts, excluding booking fee)
 * so dashboard revenue can use what was actually paid.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "booking_transactions"
      ADD COLUMN IF NOT EXISTS "amount_cents" numeric;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "booking_transactions"
      DROP COLUMN IF EXISTS "amount_cents";
  `)
}

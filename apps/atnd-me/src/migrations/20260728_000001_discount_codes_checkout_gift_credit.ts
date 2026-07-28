import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Checkout gift-credit leftovers:
 * - source_payment_intent_id: remainder-child idempotency for class-pass Checkout
 * - last_consumed_idempotency_key: local consume without a hold (PI / subscription)
 * - gift_balance_credit_key: subscription customer-balance credit idempotency on parent
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "discount_codes" ADD COLUMN IF NOT EXISTS "source_payment_intent_id" varchar;
    ALTER TABLE "discount_codes" ADD COLUMN IF NOT EXISTS "last_consumed_idempotency_key" varchar;
    ALTER TABLE "discount_codes" ADD COLUMN IF NOT EXISTS "gift_balance_credit_key" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "discount_codes" DROP COLUMN IF EXISTS "source_payment_intent_id";
    ALTER TABLE "discount_codes" DROP COLUMN IF EXISTS "last_consumed_idempotency_key";
    ALTER TABLE "discount_codes" DROP COLUMN IF EXISTS "gift_balance_credit_key";
  `)
}

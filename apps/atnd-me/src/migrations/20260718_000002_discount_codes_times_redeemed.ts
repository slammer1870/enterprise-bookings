import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Local redemption tracking for drop-ins (Stripe max_redemptions is not applied on PaymentIntents).
 * Backfill: one-shot codes that already issued a remainder child are treated as consumed.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "discount_codes" ADD COLUMN IF NOT EXISTS "times_redeemed" numeric DEFAULT 0;
    ALTER TABLE "discount_codes" ADD COLUMN IF NOT EXISTS "last_consumed_hold_id" numeric;

    UPDATE "discount_codes" AS parent
    SET
      "times_redeemed" = GREATEST(COALESCE(parent."times_redeemed", 0), 1),
      "status" = 'archived'
    WHERE parent."max_redemptions" = 1
      AND parent."status" = 'active'
      AND EXISTS (
        SELECT 1
        FROM "discount_codes" AS child
        WHERE child."parent_discount_code_id" = parent."id"
      );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "discount_codes" DROP COLUMN IF EXISTS "times_redeemed";
    ALTER TABLE "discount_codes" DROP COLUMN IF EXISTS "last_consumed_hold_id";
  `)
}

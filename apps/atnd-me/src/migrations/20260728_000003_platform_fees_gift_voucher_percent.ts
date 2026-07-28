import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add gift voucher platform fee percent to platform-fees defaults and overrides.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "platform_fees"
      ADD COLUMN IF NOT EXISTS "defaults_gift_voucher_percent" numeric DEFAULT 3 NOT NULL;

    ALTER TABLE "platform_fees_overrides"
      ADD COLUMN IF NOT EXISTS "gift_voucher_percent" numeric;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "platform_fees_overrides"
      DROP COLUMN IF EXISTS "gift_voucher_percent";

    ALTER TABLE "platform_fees"
      DROP COLUMN IF EXISTS "defaults_gift_voucher_percent";
  `)
}

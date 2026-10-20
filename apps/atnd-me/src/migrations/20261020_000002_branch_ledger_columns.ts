import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Sale branch on gift-voucher discount codes, and breakage once an unused voucher expires.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "discount_codes" ADD COLUMN IF NOT EXISTS "branch_id" integer;
  ALTER TABLE "discount_codes" DROP CONSTRAINT IF EXISTS "discount_codes_branch_id_locations_id_fk";
  ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_branch_id_locations_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX IF NOT EXISTS "discount_codes_branch_idx" ON "discount_codes" USING btree ("branch_id");
  ALTER TABLE "discount_codes" ADD COLUMN IF NOT EXISTS "breakage_cents" numeric;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "discount_codes" DROP COLUMN IF EXISTS "breakage_cents";
  DROP INDEX IF EXISTS "discount_codes_branch_idx";
  ALTER TABLE "discount_codes" DROP CONSTRAINT IF EXISTS "discount_codes_branch_id_locations_id_fk";
  ALTER TABLE "discount_codes" DROP COLUMN IF EXISTS "branch_id";`)
}

import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Gift-voucher remainder lineage on discount_codes:
 * root_purchased_at, parent_discount_code_id, external_id, source_booking_id, source_hold_id
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "discount_codes" ADD COLUMN IF NOT EXISTS "root_purchased_at" timestamp(3) with time zone;
    ALTER TABLE "discount_codes" ADD COLUMN IF NOT EXISTS "parent_discount_code_id" integer;
    ALTER TABLE "discount_codes" ADD COLUMN IF NOT EXISTS "external_id" varchar;
    ALTER TABLE "discount_codes" ADD COLUMN IF NOT EXISTS "source_booking_id" numeric;
    ALTER TABLE "discount_codes" ADD COLUMN IF NOT EXISTS "source_hold_id" numeric;

    DO $$ BEGIN
      ALTER TABLE "discount_codes"
        ADD CONSTRAINT "discount_codes_parent_discount_code_id_discount_codes_id_fk"
        FOREIGN KEY ("parent_discount_code_id") REFERENCES "public"."discount_codes"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "discount_codes_parent_discount_code_idx"
      ON "discount_codes" USING btree ("parent_discount_code_id");
    CREATE INDEX IF NOT EXISTS "discount_codes_external_id_idx"
      ON "discount_codes" USING btree ("external_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "discount_codes" DROP CONSTRAINT IF EXISTS "discount_codes_parent_discount_code_id_discount_codes_id_fk";
    DROP INDEX IF EXISTS "discount_codes_parent_discount_code_idx";
    DROP INDEX IF EXISTS "discount_codes_external_id_idx";
    ALTER TABLE "discount_codes" DROP COLUMN IF EXISTS "root_purchased_at";
    ALTER TABLE "discount_codes" DROP COLUMN IF EXISTS "parent_discount_code_id";
    ALTER TABLE "discount_codes" DROP COLUMN IF EXISTS "external_id";
    ALTER TABLE "discount_codes" DROP COLUMN IF EXISTS "source_booking_id";
    ALTER TABLE "discount_codes" DROP COLUMN IF EXISTS "source_hold_id";
  `)
}

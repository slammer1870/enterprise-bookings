import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Class pass type price: use price_information_price (€) instead of price_information_price_cents,
 * matching memberships. Hook syncs from Stripe; class passes auto-fill price from type.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'class_pass_types') THEN
        ALTER TABLE "class_pass_types"
          ADD COLUMN IF NOT EXISTS "price_information_price" numeric;
        UPDATE "class_pass_types"
          SET "price_information_price" = "price_information_price_cents" / 100.0
          WHERE "price_information_price_cents" IS NOT NULL;
        ALTER TABLE "class_pass_types"
          DROP COLUMN IF EXISTS "price_information_price_cents";
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'class_pass_types') THEN
        ALTER TABLE "class_pass_types"
          ADD COLUMN IF NOT EXISTS "price_information_price_cents" numeric;
        UPDATE "class_pass_types"
          SET "price_information_price_cents" = "price_information_price" * 100.0
          WHERE "price_information_price" IS NOT NULL;
        ALTER TABLE "class_pass_types"
          DROP COLUMN IF EXISTS "price_information_price";
      END IF;
    END $$;
  `)
}

import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds the `giftVoucherCheckout` pages block
 * (apps/atnd-me/src/blocks/GiftVoucherCheckout).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "pages_blocks_gift_voucher_checkout" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "heading" varchar DEFAULT 'Buy a gift voucher',
      "min_amount" numeric DEFAULT 5,
      "max_amount" numeric,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_gift_voucher_checkout" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "heading" varchar DEFAULT 'Buy a gift voucher',
      "min_amount" numeric DEFAULT 5,
      "max_amount" numeric,
      "_uuid" varchar,
      "block_name" varchar
    );
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_gift_voucher_checkout"
        ADD CONSTRAINT "pages_blocks_gift_voucher_checkout_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_gift_voucher_checkout"
        ADD CONSTRAINT "_pages_v_blocks_gift_voucher_checkout_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "pages_blocks_gift_voucher_checkout_order_idx"
      ON "pages_blocks_gift_voucher_checkout" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_gift_voucher_checkout_parent_id_idx"
      ON "pages_blocks_gift_voucher_checkout" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_gift_voucher_checkout_path_idx"
      ON "pages_blocks_gift_voucher_checkout" USING btree ("_path");

    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_gift_voucher_checkout_order_idx"
      ON "_pages_v_blocks_gift_voucher_checkout" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_gift_voucher_checkout_parent_id_idx"
      ON "_pages_v_blocks_gift_voucher_checkout" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_gift_voucher_checkout_path_idx"
      ON "_pages_v_blocks_gift_voucher_checkout" USING btree ("_path");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "_pages_v_blocks_gift_voucher_checkout" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_gift_voucher_checkout" CASCADE;
  `)
}

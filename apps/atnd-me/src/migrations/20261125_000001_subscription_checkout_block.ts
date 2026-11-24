import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds the `subscriptionCheckout` pages block
 * (apps/atnd-me/src/blocks/SubscriptionCheckout).
 *
 * Default block (in defaultBlockSlugs) — no tenants_allowed_blocks enum change.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "pages_blocks_subscription_checkout" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "heading" varchar DEFAULT 'Memberships',
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_subscription_checkout_plans" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "plan_id" integer,
      "image_id" integer,
      "description" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_subscription_checkout" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "heading" varchar DEFAULT 'Memberships',
      "_uuid" varchar,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_subscription_checkout_plans" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "plan_id" integer,
      "image_id" integer,
      "description" varchar,
      "_uuid" varchar
    );
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_subscription_checkout"
        ADD CONSTRAINT "pages_blocks_subscription_checkout_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "pages_blocks_subscription_checkout_plans"
        ADD CONSTRAINT "pages_blocks_subscription_checkout_plans_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_subscription_checkout"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "pages_blocks_subscription_checkout_plans"
        ADD CONSTRAINT "pages_blocks_subscription_checkout_plans_plan_id_fk"
        FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "pages_blocks_subscription_checkout_plans"
        ADD CONSTRAINT "pages_blocks_subscription_checkout_plans_image_id_fk"
        FOREIGN KEY ("image_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_subscription_checkout"
        ADD CONSTRAINT "_pages_v_blocks_subscription_checkout_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_subscription_checkout_plans"
        ADD CONSTRAINT "_pages_v_blocks_subscription_checkout_plans_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_subscription_checkout"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_subscription_checkout_plans"
        ADD CONSTRAINT "_pages_v_blocks_subscription_checkout_plans_plan_id_fk"
        FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_subscription_checkout_plans"
        ADD CONSTRAINT "_pages_v_blocks_subscription_checkout_plans_image_id_fk"
        FOREIGN KEY ("image_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "pages_blocks_subscription_checkout_order_idx"
      ON "pages_blocks_subscription_checkout" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_subscription_checkout_parent_id_idx"
      ON "pages_blocks_subscription_checkout" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_subscription_checkout_path_idx"
      ON "pages_blocks_subscription_checkout" USING btree ("_path");

    CREATE INDEX IF NOT EXISTS "pages_blocks_subscription_checkout_plans_order_idx"
      ON "pages_blocks_subscription_checkout_plans" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_subscription_checkout_plans_parent_id_idx"
      ON "pages_blocks_subscription_checkout_plans" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_subscription_checkout_plans_plan_idx"
      ON "pages_blocks_subscription_checkout_plans" USING btree ("plan_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_subscription_checkout_plans_image_idx"
      ON "pages_blocks_subscription_checkout_plans" USING btree ("image_id");

    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_subscription_checkout_order_idx"
      ON "_pages_v_blocks_subscription_checkout" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_subscription_checkout_parent_id_idx"
      ON "_pages_v_blocks_subscription_checkout" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_subscription_checkout_path_idx"
      ON "_pages_v_blocks_subscription_checkout" USING btree ("_path");

    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_subscription_checkout_plans_order_idx"
      ON "_pages_v_blocks_subscription_checkout_plans" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_subscription_checkout_plans_parent_id_idx"
      ON "_pages_v_blocks_subscription_checkout_plans" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_subscription_checkout_plans_plan_idx"
      ON "_pages_v_blocks_subscription_checkout_plans" USING btree ("plan_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_subscription_checkout_plans_image_idx"
      ON "_pages_v_blocks_subscription_checkout_plans" USING btree ("image_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "_pages_v_blocks_subscription_checkout_plans" CASCADE;
    DROP TABLE IF EXISTS "_pages_v_blocks_subscription_checkout" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_subscription_checkout_plans" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_subscription_checkout" CASCADE;
  `)
}

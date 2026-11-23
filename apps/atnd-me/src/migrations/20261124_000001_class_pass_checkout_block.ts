import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds the `classPassCheckout` pages block
 * (apps/atnd-me/src/blocks/ClassPassCheckout).
 *
 * Default block (in defaultBlockSlugs) — no tenants_allowed_blocks enum change.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "pages_blocks_class_pass_checkout" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "heading" varchar DEFAULT 'Class passes',
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_class_pass_checkout_passes" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "class_pass_type_id" integer,
      "image_id" integer,
      "description" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_class_pass_checkout" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "heading" varchar DEFAULT 'Class passes',
      "_uuid" varchar,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_class_pass_checkout_passes" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "class_pass_type_id" integer,
      "image_id" integer,
      "description" varchar,
      "_uuid" varchar
    );
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_class_pass_checkout"
        ADD CONSTRAINT "pages_blocks_class_pass_checkout_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "pages_blocks_class_pass_checkout_passes"
        ADD CONSTRAINT "pages_blocks_class_pass_checkout_passes_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_class_pass_checkout"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "pages_blocks_class_pass_checkout_passes"
        ADD CONSTRAINT "pages_blocks_class_pass_checkout_passes_class_pass_type_id_fk"
        FOREIGN KEY ("class_pass_type_id") REFERENCES "public"."class_pass_types"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "pages_blocks_class_pass_checkout_passes"
        ADD CONSTRAINT "pages_blocks_class_pass_checkout_passes_image_id_fk"
        FOREIGN KEY ("image_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_class_pass_checkout"
        ADD CONSTRAINT "_pages_v_blocks_class_pass_checkout_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_class_pass_checkout_passes"
        ADD CONSTRAINT "_pages_v_blocks_class_pass_checkout_passes_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_class_pass_checkout"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_class_pass_checkout_passes"
        ADD CONSTRAINT "_pages_v_blocks_class_pass_checkout_passes_class_pass_type_id_fk"
        FOREIGN KEY ("class_pass_type_id") REFERENCES "public"."class_pass_types"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_class_pass_checkout_passes"
        ADD CONSTRAINT "_pages_v_blocks_class_pass_checkout_passes_image_id_fk"
        FOREIGN KEY ("image_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "pages_blocks_class_pass_checkout_order_idx"
      ON "pages_blocks_class_pass_checkout" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_class_pass_checkout_parent_id_idx"
      ON "pages_blocks_class_pass_checkout" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_class_pass_checkout_path_idx"
      ON "pages_blocks_class_pass_checkout" USING btree ("_path");

    CREATE INDEX IF NOT EXISTS "pages_blocks_class_pass_checkout_passes_order_idx"
      ON "pages_blocks_class_pass_checkout_passes" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_class_pass_checkout_passes_parent_id_idx"
      ON "pages_blocks_class_pass_checkout_passes" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_class_pass_checkout_passes_class_pass_type_idx"
      ON "pages_blocks_class_pass_checkout_passes" USING btree ("class_pass_type_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_class_pass_checkout_passes_image_idx"
      ON "pages_blocks_class_pass_checkout_passes" USING btree ("image_id");

    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_class_pass_checkout_order_idx"
      ON "_pages_v_blocks_class_pass_checkout" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_class_pass_checkout_parent_id_idx"
      ON "_pages_v_blocks_class_pass_checkout" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_class_pass_checkout_path_idx"
      ON "_pages_v_blocks_class_pass_checkout" USING btree ("_path");

    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_class_pass_checkout_passes_order_idx"
      ON "_pages_v_blocks_class_pass_checkout_passes" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_class_pass_checkout_passes_parent_id_idx"
      ON "_pages_v_blocks_class_pass_checkout_passes" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_class_pass_checkout_passes_class_pass_type_idx"
      ON "_pages_v_blocks_class_pass_checkout_passes" USING btree ("class_pass_type_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_class_pass_checkout_passes_image_idx"
      ON "_pages_v_blocks_class_pass_checkout_passes" USING btree ("image_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "_pages_v_blocks_class_pass_checkout_passes" CASCADE;
    DROP TABLE IF EXISTS "_pages_v_blocks_class_pass_checkout" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_class_pass_checkout_passes" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_class_pass_checkout" CASCADE;
  `)
}

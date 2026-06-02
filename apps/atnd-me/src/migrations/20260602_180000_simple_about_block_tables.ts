import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds the `simpleAbout` pages block (apps/atnd-me/src/blocks/SimpleAbout).
 *
 * This unblocks tenant-scoped block integration tests, which expect the underlying
 * Payload block tables/views to exist when `defaultBlockSlugs` includes `simpleAbout`.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_simple_about_direction" AS ENUM('ltr', 'rtl');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS "pages_blocks_simple_about" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "direction" "public"."enum_pages_blocks_simple_about_direction" DEFAULT 'ltr',
      "image_id" integer,
      "content" jsonb,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_simple_about" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "direction" "public"."enum_pages_blocks_simple_about_direction" DEFAULT 'ltr',
      "image_id" integer,
      "content" jsonb,
      "_uuid" varchar,
      "block_name" varchar
    );
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_simple_about" ADD CONSTRAINT "pages_blocks_simple_about_image_id_media_id_fk"
        FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "pages_blocks_simple_about" ADD CONSTRAINT "pages_blocks_simple_about_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_simple_about" ADD CONSTRAINT "_pages_v_blocks_simple_about_image_id_media_id_fk"
        FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_simple_about" ADD CONSTRAINT "_pages_v_blocks_simple_about_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "pages_blocks_simple_about_order_idx" ON "pages_blocks_simple_about" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_simple_about_parent_id_idx" ON "pages_blocks_simple_about" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_simple_about_path_idx" ON "pages_blocks_simple_about" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_simple_about_image_idx" ON "pages_blocks_simple_about" USING btree ("image_id");

    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_simple_about_order_idx" ON "_pages_v_blocks_simple_about" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_simple_about_parent_id_idx" ON "_pages_v_blocks_simple_about" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_simple_about_path_idx" ON "_pages_v_blocks_simple_about" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_simple_about_image_idx" ON "_pages_v_blocks_simple_about" USING btree ("image_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "_pages_v_blocks_simple_about";
    DROP TABLE IF EXISTS "pages_blocks_simple_about";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_simple_about_direction";
  `)
}


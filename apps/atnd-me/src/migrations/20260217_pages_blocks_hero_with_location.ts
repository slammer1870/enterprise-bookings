import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add HeroWithLocation block tables for Pages.
 * Schema was added to Pages blocks but DB tables were missing.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Enums for link group (same as other hero/link blocks)
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_hero_with_location_links_link_type" AS ENUM('reference', 'custom');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_hero_with_location_links_link_appearance" AS ENUM('default', 'outline');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  // Child table: links array (linkGroup)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "pages_blocks_hero_with_location_links" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "link_type" "public"."enum_pages_blocks_hero_with_location_links_link_type" DEFAULT 'reference',
      "link_new_tab" boolean,
      "link_url" varchar,
      "link_label" varchar,
      "link_appearance" "public"."enum_pages_blocks_hero_with_location_links_link_appearance" DEFAULT 'default'
    );
  `)

  // Main block table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "pages_blocks_hero_with_location" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "background_image_id" integer,
      "logo_id" integer,
      "title" varchar,
      "title_line2" varchar,
      "title_line1_accent" boolean DEFAULT true,
      "location_text" varchar,
      "location_subtext" varchar,
      "show_location_icon" boolean DEFAULT true,
      "social_follow_label" varchar,
      "social_follow_url" varchar,
      "block_name" varchar
    );
  `)

  // Indexes and FKs for main table
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "pages_blocks_hero_with_location_order_idx"
    ON "pages_blocks_hero_with_location" ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_hero_with_location_parent_id_idx"
    ON "pages_blocks_hero_with_location" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_hero_with_location_path_idx"
    ON "pages_blocks_hero_with_location" ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_hero_with_location_background_image_idx"
    ON "pages_blocks_hero_with_location" ("background_image_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_hero_with_location_logo_idx"
    ON "pages_blocks_hero_with_location" ("logo_id");
  `)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_hero_with_location"
      ADD CONSTRAINT "pages_blocks_hero_with_location_background_image_id_media_id_fk"
      FOREIGN KEY ("background_image_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_hero_with_location"
      ADD CONSTRAINT "pages_blocks_hero_with_location_logo_id_media_id_fk"
      FOREIGN KEY ("logo_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_hero_with_location"
      ADD CONSTRAINT "pages_blocks_hero_with_location_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  // Indexes and FK for links table
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "pages_blocks_hero_with_location_links_order_idx"
    ON "pages_blocks_hero_with_location_links" ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_hero_with_location_links_parent_id_idx"
    ON "pages_blocks_hero_with_location_links" ("_parent_id");
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_hero_with_location_links"
      ADD CONSTRAINT "pages_blocks_hero_with_location_links_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "pages_blocks_hero_with_location"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_blocks_hero_with_location_links" DROP CONSTRAINT IF EXISTS "pages_blocks_hero_with_location_links_parent_id_fk";
    DROP TABLE IF EXISTS "pages_blocks_hero_with_location_links";
  `)
  await db.execute(sql`
    ALTER TABLE "pages_blocks_hero_with_location" DROP CONSTRAINT IF EXISTS "pages_blocks_hero_with_location_parent_id_fk";
    ALTER TABLE "pages_blocks_hero_with_location" DROP CONSTRAINT IF EXISTS "pages_blocks_hero_with_location_logo_id_media_id_fk";
    ALTER TABLE "pages_blocks_hero_with_location" DROP CONSTRAINT IF EXISTS "pages_blocks_hero_with_location_background_image_id_media_id_fk";
    DROP TABLE IF EXISTS "pages_blocks_hero_with_location";
  `)
  await db.execute(sql`
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_hero_with_location_links_link_appearance";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_hero_with_location_links_link_type";
  `)
}

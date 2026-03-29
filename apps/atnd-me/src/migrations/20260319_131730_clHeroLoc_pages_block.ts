import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add Croí Lán "Hero with Location" alias block tables for Pages.
 *
 * Block slug: `clHeroLoc`
 * Underlying fields match `heroWithLocation`, but we keep a short slug to avoid Postgres identifier limits.
 *
 * Idempotent: safe to run multiple times.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Enums (select fields inside linkGroup)
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_cl_hero_loc_links_link_type" AS ENUM('reference', 'custom');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_cl_hero_loc_links_link_appearance" AS ENUM('default', 'outline');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum__pages_v_blocks_cl_hero_loc_links_link_type" AS ENUM('reference', 'custom');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum__pages_v_blocks_cl_hero_loc_links_link_appearance" AS ENUM('default', 'outline');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  // Allow block slug in tenants.allowedBlocks enum (tenant-scoped extras)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE 'clHeroLoc' BEFORE 'threeColumnLayout';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  // Main block tables
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "pages_blocks_cl_hero_loc" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "background_image_id" integer,
      "image_overlay_hex" varchar,
      "image_overlay_opacity" numeric DEFAULT 70,
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

    CREATE TABLE IF NOT EXISTS "pages_blocks_cl_hero_loc_links" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "link_type" "public"."enum_pages_blocks_cl_hero_loc_links_link_type" DEFAULT 'reference',
      "link_new_tab" boolean,
      "link_url" varchar,
      "link_label" varchar,
      "link_appearance" "public"."enum_pages_blocks_cl_hero_loc_links_link_appearance" DEFAULT 'default'
    );
  `)

  // Version tables (drafts / versions)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_cl_hero_loc" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "background_image_id" integer,
      "image_overlay_hex" varchar,
      "image_overlay_opacity" numeric DEFAULT 70,
      "logo_id" integer,
      "title" varchar,
      "title_line2" varchar,
      "title_line1_accent" boolean DEFAULT true,
      "location_text" varchar,
      "location_subtext" varchar,
      "show_location_icon" boolean DEFAULT true,
      "social_follow_label" varchar,
      "social_follow_url" varchar,
      "_uuid" varchar,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_cl_hero_loc_links" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "link_type" "public"."enum__pages_v_blocks_cl_hero_loc_links_link_type" DEFAULT 'reference',
      "link_new_tab" boolean,
      "link_url" varchar,
      "link_label" varchar,
      "link_appearance" "public"."enum__pages_v_blocks_cl_hero_loc_links_link_appearance" DEFAULT 'default',
      "_uuid" varchar
    );
  `)

  // Foreign keys (idempotent)
  const fkStatements = [
    `ALTER TABLE "pages_blocks_cl_hero_loc" ADD CONSTRAINT "pages_blocks_cl_hero_loc_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action`,
    `ALTER TABLE "pages_blocks_cl_hero_loc" ADD CONSTRAINT "pages_blocks_cl_hero_loc_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action`,
    `ALTER TABLE "pages_blocks_cl_hero_loc" ADD CONSTRAINT "pages_blocks_cl_hero_loc_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action`,
    `ALTER TABLE "pages_blocks_cl_hero_loc_links" ADD CONSTRAINT "pages_blocks_cl_hero_loc_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_cl_hero_loc"("id") ON DELETE cascade ON UPDATE no action`,

    `ALTER TABLE "_pages_v_blocks_cl_hero_loc" ADD CONSTRAINT "_pages_v_blocks_cl_hero_loc_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action`,
    `ALTER TABLE "_pages_v_blocks_cl_hero_loc" ADD CONSTRAINT "_pages_v_blocks_cl_hero_loc_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action`,
    `ALTER TABLE "_pages_v_blocks_cl_hero_loc" ADD CONSTRAINT "_pages_v_blocks_cl_hero_loc_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action`,
    `ALTER TABLE "_pages_v_blocks_cl_hero_loc_links" ADD CONSTRAINT "_pages_v_blocks_cl_hero_loc_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_cl_hero_loc"("id") ON DELETE cascade ON UPDATE no action`,
  ]

  for (const stmt of fkStatements) {
    await db.execute(
      sql.raw(`
        DO $$ BEGIN
          ${stmt};
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `),
    )
  }

  // Indexes
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "pages_blocks_cl_hero_loc_links_order_idx" ON "pages_blocks_cl_hero_loc_links" ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_cl_hero_loc_links_parent_id_idx" ON "pages_blocks_cl_hero_loc_links" ("_parent_id");

    CREATE INDEX IF NOT EXISTS "pages_blocks_cl_hero_loc_order_idx" ON "pages_blocks_cl_hero_loc" ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_cl_hero_loc_parent_id_idx" ON "pages_blocks_cl_hero_loc" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_cl_hero_loc_path_idx" ON "pages_blocks_cl_hero_loc" ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_cl_hero_loc_background_image_idx" ON "pages_blocks_cl_hero_loc" ("background_image_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_cl_hero_loc_logo_idx" ON "pages_blocks_cl_hero_loc" ("logo_id");

    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_cl_hero_loc_links_order_idx" ON "_pages_v_blocks_cl_hero_loc_links" ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_cl_hero_loc_links_parent_id_idx" ON "_pages_v_blocks_cl_hero_loc_links" ("_parent_id");

    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_cl_hero_loc_order_idx" ON "_pages_v_blocks_cl_hero_loc" ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_cl_hero_loc_parent_id_idx" ON "_pages_v_blocks_cl_hero_loc" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_cl_hero_loc_path_idx" ON "_pages_v_blocks_cl_hero_loc" ("_path");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_cl_hero_loc_background_image_idx" ON "_pages_v_blocks_cl_hero_loc" ("background_image_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_cl_hero_loc_logo_idx" ON "_pages_v_blocks_cl_hero_loc" ("logo_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "_pages_v_blocks_cl_hero_loc_links";
    DROP TABLE IF EXISTS "_pages_v_blocks_cl_hero_loc";
    DROP TABLE IF EXISTS "pages_blocks_cl_hero_loc_links";
    DROP TABLE IF EXISTS "pages_blocks_cl_hero_loc";

    DROP TYPE IF EXISTS "public"."enum_pages_blocks_cl_hero_loc_links_link_type";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_cl_hero_loc_links_link_appearance";
    DROP TYPE IF EXISTS "public"."enum__pages_v_blocks_cl_hero_loc_links_link_type";
    DROP TYPE IF EXISTS "public"."enum__pages_v_blocks_cl_hero_loc_links_link_appearance";
  `)
}

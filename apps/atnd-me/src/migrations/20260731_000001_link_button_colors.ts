import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds background/foreground colour columns to CMS link arrays,
 * expands appearance enums with secondary/ghost/link,
 * and migrates bruHero primary/secondary buttons into a links array.
 */

const APPEARANCE_ENUMS = [
  'enum_pages_blocks_hero_links_link_appearance',
  'enum_pages_blocks_cta_links_link_appearance',
  'enum_pages_blocks_content_columns_link_appearance',
  'enum_pages_blocks_marketing_hero_links_link_appearance',
  'enum_pages_blocks_marketing_cta_links_link_appearance',
  'enum_pages_blocks_hero_with_location_links_link_appearance',
  'enum_pages_blocks_cl_hero_loc_links_link_appearance',
  'enum_hero_sched_sanc_links_link_appearance',
  'enum_pages_hero_links_link_appearance',
  'enum__pages_v_blocks_hero_links_link_appearance',
  'enum__pages_v_blocks_cta_links_link_appearance',
  'enum__pages_v_blocks_content_columns_link_appearance',
  'enum__pages_v_blocks_marketing_hero_links_link_appearance',
  'enum__pages_v_blocks_marketing_cta_links_link_appearance',
  'enum__pages_v_blocks_hero_with_location_links_link_appearance',
  'enum__pages_v_blocks_cl_hero_loc_links_link_appearance',
  'enum__hero_sched_sanc_v_links_link_appearance',
  'enum__pages_v_version_hero_links_link_appearance',
] as const

const LINK_TABLES = [
  'pages_blocks_hero_links',
  'pages_blocks_cta_links',
  'pages_blocks_content_columns',
  'pages_blocks_marketing_hero_links',
  'pages_blocks_marketing_cta_links',
  'pages_blocks_hero_with_location_links',
  'pages_blocks_cl_hero_loc_links',
  'hero_sched_sanc_links',
  'pages_hero_links',
  '_pages_v_blocks_hero_links',
  '_pages_v_blocks_cta_links',
  '_pages_v_blocks_content_columns',
  '_pages_v_blocks_marketing_hero_links',
  '_pages_v_blocks_marketing_cta_links',
  '_pages_v_blocks_hero_with_location_links',
  '_pages_v_blocks_cl_hero_loc_links',
  '_hero_sched_sanc_v_links',
  '_pages_v_version_hero_links',
] as const

const NEW_APPEARANCES = ['secondary', 'ghost', 'link'] as const

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const enumName of APPEARANCE_ENUMS) {
    for (const value of NEW_APPEARANCES) {
      await db.execute(sql.raw(`
        DO $$ BEGIN
          ALTER TYPE "public"."${enumName}" ADD VALUE IF NOT EXISTS '${value}';
        EXCEPTION WHEN undefined_object THEN NULL;
        END $$;
      `))
    }
  }

  for (const table of LINK_TABLES) {
    await db.execute(sql.raw(`
      DO $$ BEGIN
        ALTER TABLE "${table}" ADD COLUMN "link_background_color" varchar;
      EXCEPTION WHEN undefined_table THEN NULL;
               WHEN duplicate_column THEN NULL;
      END $$;

      DO $$ BEGIN
        ALTER TABLE "${table}" ADD COLUMN "link_foreground_color" varchar;
      EXCEPTION WHEN undefined_table THEN NULL;
               WHEN duplicate_column THEN NULL;
      END $$;
    `))
  }

  // bruHero links array + data migration
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_bru_hero_links_link_type" AS ENUM('reference', 'custom');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_bru_hero_links_link_appearance" AS ENUM('default', 'outline', 'secondary', 'ghost', 'link');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum__pages_v_blocks_bru_hero_links_link_type" AS ENUM('reference', 'custom');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum__pages_v_blocks_bru_hero_links_link_appearance" AS ENUM('default', 'outline', 'secondary', 'ghost', 'link');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "pages_blocks_bru_hero_links" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "link_type" "public"."enum_pages_blocks_bru_hero_links_link_type" DEFAULT 'custom',
      "link_new_tab" boolean,
      "link_url" varchar,
      "link_label" varchar,
      "link_appearance" "public"."enum_pages_blocks_bru_hero_links_link_appearance" DEFAULT 'default',
      "link_background_color" varchar,
      "link_foreground_color" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_bru_hero_links" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "link_type" "public"."enum__pages_v_blocks_bru_hero_links_link_type" DEFAULT 'custom',
      "link_new_tab" boolean,
      "link_url" varchar,
      "link_label" varchar,
      "link_appearance" "public"."enum__pages_v_blocks_bru_hero_links_link_appearance" DEFAULT 'default',
      "link_background_color" varchar,
      "link_foreground_color" varchar,
      "_uuid" varchar
    );
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_bru_hero_links"
        ADD CONSTRAINT "pages_blocks_bru_hero_links_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_bru_hero"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
               WHEN undefined_table THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_bru_hero_links"
        ADD CONSTRAINT "_pages_v_blocks_bru_hero_links_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_bru_hero"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
               WHEN undefined_table THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_hero_links_order_idx" ON "pages_blocks_bru_hero_links" ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_hero_links_parent_id_idx" ON "pages_blocks_bru_hero_links" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_bru_hero_links_order_idx" ON "_pages_v_blocks_bru_hero_links" ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_bru_hero_links_parent_id_idx" ON "_pages_v_blocks_bru_hero_links" ("_parent_id");
  `)

  // Backfill from primary/secondary button columns
  await db.execute(sql`
    INSERT INTO "pages_blocks_bru_hero_links" (
      "_order", "_parent_id", "id", "link_type", "link_new_tab", "link_url", "link_label",
      "link_appearance", "link_background_color", "link_foreground_color"
    )
    SELECT
      0,
      "id",
      "id" || '_primary',
      'custom',
      false,
      "primary_button_link",
      "primary_button_text",
      'default',
      '#FECE7E',
      '#000000'
    FROM "pages_blocks_bru_hero"
    WHERE "primary_button_text" IS NOT NULL
      AND "primary_button_link" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "pages_blocks_bru_hero_links" l WHERE l."_parent_id" = "pages_blocks_bru_hero"."id" AND l."_order" = 0
      );

    INSERT INTO "pages_blocks_bru_hero_links" (
      "_order", "_parent_id", "id", "link_type", "link_new_tab", "link_url", "link_label",
      "link_appearance", "link_background_color", "link_foreground_color"
    )
    SELECT
      1,
      "id",
      "id" || '_secondary',
      'custom',
      false,
      "secondary_button_link",
      "secondary_button_text",
      'secondary',
      NULL,
      NULL
    FROM "pages_blocks_bru_hero"
    WHERE "secondary_button_text" IS NOT NULL
      AND "secondary_button_link" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "pages_blocks_bru_hero_links" l WHERE l."_parent_id" = "pages_blocks_bru_hero"."id" AND l."_order" = 1
      );
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_bru_hero" DROP COLUMN "primary_button_text";
    EXCEPTION WHEN undefined_column THEN NULL;
               WHEN undefined_table THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_bru_hero" DROP COLUMN "primary_button_link";
    EXCEPTION WHEN undefined_column THEN NULL;
               WHEN undefined_table THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_bru_hero" DROP COLUMN "secondary_button_text";
    EXCEPTION WHEN undefined_column THEN NULL;
               WHEN undefined_table THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_bru_hero" DROP COLUMN "secondary_button_link";
    EXCEPTION WHEN undefined_column THEN NULL;
               WHEN undefined_table THEN NULL;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_bru_hero" ADD COLUMN "primary_button_text" varchar;
    EXCEPTION WHEN duplicate_column THEN NULL;
               WHEN undefined_table THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_bru_hero" ADD COLUMN "primary_button_link" varchar;
    EXCEPTION WHEN duplicate_column THEN NULL;
               WHEN undefined_table THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_bru_hero" ADD COLUMN "secondary_button_text" varchar;
    EXCEPTION WHEN duplicate_column THEN NULL;
               WHEN undefined_table THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_bru_hero" ADD COLUMN "secondary_button_link" varchar;
    EXCEPTION WHEN duplicate_column THEN NULL;
               WHEN undefined_table THEN NULL;
    END $$;

    UPDATE "pages_blocks_bru_hero" h
    SET
      "primary_button_text" = p."link_label",
      "primary_button_link" = p."link_url"
    FROM "pages_blocks_bru_hero_links" p
    WHERE p."_parent_id" = h."id" AND p."_order" = 0;

    UPDATE "pages_blocks_bru_hero" h
    SET
      "secondary_button_text" = s."link_label",
      "secondary_button_link" = s."link_url"
    FROM "pages_blocks_bru_hero_links" s
    WHERE s."_parent_id" = h."id" AND s."_order" = 1;

    DROP TABLE IF EXISTS "pages_blocks_bru_hero_links";
    DROP TABLE IF EXISTS "_pages_v_blocks_bru_hero_links";
  `)

  for (const table of LINK_TABLES) {
    await db.execute(sql.raw(`
      DO $$ BEGIN
        ALTER TABLE "${table}" DROP COLUMN IF EXISTS "link_background_color";
      EXCEPTION WHEN undefined_table THEN NULL;
      END $$;
      DO $$ BEGIN
        ALTER TABLE "${table}" DROP COLUMN IF EXISTS "link_foreground_color";
      EXCEPTION WHEN undefined_table THEN NULL;
      END $$;
    `))
  }
}

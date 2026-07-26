import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Reshape CaseStudies block from testimonial/quote cards to screenshot + modal cards.
 *
 * Payload's generated migrate:create included a huge stale schema catch-up that fails
 * against this DB (enums/tables already exist). This migration only applies the
 * case-studies changes, idempotently, with FK drops by actual constraint name.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Drop nested results arrays (no longer in schema)
    DROP TABLE IF EXISTS "pages_blocks_case_studies_case_studies_results" CASCADE;
    DROP TABLE IF EXISTS "_pages_v_blocks_case_studies_case_studies_results" CASCADE;

    -- Drop old media FKs by actual constraint name (names are truncated in this DB)
    DO $$
    DECLARE
      r RECORD;
    BEGIN
      FOR r IN
        SELECT c.conname, t.relname AS table_name
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
        WHERE t.relname IN (
          'pages_blocks_case_studies_case_studies',
          '_pages_v_blocks_case_studies_case_studies'
        )
          AND c.contype = 'f'
          AND EXISTS (
            SELECT 1
            FROM pg_attribute a
            WHERE a.attrelid = c.conrelid
              AND a.attnum = ANY (c.conkey)
              AND NOT a.attisdropped
              AND a.attname IN ('company_logo_id', 'author_avatar_id')
          )
      LOOP
        EXECUTE format(
          'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
          r.table_name,
          r.conname
        );
      END LOOP;
    END $$;

    DROP INDEX IF EXISTS "pages_blocks_case_studies_case_studies_company_logo_idx";
    DROP INDEX IF EXISTS "pages_blocks_case_studies_case_studies_author_author_ava_idx";
    DROP INDEX IF EXISTS "_pages_v_blocks_case_studies_case_studies_company_logo_idx";
    DROP INDEX IF EXISTS "_pages_v_blocks_case_studies_case_studies_author_author__idx";

    -- Live items: add new columns
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pages_blocks_case_studies_case_studies'
          AND column_name = 'screenshot_id'
      ) THEN
        ALTER TABLE "pages_blocks_case_studies_case_studies"
          ADD COLUMN "screenshot_id" integer;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pages_blocks_case_studies_case_studies'
          AND column_name = 'brief_description'
      ) THEN
        ALTER TABLE "pages_blocks_case_studies_case_studies"
          ADD COLUMN "brief_description" varchar;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pages_blocks_case_studies_case_studies'
          AND column_name = 'detailed_description'
      ) THEN
        ALTER TABLE "pages_blocks_case_studies_case_studies"
          ADD COLUMN "detailed_description" varchar;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pages_blocks_case_studies_case_studies'
          AND column_name = 'website_url'
      ) THEN
        ALTER TABLE "pages_blocks_case_studies_case_studies"
          ADD COLUMN "website_url" varchar;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pages_blocks_case_studies_case_studies'
          AND column_name = 'website_label'
      ) THEN
        ALTER TABLE "pages_blocks_case_studies_case_studies"
          ADD COLUMN "website_label" varchar DEFAULT 'Visit website';
      END IF;
    END $$;

    -- Versioned items: add new columns
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = '_pages_v_blocks_case_studies_case_studies'
          AND column_name = 'screenshot_id'
      ) THEN
        ALTER TABLE "_pages_v_blocks_case_studies_case_studies"
          ADD COLUMN "screenshot_id" integer;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = '_pages_v_blocks_case_studies_case_studies'
          AND column_name = 'brief_description'
      ) THEN
        ALTER TABLE "_pages_v_blocks_case_studies_case_studies"
          ADD COLUMN "brief_description" varchar;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = '_pages_v_blocks_case_studies_case_studies'
          AND column_name = 'detailed_description'
      ) THEN
        ALTER TABLE "_pages_v_blocks_case_studies_case_studies"
          ADD COLUMN "detailed_description" varchar;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = '_pages_v_blocks_case_studies_case_studies'
          AND column_name = 'website_url'
      ) THEN
        ALTER TABLE "_pages_v_blocks_case_studies_case_studies"
          ADD COLUMN "website_url" varchar;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = '_pages_v_blocks_case_studies_case_studies'
          AND column_name = 'website_label'
      ) THEN
        ALTER TABLE "_pages_v_blocks_case_studies_case_studies"
          ADD COLUMN "website_label" varchar DEFAULT 'Visit website';
      END IF;
    END $$;

    -- Screenshot FKs + indexes
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'pages_blocks_case_studies_case_studies_screenshot_id_media_id_fk'
      ) THEN
        ALTER TABLE "pages_blocks_case_studies_case_studies"
          ADD CONSTRAINT "pages_blocks_case_studies_case_studies_screenshot_id_media_id_fk"
          FOREIGN KEY ("screenshot_id") REFERENCES "public"."media"("id")
          ON DELETE set null ON UPDATE no action;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = '_pages_v_blocks_case_studies_case_studies_screenshot_id_media_id_fk'
      ) THEN
        ALTER TABLE "_pages_v_blocks_case_studies_case_studies"
          ADD CONSTRAINT "_pages_v_blocks_case_studies_case_studies_screenshot_id_media_id_fk"
          FOREIGN KEY ("screenshot_id") REFERENCES "public"."media"("id")
          ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS "pages_blocks_case_studies_case_studies_screenshot_idx"
      ON "pages_blocks_case_studies_case_studies" USING btree ("screenshot_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_case_studies_case_studies_screenshot_idx"
      ON "_pages_v_blocks_case_studies_case_studies" USING btree ("screenshot_id");

    -- Drop old columns
    ALTER TABLE "pages_blocks_case_studies_case_studies"
      DROP COLUMN IF EXISTS "company_logo_id",
      DROP COLUMN IF EXISTS "quote",
      DROP COLUMN IF EXISTS "author_name",
      DROP COLUMN IF EXISTS "author_title",
      DROP COLUMN IF EXISTS "author_avatar_id",
      DROP COLUMN IF EXISTS "link_type",
      DROP COLUMN IF EXISTS "link_url",
      DROP COLUMN IF EXISTS "link_label",
      DROP COLUMN IF EXISTS "link_new_tab";

    ALTER TABLE "_pages_v_blocks_case_studies_case_studies"
      DROP COLUMN IF EXISTS "company_logo_id",
      DROP COLUMN IF EXISTS "quote",
      DROP COLUMN IF EXISTS "author_name",
      DROP COLUMN IF EXISTS "author_title",
      DROP COLUMN IF EXISTS "author_avatar_id",
      DROP COLUMN IF EXISTS "link_type",
      DROP COLUMN IF EXISTS "link_url",
      DROP COLUMN IF EXISTS "link_label",
      DROP COLUMN IF EXISTS "link_new_tab";

    ALTER TABLE "pages_blocks_case_studies" DROP COLUMN IF EXISTS "layout";
    ALTER TABLE "_pages_v_blocks_case_studies" DROP COLUMN IF EXISTS "layout";

    DROP TYPE IF EXISTS "public"."enum_pages_blocks_case_studies_case_studies_link_type";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_case_studies_layout";
    DROP TYPE IF EXISTS "public"."enum__pages_v_blocks_case_studies_case_studies_link_type";
    DROP TYPE IF EXISTS "public"."enum__pages_v_blocks_case_studies_layout";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_case_studies_case_studies_link_type" AS ENUM('reference', 'custom');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_case_studies_layout" AS ENUM('grid', 'carousel');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum__pages_v_blocks_case_studies_case_studies_link_type" AS ENUM('reference', 'custom');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum__pages_v_blocks_case_studies_layout" AS ENUM('grid', 'carousel');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    ALTER TABLE "pages_blocks_case_studies"
      ADD COLUMN IF NOT EXISTS "layout" "enum_pages_blocks_case_studies_layout" DEFAULT 'grid';
    ALTER TABLE "_pages_v_blocks_case_studies"
      ADD COLUMN IF NOT EXISTS "layout" "enum__pages_v_blocks_case_studies_layout" DEFAULT 'grid';

    ALTER TABLE "pages_blocks_case_studies_case_studies"
      ADD COLUMN IF NOT EXISTS "company_logo_id" integer,
      ADD COLUMN IF NOT EXISTS "quote" varchar,
      ADD COLUMN IF NOT EXISTS "author_name" varchar,
      ADD COLUMN IF NOT EXISTS "author_title" varchar,
      ADD COLUMN IF NOT EXISTS "author_avatar_id" integer,
      ADD COLUMN IF NOT EXISTS "link_type" "enum_pages_blocks_case_studies_case_studies_link_type" DEFAULT 'custom',
      ADD COLUMN IF NOT EXISTS "link_url" varchar,
      ADD COLUMN IF NOT EXISTS "link_label" varchar DEFAULT 'Read full case study',
      ADD COLUMN IF NOT EXISTS "link_new_tab" boolean;

    ALTER TABLE "_pages_v_blocks_case_studies_case_studies"
      ADD COLUMN IF NOT EXISTS "company_logo_id" integer,
      ADD COLUMN IF NOT EXISTS "quote" varchar,
      ADD COLUMN IF NOT EXISTS "author_name" varchar,
      ADD COLUMN IF NOT EXISTS "author_title" varchar,
      ADD COLUMN IF NOT EXISTS "author_avatar_id" integer,
      ADD COLUMN IF NOT EXISTS "link_type" "enum__pages_v_blocks_case_studies_case_studies_link_type" DEFAULT 'custom',
      ADD COLUMN IF NOT EXISTS "link_url" varchar,
      ADD COLUMN IF NOT EXISTS "link_label" varchar DEFAULT 'Read full case study',
      ADD COLUMN IF NOT EXISTS "link_new_tab" boolean;

    ALTER TABLE "pages_blocks_case_studies_case_studies"
      DROP CONSTRAINT IF EXISTS "pages_blocks_case_studies_case_studies_screenshot_id_media_id_fk";
    ALTER TABLE "_pages_v_blocks_case_studies_case_studies"
      DROP CONSTRAINT IF EXISTS "_pages_v_blocks_case_studies_case_studies_screenshot_id_media_id_fk";

    DROP INDEX IF EXISTS "pages_blocks_case_studies_case_studies_screenshot_idx";
    DROP INDEX IF EXISTS "_pages_v_blocks_case_studies_case_studies_screenshot_idx";

    ALTER TABLE "pages_blocks_case_studies_case_studies"
      DROP COLUMN IF EXISTS "screenshot_id",
      DROP COLUMN IF EXISTS "brief_description",
      DROP COLUMN IF EXISTS "detailed_description",
      DROP COLUMN IF EXISTS "website_url",
      DROP COLUMN IF EXISTS "website_label";

    ALTER TABLE "_pages_v_blocks_case_studies_case_studies"
      DROP COLUMN IF EXISTS "screenshot_id",
      DROP COLUMN IF EXISTS "brief_description",
      DROP COLUMN IF EXISTS "detailed_description",
      DROP COLUMN IF EXISTS "website_url",
      DROP COLUMN IF EXISTS "website_label";
  `)
}

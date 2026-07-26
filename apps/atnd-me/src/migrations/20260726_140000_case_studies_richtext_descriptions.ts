import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * CaseStudies: convert brief/detailed descriptions from varchar to jsonb richText.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pages_blocks_case_studies_case_studies'
          AND column_name = 'brief_description'
          AND data_type <> 'jsonb'
      ) THEN
        ALTER TABLE "pages_blocks_case_studies_case_studies"
          DROP COLUMN "brief_description";
        ALTER TABLE "pages_blocks_case_studies_case_studies"
          ADD COLUMN "brief_description" jsonb;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pages_blocks_case_studies_case_studies'
          AND column_name = 'detailed_description'
          AND data_type <> 'jsonb'
      ) THEN
        ALTER TABLE "pages_blocks_case_studies_case_studies"
          DROP COLUMN "detailed_description";
        ALTER TABLE "pages_blocks_case_studies_case_studies"
          ADD COLUMN "detailed_description" jsonb;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = '_pages_v_blocks_case_studies_case_studies'
          AND column_name = 'brief_description'
          AND data_type <> 'jsonb'
      ) THEN
        ALTER TABLE "_pages_v_blocks_case_studies_case_studies"
          DROP COLUMN "brief_description";
        ALTER TABLE "_pages_v_blocks_case_studies_case_studies"
          ADD COLUMN "brief_description" jsonb;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = '_pages_v_blocks_case_studies_case_studies'
          AND column_name = 'detailed_description'
          AND data_type <> 'jsonb'
      ) THEN
        ALTER TABLE "_pages_v_blocks_case_studies_case_studies"
          DROP COLUMN "detailed_description";
        ALTER TABLE "_pages_v_blocks_case_studies_case_studies"
          ADD COLUMN "detailed_description" jsonb;
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pages_blocks_case_studies_case_studies'
          AND column_name = 'brief_description'
          AND data_type = 'jsonb'
      ) THEN
        ALTER TABLE "pages_blocks_case_studies_case_studies"
          DROP COLUMN "brief_description";
        ALTER TABLE "pages_blocks_case_studies_case_studies"
          ADD COLUMN "brief_description" varchar;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pages_blocks_case_studies_case_studies'
          AND column_name = 'detailed_description'
          AND data_type = 'jsonb'
      ) THEN
        ALTER TABLE "pages_blocks_case_studies_case_studies"
          DROP COLUMN "detailed_description";
        ALTER TABLE "pages_blocks_case_studies_case_studies"
          ADD COLUMN "detailed_description" varchar;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = '_pages_v_blocks_case_studies_case_studies'
          AND column_name = 'brief_description'
          AND data_type = 'jsonb'
      ) THEN
        ALTER TABLE "_pages_v_blocks_case_studies_case_studies"
          DROP COLUMN "brief_description";
        ALTER TABLE "_pages_v_blocks_case_studies_case_studies"
          ADD COLUMN "brief_description" varchar;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = '_pages_v_blocks_case_studies_case_studies'
          AND column_name = 'detailed_description'
          AND data_type = 'jsonb'
      ) THEN
        ALTER TABLE "_pages_v_blocks_case_studies_case_studies"
          DROP COLUMN "detailed_description";
        ALTER TABLE "_pages_v_blocks_case_studies_case_studies"
          ADD COLUMN "detailed_description" varchar;
      END IF;
    END $$;
  `)
}

import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Croí Lán Sauna blocks:
 * - clSaunaBenefits: add `backgroundImage` (stored as `background_image_id`)
 *
 * Implemented as a forward-only/idempotent migration.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pages_blocks_cl_sauna_benefits'
          AND column_name = 'background_image_id'
      ) THEN
        ALTER TABLE "pages_blocks_cl_sauna_benefits"
          ADD COLUMN "background_image_id" integer;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = '_pages_v_blocks_cl_sauna_benefits'
          AND column_name = 'background_image_id'
      ) THEN
        ALTER TABLE "_pages_v_blocks_cl_sauna_benefits"
          ADD COLUMN "background_image_id" integer;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'pages_blocks_cl_sauna_benefits'
          AND indexname = 'pages_blocks_cl_sauna_benefits_background_image_id_idx'
      ) THEN
        CREATE INDEX IF NOT EXISTS "pages_blocks_cl_sauna_benefits_background_image_id_idx"
          ON "pages_blocks_cl_sauna_benefits" USING btree ("background_image_id");
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = '_pages_v_blocks_cl_sauna_benefits'
          AND indexname = '_pages_v_blocks_cl_sauna_benefits_background_image_id_idx'
      ) THEN
        CREATE INDEX IF NOT EXISTS "_pages_v_blocks_cl_sauna_benefits_background_image_id_idx"
          ON "_pages_v_blocks_cl_sauna_benefits" USING btree ("background_image_id");
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND table_name = 'pages_blocks_cl_sauna_benefits'
          AND constraint_name = 'pages_blocks_cl_sauna_benefits_background_image_id_media_id_fk'
      ) THEN
        ALTER TABLE "pages_blocks_cl_sauna_benefits"
          ADD CONSTRAINT "pages_blocks_cl_sauna_benefits_background_image_id_media_id_fk"
          FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id")
          ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND table_name = '_pages_v_blocks_cl_sauna_benefits'
          AND constraint_name = '_pages_v_blocks_cl_sauna_benefits_background_image_id_media_id_fk'
      ) THEN
        ALTER TABLE "_pages_v_blocks_cl_sauna_benefits"
          ADD CONSTRAINT "_pages_v_blocks_cl_sauna_benefits_background_image_id_media_id_fk"
          FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id")
          ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Forward-only repair migration.
}


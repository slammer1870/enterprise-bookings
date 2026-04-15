import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Croí Lán Sauna blocks:
 * - clSaunaBenefits: add `tagline` field (small line above the heading)
 *
 * Forward-only/idempotent migration to keep local + CI DBs in sync with
 * the current block config.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pages_blocks_cl_sauna_benefits'
          AND column_name = 'tagline'
      ) THEN
        ALTER TABLE "pages_blocks_cl_sauna_benefits"
          ADD COLUMN "tagline" varchar DEFAULT 'RELEASE, RELAX, RECOVER.';
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = '_pages_v_blocks_cl_sauna_benefits'
          AND column_name = 'tagline'
      ) THEN
        ALTER TABLE "_pages_v_blocks_cl_sauna_benefits"
          ADD COLUMN "tagline" varchar DEFAULT 'RELEASE, RELAX, RECOVER.';
      END IF;
    END $$;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Forward-only repair migration.
}


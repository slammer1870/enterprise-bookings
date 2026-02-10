import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Drop obsolete generate_slug / version_generate_slug columns from pages and _pages_v.
 * These were added by the initial migration for Payload's slugField(); the Pages collection
 * now uses tenantScopedSlugField() (plain text "slug") which does not use these columns.
 * Dropping them aligns the DB with the current Payload schema and stops schema push warnings.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "pages" DROP COLUMN IF EXISTS "generate_slug";
    EXCEPTION WHEN undefined_column THEN NULL;
    END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "_pages_v" DROP COLUMN IF EXISTS "version_generate_slug";
    EXCEPTION WHEN undefined_column THEN NULL;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages"
      ADD COLUMN IF NOT EXISTS "generate_slug" boolean DEFAULT true;
  `)
  await db.execute(sql`
    ALTER TABLE "_pages_v"
      ADD COLUMN IF NOT EXISTS "version_generate_slug" boolean DEFAULT true;
  `)
}

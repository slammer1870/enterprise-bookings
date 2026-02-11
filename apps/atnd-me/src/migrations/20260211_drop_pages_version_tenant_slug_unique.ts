import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Drop the unique index on _pages_v (version_tenant_id, version_slug).
 *
 * The version table stores one row per autosave/version; multiple version rows
 * for the same page (same tenant + slug) are expected. Uniqueness for
 * (tenant_id, slug) is enforced on the main `pages` table only.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "_pages_v_tenant_version_slug_idx";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "_pages_v_tenant_version_slug_idx"
    ON "_pages_v" USING btree ("version_tenant_id", "version_slug")
    WHERE "version_tenant_id" IS NOT NULL;
  `)
}

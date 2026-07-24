import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Drop the unique index on _posts_v (version_tenant_id, version_slug).
 *
 * The version table stores one row per autosave/version; multiple version rows
 * for the same post (same tenant + slug) are expected. Uniqueness for
 * (tenant_id, slug) is enforced on the main `posts` table only.
 *
 * Same fix as 20260211_drop_pages_version_tenant_slug_unique for pages.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "_posts_v_tenant_version_slug_idx";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "_posts_v_tenant_version_slug_idx"
    ON "_posts_v" USING btree ("version_tenant_id", "version_slug")
    WHERE "version_tenant_id" IS NOT NULL;
  `)
}

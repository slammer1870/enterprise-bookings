import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Drops the custom domain, the alias list, Redirect apex, and the stored parent.
 * The hostname list and Direction, written by the previous migration, are the declaration.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DELETE FROM "tenants_texts"
    WHERE "path" = 'aliasHosts';
  `)

  await db.execute(sql`
    DROP INDEX IF EXISTS "tenants_domain_idx";
  `)
  await db.execute(sql`
    DROP INDEX IF EXISTS "tenants_apex_domain_idx";
  `)

  await db.execute(sql`
    ALTER TABLE "tenants"
      DROP COLUMN IF EXISTS "domain",
      DROP COLUMN IF EXISTS "redirect_apex",
      DROP COLUMN IF EXISTS "apex_domain";
  `)
}

/** Columns come back empty. The hostname list is not turned back into these fields. */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "domain" varchar,
      ADD COLUMN IF NOT EXISTS "redirect_apex" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "apex_domain" varchar;
  `)

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "tenants_domain_idx" ON "tenants" USING btree ("domain");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "tenants_apex_domain_idx" ON "tenants" ("apex_domain");
  `)
}

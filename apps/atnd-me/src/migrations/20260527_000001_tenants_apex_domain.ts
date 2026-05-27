import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add apex domain redirect support to tenants:
 *   redirect_apex                  — boolean opt-in flag (default false)
 *   apex_domain                    — derived apex hostname stored for fast OR-query lookup
 *   apex_domain_verification_token — Cloudflare TXT ownership verification value
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "redirect_apex" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "apex_domain" varchar,
      ADD COLUMN IF NOT EXISTS "apex_domain_verification_token" text;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "tenants_apex_domain_idx"
      ON "tenants" ("apex_domain");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "tenants_apex_domain_idx";
  `)

  await db.execute(sql`
    ALTER TABLE "tenants"
      DROP COLUMN IF EXISTS "redirect_apex",
      DROP COLUMN IF EXISTS "apex_domain",
      DROP COLUMN IF EXISTS "apex_domain_verification_token";
  `)
}

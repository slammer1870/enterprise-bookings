import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Ensure tenants.allowedBlocks enum includes `heroWithLocation`.
 *
 * Production incident 2026-03-19: enum_tenants_allowed_blocks was missing the block slug,
 * causing tenant updates / page saves to fail when enabling HeroWithLocation.
 *
 * Idempotent: safe to run multiple times.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE IF NOT EXISTS 'heroWithLocation' BEFORE 'threeColumnLayout';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
}

export async function down({ db: _db }: MigrateDownArgs): Promise<void> {}


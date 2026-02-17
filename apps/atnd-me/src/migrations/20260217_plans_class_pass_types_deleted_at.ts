import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Phase 4.5 – Soft delete: add deleted_at to plans and class_pass_types.
 * When set, list/read exclude these rows (via access control).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "plans"
      ADD COLUMN IF NOT EXISTS "deleted_at" timestamp(3) with time zone;
  `)
  await db.execute(sql`
    ALTER TABLE "class_pass_types"
      ADD COLUMN IF NOT EXISTS "deleted_at" timestamp(3) with time zone;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "plans"
      DROP COLUMN IF EXISTS "deleted_at";
  `)
  await db.execute(sql`
    ALTER TABLE "class_pass_types"
      DROP COLUMN IF EXISTS "deleted_at";
  `)
}

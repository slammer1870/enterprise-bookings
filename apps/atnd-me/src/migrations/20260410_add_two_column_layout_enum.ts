import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add `twoColumnLayout` to tenant allowed-blocks enum in its own migration.
 * PostgreSQL does not allow using a newly added enum value in the same transaction as `ADD VALUE`
 * (see `unsafe use of new value`); the rename/data migration runs next.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE IF NOT EXISTS 'twoColumnLayout' BEFORE 'threeColumnLayout';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // PostgreSQL cannot drop enum values safely; leave `twoColumnLayout` on the type.
}

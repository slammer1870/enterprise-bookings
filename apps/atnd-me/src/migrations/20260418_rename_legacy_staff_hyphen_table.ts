import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Repair: Payload/Drizzle expect relation `staff_members`, but older atnd-me DBs may still
 * have the quoted legacy name `"staff-members"`. Migration `20260409000001` only ran the
 * rename when both conditions matched; if that migration was already recorded before the
 * rename landed, or the check skipped, `payload migrate` will not re-execute it.
 *
 * This migration is idempotent and uses pg_catalog (exact relname) so it still applies
 * when information_schema-based checks disagree with the physical table.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relname = 'staff-members'
      ) AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_class c2
        JOIN pg_catalog.pg_namespace n2 ON n2.oid = c2.relnamespace
        WHERE n2.nspname = 'public'
          AND c2.relkind = 'r'
          AND c2.relname = 'staff_members'
      ) THEN
        ALTER TABLE "staff-members" RENAME TO "staff_members";
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relname = 'staff_members'
      ) AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_class c2
        JOIN pg_catalog.pg_namespace n2 ON n2.oid = c2.relnamespace
        WHERE n2.nspname = 'public'
          AND c2.relkind = 'r'
          AND c2.relname = 'staff-members'
      ) THEN
        ALTER TABLE "staff_members" RENAME TO "staff-members";
      END IF;
    END $$;
  `)
}

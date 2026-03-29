import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Extend footer nav icon enum with `location`.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TYPE "public"."enum_footer_nav_items_icon" ADD VALUE IF NOT EXISTS 'location';
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Postgres does not support removing a single enum value easily/safely.
  // No-op.
  void db
}


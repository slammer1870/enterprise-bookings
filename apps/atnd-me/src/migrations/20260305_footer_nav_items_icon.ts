import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add `icon` column to footer_nav_items for footer link icons (e.g. social links).
 * Schema was updated in Footer collection but DB was missing this column.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_footer_nav_items_icon" AS ENUM('none', 'instagram', 'facebook', 'x');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
  await db.execute(sql`
    ALTER TABLE "footer_nav_items"
    ADD COLUMN IF NOT EXISTS "icon" "public"."enum_footer_nav_items_icon" DEFAULT 'none';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "footer_nav_items" DROP COLUMN IF EXISTS "icon";
  `)
  await db.execute(sql`
    DROP TYPE IF EXISTS "public"."enum_footer_nav_items_icon";
  `)
}


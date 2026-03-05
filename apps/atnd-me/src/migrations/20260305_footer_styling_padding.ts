import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add `styling.padding` to footer for consistent alignment with navbar.
 * Schema was updated in Footer collection but DB was missing this column.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_footer_styling_padding" AS ENUM('small', 'medium', 'large');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
  await db.execute(sql`
    ALTER TABLE "footer"
    ADD COLUMN IF NOT EXISTS "styling_padding" "public"."enum_footer_styling_padding" DEFAULT 'medium';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "footer" DROP COLUMN IF EXISTS "styling_padding";
  `)
  await db.execute(sql`
    DROP TYPE IF EXISTS "public"."enum_footer_styling_padding";
  `)
}


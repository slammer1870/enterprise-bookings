import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Navbar: add `showSignIn` checkbox (`show_sign_in` column), default true.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'navbar'
          AND column_name = 'show_sign_in'
      ) THEN
        ALTER TABLE "navbar"
          ADD COLUMN "show_sign_in" boolean DEFAULT true;
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "navbar" DROP COLUMN IF EXISTS "show_sign_in";
  `)
}

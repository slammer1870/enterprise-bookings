import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds `footer_text` column required by the `plans.footerText` field.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql`
      DO $$ BEGIN
        ALTER TABLE "plans" ADD COLUMN "footer_text" varchar;
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$;
    `,
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "plans" DROP COLUMN IF EXISTS "footer_text";`)
}


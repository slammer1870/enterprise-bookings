import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Remove obsolete slug toggle columns from posts (slug behaviour is handled in config).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "posts" DROP COLUMN "generate_slug";
    EXCEPTION
      WHEN undefined_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_posts_v" DROP COLUMN "version_generate_slug";
    EXCEPTION
      WHEN undefined_column THEN NULL;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "generate_slug" boolean DEFAULT true;
    ALTER TABLE "_posts_v" ADD COLUMN IF NOT EXISTS "version_generate_slug" boolean DEFAULT true;
  `)
}

import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "pages" ADD COLUMN "require_auth" boolean DEFAULT false;
    EXCEPTION
      WHEN duplicate_column THEN NULL;
    END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "_pages_v" ADD COLUMN "version_require_auth" boolean DEFAULT false;
    EXCEPTION
      WHEN duplicate_column THEN NULL;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "_pages_v" DROP COLUMN IF EXISTS "version_require_auth";
  `)
  await db.execute(sql`
    ALTER TABLE "pages" DROP COLUMN IF EXISTS "require_auth";
  `)
}

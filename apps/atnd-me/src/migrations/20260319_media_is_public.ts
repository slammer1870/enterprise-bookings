import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "media" ADD COLUMN "is_public" boolean DEFAULT false;
    EXCEPTION
      WHEN duplicate_column THEN NULL;
    END $$;

    UPDATE "media" SET "is_public" = false WHERE "is_public" IS NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "media" DROP COLUMN IF EXISTS "is_public";
  `)
}


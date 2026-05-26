import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "class_pass_types_slug_idx";
    ALTER TABLE "class_pass_types" DROP COLUMN IF EXISTS "slug";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "class_pass_types" ADD COLUMN IF NOT EXISTS "slug" varchar NOT NULL DEFAULT '';
    CREATE UNIQUE INDEX IF NOT EXISTS "class_pass_types_slug_idx" ON "class_pass_types" USING btree ("slug");
  `)
}

import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "class_passes" DROP COLUMN IF EXISTS "price";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "class_passes" ADD COLUMN IF NOT EXISTS "price" numeric NOT NULL DEFAULT 0;
  `)
}

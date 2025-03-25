import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-03-25T12:37:55.909Z';
  ALTER TABLE "lessons" ALTER COLUMN "lock_out_time" SET DEFAULT 0;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-03-20T15:57:31.014Z';
  ALTER TABLE "lessons" ALTER COLUMN "lock_out_time" SET DEFAULT 60;`)
}

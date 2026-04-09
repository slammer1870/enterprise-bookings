import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "timeslots" ALTER COLUMN "date" SET DEFAULT '2026-02-19T14:59:51.891Z';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "timeslots" ALTER COLUMN "date" SET DEFAULT '2026-02-19T14:59:43.847Z';`)
}

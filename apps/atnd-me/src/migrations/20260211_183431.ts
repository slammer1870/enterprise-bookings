import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-02-11T18:34:30.810Z';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-02-11T18:03:30.384Z';`)
}

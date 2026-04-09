import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "timeslots" ALTER COLUMN "date" SET DEFAULT '2026-02-11T18:34:30.810Z';`)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "timeslots" ALTER COLUMN "date" SET DEFAULT '2026-02-11T18:03:30.384Z';`)
}

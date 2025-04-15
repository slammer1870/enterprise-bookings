import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ALTER COLUMN "stripe_customer_id" SET DEFAULT '';
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-04-08T08:20:49.699Z';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ALTER COLUMN "stripe_customer_id" DROP DEFAULT;
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-03-25T17:43:56.606Z';`)
}

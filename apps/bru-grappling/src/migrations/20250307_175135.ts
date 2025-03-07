import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-03-07T17:51:35.544Z';
  ALTER TABLE "drop_ins_discount_tiers" ALTER COLUMN "min_quantity" SET DEFAULT 1;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-03-05T13:39:05.671Z';
  ALTER TABLE "drop_ins_discount_tiers" ALTER COLUMN "min_quantity" DROP DEFAULT;`)
}

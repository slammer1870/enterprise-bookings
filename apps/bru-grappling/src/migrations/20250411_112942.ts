import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_plans_status" AS ENUM('active', 'inactive');
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-04-11T11:29:41.108Z';
  ALTER TABLE "plans" ADD COLUMN "status" "enum_plans_status" DEFAULT 'active' NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-04-08T08:20:49.699Z';
  ALTER TABLE "plans" DROP COLUMN IF EXISTS "status";
  DROP TYPE "public"."enum_plans_status";`)
}

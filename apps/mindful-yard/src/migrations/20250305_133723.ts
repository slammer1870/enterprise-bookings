import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ALTER COLUMN "name" DROP DEFAULT;
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-03-05T13:37:22.884Z';
  ALTER TABLE "drop_ins" ALTER COLUMN "adjustable" SET NOT NULL;
  ALTER TABLE "public"."drop_ins_payment_methods" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_drop_ins_payment_methods";
  CREATE TYPE "public"."enum_drop_ins_payment_methods" AS ENUM('cash');
  ALTER TABLE "public"."drop_ins_payment_methods" ALTER COLUMN "value" SET DATA TYPE "public"."enum_drop_ins_payment_methods" USING "value"::"public"."enum_drop_ins_payment_methods";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_drop_ins_payment_methods" ADD VALUE 'card';
  ALTER TABLE "users" ALTER COLUMN "name" SET DEFAULT '';
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-03-04T12:47:19.803Z';
  ALTER TABLE "drop_ins" ALTER COLUMN "adjustable" DROP NOT NULL;`)
}

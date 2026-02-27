import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_discount_codes_type" AS ENUM('percentage_off', 'amount_off');
  CREATE TYPE "public"."enum_discount_codes_duration" AS ENUM('once', 'forever', 'repeating');
  CREATE TYPE "public"."enum_discount_codes_status" AS ENUM('active', 'archived');
  CREATE TABLE "discount_codes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"name" varchar NOT NULL,
  	"code" varchar NOT NULL,
  	"type" "enum_discount_codes_type" NOT NULL,
  	"value" numeric NOT NULL,
  	"currency" varchar,
  	"duration" "enum_discount_codes_duration" NOT NULL,
  	"duration_in_months" numeric,
  	"max_redemptions" numeric,
  	"redeem_by" timestamp(3) with time zone,
  	"stripe_coupon_id" varchar,
  	"stripe_promotion_code_id" varchar,
  	"status" "enum_discount_codes_status" DEFAULT 'active' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-02-17T17:27:16.744Z';
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "discount_codes_id" integer;
  ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "discount_codes_tenant_idx" ON "discount_codes" USING btree ("tenant_id");
  CREATE INDEX "discount_codes_updated_at_idx" ON "discount_codes" USING btree ("updated_at");
  CREATE INDEX "discount_codes_created_at_idx" ON "discount_codes" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_discount_codes_fk" FOREIGN KEY ("discount_codes_id") REFERENCES "public"."discount_codes"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_discount_codes_id_idx" ON "payload_locked_documents_rels" USING btree ("discount_codes_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "discount_codes" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "discount_codes" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_discount_codes_fk";
  
  DROP INDEX "payload_locked_documents_rels_discount_codes_id_idx";
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-02-17T12:54:26.169Z';
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "discount_codes_id";
  DROP TYPE "public"."enum_discount_codes_type";
  DROP TYPE "public"."enum_discount_codes_duration";
  DROP TYPE "public"."enum_discount_codes_status";`)
}

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE IF NOT EXISTS 'bruHero' BEFORE 'threeColumnLayout';
  ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE IF NOT EXISTS 'bruAbout' BEFORE 'threeColumnLayout';
  ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE IF NOT EXISTS 'bruSchedule' BEFORE 'threeColumnLayout';
  ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE IF NOT EXISTS 'bruLearning' BEFORE 'threeColumnLayout';
  ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE IF NOT EXISTS 'bruMeetTheTeam' BEFORE 'threeColumnLayout';
  ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE IF NOT EXISTS 'bruTestimonials' BEFORE 'threeColumnLayout';
  ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE IF NOT EXISTS 'bruContact' BEFORE 'threeColumnLayout';
  ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE IF NOT EXISTS 'bruHeroWaitlist' BEFORE 'threeColumnLayout';
  CREATE TABLE IF NOT EXISTS "users_stripe_customers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"stripe_account_id" varchar NOT NULL,
  	"stripe_customer_id" varchar NOT NULL
  );
  
  ALTER TABLE "timeslots" ALTER COLUMN "date" SET DEFAULT '2026-02-27T11:11:21.739Z';
  ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "stripe_account_id" varchar;
  ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "stripe_customer_id" varchar;

  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'users_stripe_customers_parent_id_fk'
    ) THEN
      ALTER TABLE "users_stripe_customers"
      ADD CONSTRAINT "users_stripe_customers_parent_id_fk"
      FOREIGN KEY ("_parent_id")
      REFERENCES "public"."users"("id")
      ON DELETE cascade
      ON UPDATE no action;
    END IF;
  END
  $$;

  CREATE INDEX IF NOT EXISTS "users_stripe_customers_order_idx" ON "users_stripe_customers" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "users_stripe_customers_parent_id_idx" ON "users_stripe_customers" USING btree ("_parent_id");`)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users_stripe_customers" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "users_stripe_customers" CASCADE;
  ALTER TABLE "tenants_allowed_blocks" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_tenants_allowed_blocks";
  CREATE TYPE "public"."enum_tenants_allowed_blocks" AS ENUM('marketingHero', 'location', 'healthBenefits', 'sectionTagline', 'faqs', 'features', 'caseStudies', 'marketingCta', 'mediaBlock', 'archive', 'formBlock', 'threeColumnLayout');
  ALTER TABLE "tenants_allowed_blocks" ALTER COLUMN "value" SET DATA TYPE "public"."enum_tenants_allowed_blocks" USING "value"::"public"."enum_tenants_allowed_blocks";
  ALTER TABLE "timeslots" ALTER COLUMN "date" SET DEFAULT '2026-02-20T18:28:34.469Z';
  ALTER TABLE "subscriptions" DROP COLUMN "stripe_account_id";
  ALTER TABLE "subscriptions" DROP COLUMN "stripe_customer_id";`)
}

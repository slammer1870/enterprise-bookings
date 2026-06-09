import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "checkout_legal_business_terms_page_id" integer,
      ADD COLUMN IF NOT EXISTS "checkout_legal_booking_terms_page_id" integer,
      ADD COLUMN IF NOT EXISTS "checkout_legal_privacy_page_id" integer;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "tenants"
        ADD CONSTRAINT "tenants_checkout_legal_business_terms_page_id_pages_id_fk"
        FOREIGN KEY ("checkout_legal_business_terms_page_id") REFERENCES "public"."pages"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      ALTER TABLE "tenants"
        ADD CONSTRAINT "tenants_checkout_legal_booking_terms_page_id_pages_id_fk"
        FOREIGN KEY ("checkout_legal_booking_terms_page_id") REFERENCES "public"."pages"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      ALTER TABLE "tenants"
        ADD CONSTRAINT "tenants_checkout_legal_privacy_page_id_pages_id_fk"
        FOREIGN KEY ("checkout_legal_privacy_page_id") REFERENCES "public"."pages"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants"
      DROP CONSTRAINT IF EXISTS "tenants_checkout_legal_business_terms_page_id_pages_id_fk",
      DROP CONSTRAINT IF EXISTS "tenants_checkout_legal_booking_terms_page_id_pages_id_fk",
      DROP CONSTRAINT IF EXISTS "tenants_checkout_legal_privacy_page_id_pages_id_fk";

    ALTER TABLE "tenants"
      DROP COLUMN IF EXISTS "checkout_legal_business_terms_page_id",
      DROP COLUMN IF EXISTS "checkout_legal_booking_terms_page_id",
      DROP COLUMN IF EXISTS "checkout_legal_privacy_page_id";
  `)
}

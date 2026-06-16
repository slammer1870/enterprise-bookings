import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants"
      DROP CONSTRAINT IF EXISTS "tenants_checkout_legal_business_terms_page_id_pages_id_fk",
      DROP CONSTRAINT IF EXISTS "tenants_checkout_legal_booking_terms_page_id_pages_id_fk",
      DROP CONSTRAINT IF EXISTS "tenants_checkout_legal_privacy_page_id_pages_id_fk";

    ALTER TABLE "tenants"
      DROP COLUMN IF EXISTS "checkout_legal_business_terms_page_id",
      DROP COLUMN IF EXISTS "checkout_legal_booking_terms_page_id",
      DROP COLUMN IF EXISTS "checkout_legal_privacy_page_id";

    CREATE TABLE IF NOT EXISTS "tenants_checkout_legal_documents" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "page_id" integer
    );
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "tenants_checkout_legal_documents"
        ADD CONSTRAINT "tenants_checkout_legal_documents_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."tenants"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      ALTER TABLE "tenants_checkout_legal_documents"
        ADD CONSTRAINT "tenants_checkout_legal_documents_page_id_pages_id_fk"
        FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "tenants_checkout_legal_documents_order_idx"
      ON "tenants_checkout_legal_documents" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "tenants_checkout_legal_documents_parent_id_idx"
      ON "tenants_checkout_legal_documents" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "tenants_checkout_legal_documents_page_idx"
      ON "tenants_checkout_legal_documents" USING btree ("page_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "tenants_checkout_legal_documents" CASCADE;
  `)
}

import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds tenant_id to form_submissions table for multi-tenant plugin.
 *
 * Without this column, public POST /api/form-submissions fails with:
 * "column form_submissions.tenant_id does not exist"
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "form_submissions" ADD COLUMN "tenant_id" integer;
    EXCEPTION
      WHEN duplicate_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_tenant_id_tenants_id_fk"
        FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "form_submissions_tenant_idx" ON "form_submissions" USING btree ("tenant_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "form_submissions_tenant_idx";

    ALTER TABLE "form_submissions" DROP CONSTRAINT IF EXISTS "form_submissions_tenant_id_tenants_id_fk";
    ALTER TABLE "form_submissions" DROP COLUMN IF EXISTS "tenant_id";
  `)
}


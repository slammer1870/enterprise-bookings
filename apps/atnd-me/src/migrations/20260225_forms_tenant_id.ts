import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds tenant_id to forms table for multi-tenant plugin.
 * Production had forms without this column, causing "column forms.tenant_id does not exist"
 * when viewing the forms collection list.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "forms" ADD COLUMN "tenant_id" integer;
    EXCEPTION
      WHEN duplicate_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "forms" ADD CONSTRAINT "forms_tenant_id_tenants_id_fk"
        FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "forms_tenant_idx" ON "forms" USING btree ("tenant_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "forms_tenant_idx";

    ALTER TABLE "forms" DROP CONSTRAINT IF EXISTS "forms_tenant_id_tenants_id_fk";
    ALTER TABLE "forms" DROP COLUMN IF EXISTS "tenant_id";
  `)
}

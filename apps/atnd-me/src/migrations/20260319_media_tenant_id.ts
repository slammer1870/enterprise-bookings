import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds tenant_id to media table for multi-tenant plugin.
 * Required once media becomes tenant-scoped.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "media" ADD COLUMN "tenant_id" integer;
    EXCEPTION
      WHEN duplicate_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "media" ADD CONSTRAINT "media_tenant_id_tenants_id_fk"
        FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "media_tenant_idx" ON "media" USING btree ("tenant_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "media_tenant_idx";
    ALTER TABLE "media" DROP CONSTRAINT IF EXISTS "media_tenant_id_tenants_id_fk";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "tenant_id";
  `)
}


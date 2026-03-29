import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds tenant_id to footer table for multi-tenant plugin (isGlobal: true).
 * Footer was missing tenant_id; navbar and scheduler already had it.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "footer" ADD COLUMN "tenant_id" integer;
    ALTER TABLE "footer" ADD CONSTRAINT "footer_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
    CREATE INDEX "footer_tenant_idx" ON "footer" USING btree ("tenant_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "footer_tenant_idx";
    ALTER TABLE "footer" DROP CONSTRAINT IF EXISTS "footer_tenant_id_tenants_id_fk";
    ALTER TABLE "footer" DROP COLUMN IF EXISTS "tenant_id";
  `)
}

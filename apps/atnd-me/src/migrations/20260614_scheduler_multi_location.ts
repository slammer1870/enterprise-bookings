import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Drop the UNIQUE constraint on `scheduler.tenant_id` so that a tenant can
 * have multiple scheduler documents — one per branch / location.
 *
 * The index was originally created as UNIQUE by the multi-tenant plugin when
 * scheduler was registered as `isGlobal: true` (one doc per tenant). Now that
 * each location has its own scheduler the constraint is replaced with a plain
 * non-unique index so queries by tenant remain fast.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DROP INDEX IF EXISTS "scheduler_tenant_idx";
  CREATE INDEX "scheduler_tenant_idx" ON "scheduler" USING btree ("tenant_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP INDEX IF EXISTS "scheduler_tenant_idx";
  CREATE UNIQUE INDEX "scheduler_tenant_idx" ON "scheduler" USING btree ("tenant_id");`)
}

import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Phase 7 Chunk 3 — timeslots optional `branch` (→ `locations`); compound index for tenant + branch + time.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "timeslots" ADD COLUMN "branch_id" integer;
  ALTER TABLE "timeslots" ADD CONSTRAINT "timeslots_branch_id_locations_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "timeslots_branch_idx" ON "timeslots" USING btree ("branch_id");
  CREATE INDEX "timeslots_tenant_id_branch_id_start_time_idx" ON "timeslots" USING btree ("tenant_id", "branch_id", "start_time");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP INDEX IF EXISTS "timeslots_tenant_id_branch_id_start_time_idx";
  DROP INDEX IF EXISTS "timeslots_branch_idx";
  ALTER TABLE "timeslots" DROP CONSTRAINT IF EXISTS "timeslots_branch_id_locations_id_fk";
  ALTER TABLE "timeslots" DROP COLUMN IF EXISTS "branch_id";`)
}

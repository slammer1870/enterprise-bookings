import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Scheduler optional `branch` → `locations` (default site for generated timeslots).
 * Aligns DB with `apps/atnd-me/src/collections/Scheduler/index.ts` (after `locations` exists).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "scheduler" ADD COLUMN "branch_id" integer;
  ALTER TABLE "scheduler" ADD CONSTRAINT "scheduler_branch_id_locations_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "scheduler_branch_idx" ON "scheduler" USING btree ("branch_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP INDEX IF EXISTS "scheduler_branch_idx";
  ALTER TABLE "scheduler" DROP CONSTRAINT IF EXISTS "scheduler_branch_id_locations_id_fk";
  ALTER TABLE "scheduler" DROP COLUMN IF EXISTS "branch_id";`)
}

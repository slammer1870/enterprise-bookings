import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Branch ledger: optional site on each booking transaction, copied from the timeslot.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "booking_transactions" ADD COLUMN IF NOT EXISTS "branch_id" integer;
  ALTER TABLE "booking_transactions" DROP CONSTRAINT IF EXISTS "booking_transactions_branch_id_locations_id_fk";
  ALTER TABLE "booking_transactions" ADD CONSTRAINT "booking_transactions_branch_id_locations_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX IF NOT EXISTS "booking_transactions_branch_idx" ON "booking_transactions" USING btree ("branch_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP INDEX IF EXISTS "booking_transactions_branch_idx";
  ALTER TABLE "booking_transactions" DROP CONSTRAINT IF EXISTS "booking_transactions_branch_id_locations_id_fk";
  ALTER TABLE "booking_transactions" DROP COLUMN IF EXISTS "branch_id";`)
}

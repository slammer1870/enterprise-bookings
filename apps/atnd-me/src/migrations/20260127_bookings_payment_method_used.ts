import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add payment_method_used and class_pass_id_used to bookings (atnd-me booking overrides for @repo/bookings-payments).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "bookings"
      ADD COLUMN IF NOT EXISTS "payment_method_used" varchar,
      ADD COLUMN IF NOT EXISTS "class_pass_id_used" integer;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "bookings"
      DROP COLUMN IF EXISTS "payment_method_used",
      DROP COLUMN IF EXISTS "class_pass_id_used";
  `)
}

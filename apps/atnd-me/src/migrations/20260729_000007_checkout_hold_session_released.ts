import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add checkoutSessionId + allow status=released so abandon/release can block
 * late in-flight upserts from recreating capacity holds after page exit.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "booking_checkout_holds"
      ADD COLUMN IF NOT EXISTS "checkout_session_id" varchar;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "booking_checkout_holds_checkout_session_id_idx"
      ON "booking_checkout_holds" ("checkout_session_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "booking_checkout_holds_checkout_session_id_idx";
  `)
  await db.execute(sql`
    ALTER TABLE "booking_checkout_holds"
      DROP COLUMN IF EXISTS "checkout_session_id";
  `)
}

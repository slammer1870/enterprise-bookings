import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add subscription_id_used to bookings (set when paymentMethodUsed is 'subscription';
 * used to create a booking-transaction referencing the subscription).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "bookings"
      ADD COLUMN IF NOT EXISTS "subscription_id_used" integer;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "bookings"
      DROP COLUMN IF EXISTS "subscription_id_used";
  `)
}

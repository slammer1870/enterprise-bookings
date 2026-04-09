import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add paymentMethods group to event-types (step 2.6.1).
 * Column: payment_methods_payments_enabled (boolean).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "class_options"
      ADD COLUMN IF NOT EXISTS "payment_methods_payments_enabled" boolean DEFAULT false;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "class_options"
      DROP COLUMN IF EXISTS "payment_methods_payments_enabled";
  `)
}

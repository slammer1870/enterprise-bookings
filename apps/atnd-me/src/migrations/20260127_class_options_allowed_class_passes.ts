import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add payment_methods_allowed_class_passes to class_options (injected by @repo/bookings-payments).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "class_options"
      ADD COLUMN IF NOT EXISTS "payment_methods_allowed_class_passes" boolean DEFAULT false;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "class_options"
      DROP COLUMN IF EXISTS "payment_methods_allowed_class_passes";
  `)
}

import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "booking_theme_checkin_background_color" varchar;
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "booking_theme_checkin_foreground_color" varchar;
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "booking_theme_trialable_background_color" varchar;
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "booking_theme_trialable_foreground_color" varchar;
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "booking_theme_cancel_background_color" varchar;
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "booking_theme_cancel_foreground_color" varchar;
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "booking_theme_waitlist_background_color" varchar;
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "booking_theme_waitlist_foreground_color" varchar;
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "booking_theme_children_booked_background_color" varchar;
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "booking_theme_children_booked_foreground_color" varchar;
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "booking_theme_modify_background_color" varchar;
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "booking_theme_modify_foreground_color" varchar;
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "booking_theme_closed_background_color" varchar;
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "booking_theme_closed_foreground_color" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "booking_theme_checkin_background_color";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "booking_theme_checkin_foreground_color";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "booking_theme_trialable_background_color";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "booking_theme_trialable_foreground_color";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "booking_theme_cancel_background_color";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "booking_theme_cancel_foreground_color";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "booking_theme_waitlist_background_color";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "booking_theme_waitlist_foreground_color";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "booking_theme_children_booked_background_color";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "booking_theme_children_booked_foreground_color";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "booking_theme_modify_background_color";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "booking_theme_modify_foreground_color";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "booking_theme_closed_background_color";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "booking_theme_closed_foreground_color";
  `)
}

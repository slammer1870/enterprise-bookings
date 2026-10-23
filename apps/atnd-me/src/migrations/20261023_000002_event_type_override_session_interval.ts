import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Optional Per and Interval on a membership event-type override.
 * Blank keeps the plan's session window. Both set count that event type in its own window.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_plans_sessions_information_event_type_overrides_interval" AS ENUM('day', 'week', 'month', 'quarter', 'year');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$
    BEGIN
      IF to_regclass('public.plans_sessions_information_event_type_overrides') IS NOT NULL THEN
        ALTER TABLE "plans_sessions_information_event_type_overrides"
          ADD COLUMN IF NOT EXISTS "interval_count" numeric;
        ALTER TABLE "plans_sessions_information_event_type_overrides"
          ADD COLUMN IF NOT EXISTS "interval" "public"."enum_plans_sessions_information_event_type_overrides_interval";
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF to_regclass('public.plans_sessions_information_event_type_overrides') IS NOT NULL THEN
        ALTER TABLE "plans_sessions_information_event_type_overrides"
          DROP COLUMN IF EXISTS "interval";
        ALTER TABLE "plans_sessions_information_event_type_overrides"
          DROP COLUMN IF EXISTS "interval_count";
      END IF;
    END $$;

    DROP TYPE IF EXISTS "public"."enum_plans_sessions_information_event_type_overrides_interval";
  `)
}

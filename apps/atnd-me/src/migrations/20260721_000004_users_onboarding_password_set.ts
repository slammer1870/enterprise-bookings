import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Track when a claimed admin sets a real password from the onboarding checklist.
 * Existing users are backfilled so they do not see the new checklist step.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'onboarding_password_set_at'
      ) THEN
        ALTER TABLE "users"
          ADD COLUMN "onboarding_password_set_at" timestamp(3) with time zone;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    UPDATE "users"
    SET "onboarding_password_set_at" = NOW()
    WHERE "onboarding_password_set_at" IS NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" DROP COLUMN IF EXISTS "onboarding_password_set_at";
  `)
}

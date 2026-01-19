import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Rename users self-referencing relationship column to match field rename:
 * - Payload field: `parent`      -> `parentUser`
 * - DB column:     `parent_id`   -> `parent_user_id`
 *
 * This is intentionally defensive/idempotent because CI runs `migrate:fresh`.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'parent_id'
      ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'parent_user_id'
      ) THEN
        ALTER TABLE "public"."users" RENAME COLUMN "parent_id" TO "parent_user_id";
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'parent_user_id'
      ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'parent_id'
      ) THEN
        ALTER TABLE "public"."users" RENAME COLUMN "parent_user_id" TO "parent_id";
      END IF;
    END $$;
  `)
}


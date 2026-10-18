import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Store the ordered hostname list and one Direction on tenants.
 * Roles (canonical host, serving hosts, alias targets) are derived on read and are not columns.
 * `hostnames` stays null until a row is saved with the list. An empty JSON array is a saved empty list.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "hostnames" jsonb;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'enum_tenants_direction'
      ) THEN
        CREATE TYPE "public"."enum_tenants_direction" AS ENUM (
          'allow-www-and-non-www',
          'redirect-to-www',
          'redirect-to-non-www'
        );
      END IF;
    END $$;
  `)

  await db.execute(sql`
    ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "direction" "public"."enum_tenants_direction"
      DEFAULT 'allow-www-and-non-www';
  `)

  await db.execute(sql`
    UPDATE "tenants"
    SET "direction" = 'allow-www-and-non-www'
    WHERE "direction" IS NULL;
  `)

  await db.execute(sql`
    ALTER TABLE "tenants"
      ALTER COLUMN "direction" SET DEFAULT 'allow-www-and-non-www',
      ALTER COLUMN "direction" SET NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants"
      DROP COLUMN IF EXISTS "direction",
      DROP COLUMN IF EXISTS "hostnames";
  `)

  await db.execute(sql`
    DROP TYPE IF EXISTS "public"."enum_tenants_direction";
  `)
}

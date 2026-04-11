import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Removes duplicate RBAC storage: `@repo/roles` used `users_roles` while Better Auth
 * uses `users_role` for the `role` field. Merge any values only present on `users_roles`
 * into `users_role`, then drop the legacy table and enum.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users_roles'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users_role'
      ) THEN
        INSERT INTO "public"."users_role" ("order", "parent_id", "value")
        SELECT
          sub."base_max" + sub.rn,
          sub."parent_id",
          sub."value"
        FROM (
          SELECT
            r."parent_id",
            r."value"::text::"public"."enum_users_role" AS "value",
            (
              SELECT COALESCE(MAX(ur."order"), -1)
              FROM "public"."users_role" ur
              WHERE ur."parent_id" = r."parent_id"
            ) AS "base_max",
            ROW_NUMBER() OVER (PARTITION BY r."parent_id" ORDER BY r."order") AS rn
          FROM "public"."users_roles" r
          WHERE NOT EXISTS (
            SELECT 1
            FROM "public"."users_role" ur
            WHERE ur."parent_id" = r."parent_id"
              AND ur."value"::text = r."value"::text
          )
        ) sub;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DROP TABLE IF EXISTS "public"."users_roles" CASCADE;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'enum_users_roles'
      ) THEN
        DROP TYPE "public"."enum_users_roles";
      END IF;
    END $$;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Recreating enum_users_roles + users_roles without reliable row data is unsafe; no-op.
}

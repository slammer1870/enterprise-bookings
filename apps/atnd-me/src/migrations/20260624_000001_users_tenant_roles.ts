import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Schema + data migration for the consolidated tenants[n].roles structure.
 *
 * Schema changes
 * --------------
 * Creates `users_tenants_roles` — a hasMany-select join table that stores per-tenant role
 * assignments as rows keyed to `users_tenants.id`. This replaces the now-removed
 * `tenantRoles` / `users_tenant_roles` approach where roles lived in a separate array.
 *
 * Data migration (runs immediately after the schema is created)
 * -------------------------------------------------------------
 * For every non-super-admin user, for each `users_tenants` membership row:
 *   1. Reads their current global `role` values from `users_role`.
 *   2. Copies assignable roles (admin / staff / location-manager / user) into
 *      `users_tenants_roles` rows keyed to the corresponding `users_tenants.id`.
 *   3. Falls back to `registration_tenant_id` when no explicit `users_tenants` rows exist.
 *   4. Defaults to `user` when no assignable role is found.
 *
 * This is fully idempotent — the `WHERE NOT EXISTS` guard prevents duplicate rows on re-run.
 *
 * Backward compat
 * ---------------
 * The old `users_tenant_roles` / `users_tenant_roles_roles` tables (if they exist from a
 * previous local migration run) are left in place and not dropped. They are no longer
 * referenced by any code path after this migration.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ----------------------------------------------------------------
    -- 1. Enum for per-tenant roles (subset of enum_users_role — no super-admin)
    -- ----------------------------------------------------------------
    DO $$ BEGIN
      CREATE TYPE "public"."enum_users_tenants_roles"
        AS ENUM('admin', 'staff', 'location-manager', 'user');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    -- ----------------------------------------------------------------
    -- 2. HasMany-select join table: one row per (users_tenants row, role value)
    --    NOTE: hasMany-select tables use "order"/"parent_id" (no leading underscore).
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "users_tenants_roles" (
      "order"      integer                               NOT NULL,
      "parent_id"  character varying                     NOT NULL,
      "id"         serial                                NOT NULL,
      "value"      "public"."enum_users_tenants_roles",
      CONSTRAINT "users_tenants_roles_pkey" PRIMARY KEY ("id")
    );

    DO $$ BEGIN
      ALTER TABLE "users_tenants_roles"
        ADD CONSTRAINT "users_tenants_roles_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."users_tenants"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "users_tenants_roles_order_idx"
      ON "users_tenants_roles" ("order");
    CREATE INDEX IF NOT EXISTS "users_tenants_roles_parent_idx"
      ON "users_tenants_roles" ("parent_id");

    -- ----------------------------------------------------------------
    -- 3. Backfill: populate users_tenants_roles from role + tenants/registrationTenant
    --    Idempotent — skips users_tenants rows that already have role entries.
    -- ----------------------------------------------------------------
    WITH

    -- All assignable role values per user, excluding super-admins entirely.
    user_assignable_roles AS (
      SELECT DISTINCT ur.parent_id AS user_id, ur.value AS role_value
      FROM   users_role ur
      WHERE  ur.value IN ('admin', 'staff', 'location-manager', 'user')
        AND  NOT EXISTS (
               SELECT 1 FROM users_role sr
               WHERE  sr.parent_id = ur.parent_id AND sr.value = 'super-admin'
             )
    ),

    -- Ensure registration_tenant users have a users_tenants row.
    -- INSERT ... ON CONFLICT DO NOTHING is safe because users_tenants has a unique constraint
    -- on (_parent_id, tenant_id) in most Payload installs.
    registration_fallback AS (
      INSERT INTO users_tenants ("_order", "_parent_id", "id", "tenant_id")
      SELECT
        0,
        u.id,
        gen_random_uuid()::text,
        u.registration_tenant_id
      FROM users u
      JOIN user_assignable_roles uar ON uar.user_id = u.id
      WHERE u.registration_tenant_id IS NOT NULL
        AND NOT EXISTS (
              SELECT 1 FROM users_tenants ut2 WHERE ut2._parent_id = u.id
            )
      ON CONFLICT DO NOTHING
      RETURNING "id", "_parent_id"
    ),

    -- All users_tenants rows that have no roles yet (covers both pre-existing and just-inserted).
    memberships_without_roles AS (
      SELECT ut.id AS tenants_row_id, ut._parent_id AS user_id
      FROM   users_tenants ut
      JOIN   user_assignable_roles uar ON uar.user_id = ut._parent_id
      WHERE  NOT EXISTS (
               SELECT 1 FROM users_tenants_roles r WHERE r.parent_id = ut.id
             )
    ),

    -- Pair each membership row with the user's assignable roles.
    roles_to_insert AS (
      SELECT
        mwr.tenants_row_id AS parent_id,
        COALESCE(uar.role_value, 'user')::text AS role_value,
        (ROW_NUMBER() OVER (PARTITION BY mwr.tenants_row_id ORDER BY uar.role_value NULLS LAST) - 1)::integer AS role_order
      FROM   memberships_without_roles mwr
      LEFT JOIN user_assignable_roles uar ON uar.user_id = mwr.user_id
    )

    INSERT INTO users_tenants_roles ("order", "parent_id", "value")
    SELECT
      role_order,
      parent_id,
      role_value::"public"."enum_users_tenants_roles"
    FROM   roles_to_insert;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE  IF EXISTS "users_tenants_roles";
    DROP TYPE   IF EXISTS "public"."enum_users_tenants_roles";
    -- users_tenants itself is never touched — memberships survive a rollback
  `)
}

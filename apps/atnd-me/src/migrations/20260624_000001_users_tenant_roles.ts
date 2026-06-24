import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Schema + data migration for per-tenant role assignments.
 *
 * Schema changes
 * --------------
 * Creates the `users_tenant_roles` array table and the `users_tenant_roles_roles` hasMany-select
 * join table, matching the shape Payload generates for the `tenantRoles` field on the Users
 * collection.
 *
 * Data migration (runs immediately after the schema is created)
 * -------------------------------------------------------------
 * For every non-super-admin user whose `tenantRoles` is still empty:
 *   1. Reads their current global `role` values from `users_role`.
 *   2. Reads their tenant memberships from `users_tenants` (with `registration_tenant_id` fallback).
 *   3. Inserts one `users_tenant_roles` row per tenant membership and one `users_tenant_roles_roles`
 *      row per assignable role (admin / staff / location-manager / user).
 *
 * This is fully idempotent — the INSERT … WHERE NOT EXISTS guard prevents duplicates.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ----------------------------------------------------------------
    -- 1. Enum for tenantRoles.roles (subset of enum_users_role — no super-admin)
    -- ----------------------------------------------------------------
    DO $$ BEGIN
      CREATE TYPE "public"."enum_users_tenant_roles_roles"
        AS ENUM('admin', 'staff', 'location-manager', 'user');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    -- ----------------------------------------------------------------
    -- 2. Array sub-document table: one row per (user, tenant) pair
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "users_tenant_roles" (
      "_order"     integer           NOT NULL,
      "_parent_id" integer           NOT NULL,
      "id"         character varying NOT NULL,
      "tenant_id"  integer,
      CONSTRAINT "users_tenant_roles_pkey" PRIMARY KEY ("id")
    );

    DO $$ BEGIN
      ALTER TABLE "users_tenant_roles"
        ADD CONSTRAINT "users_tenant_roles_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "users_tenant_roles"
        ADD CONSTRAINT "users_tenant_roles_tenant_id_tenants_id_fk"
        FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
        ON DELETE SET NULL ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "users_tenant_roles_order_idx"
      ON "users_tenant_roles" ("_order");
    CREATE INDEX IF NOT EXISTS "users_tenant_roles_parent_id_idx"
      ON "users_tenant_roles" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "users_tenant_roles_tenant_idx"
      ON "users_tenant_roles" ("tenant_id");

    -- ----------------------------------------------------------------
    -- 3. HasMany-select join table: one row per (tenantRole row, role value)
    --    NOTE: hasMany-select tables use "order"/"parent_id" (no leading underscore),
    --    unlike array sub-document tables which use "_order"/"_parent_id".
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "users_tenant_roles_roles" (
      "order"      integer                                    NOT NULL,
      "parent_id"  character varying                         NOT NULL,
      "id"         serial                                     NOT NULL,
      "value"      "public"."enum_users_tenant_roles_roles",
      CONSTRAINT "users_tenant_roles_roles_pkey" PRIMARY KEY ("id")
    );

    DO $$ BEGIN
      ALTER TABLE "users_tenant_roles_roles"
        ADD CONSTRAINT "users_tenant_roles_roles_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."users_tenant_roles"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "users_tenant_roles_roles_order_idx"
      ON "users_tenant_roles_roles" ("order");
    CREATE INDEX IF NOT EXISTS "users_tenant_roles_roles_parent_idx"
      ON "users_tenant_roles_roles" ("parent_id");

    -- ----------------------------------------------------------------
    -- 4. Backfill: populate tenantRoles from role + tenants/registrationTenant
    --    Idempotent — skips users who already have rows in users_tenant_roles.
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

    -- Tenant memberships via the multi-tenant plugin join table.
    explicit_memberships AS (
      SELECT ut._parent_id AS user_id, ut.tenant_id
      FROM   users_tenants ut
      JOIN   user_assignable_roles uar ON uar.user_id = ut._parent_id
    ),

    -- Fall back to registrationTenant when a user has no explicit tenants entry.
    registration_memberships AS (
      SELECT u.id AS user_id, u.registration_tenant_id AS tenant_id
      FROM   users u
      JOIN   user_assignable_roles uar ON uar.user_id = u.id
      WHERE  u.registration_tenant_id IS NOT NULL
        AND  NOT EXISTS (
               SELECT 1 FROM users_tenants ut2 WHERE ut2._parent_id = u.id
             )
    ),

    -- Union of all memberships to process.
    all_memberships AS (
      SELECT user_id, tenant_id FROM explicit_memberships
      UNION
      SELECT user_id, tenant_id FROM registration_memberships
    ),

    -- Only process users who do not yet have any tenantRoles rows.
    memberships_to_insert AS (
      SELECT
        am.user_id,
        am.tenant_id,
        -- _order: position within this user's tenantRoles array (0-based)
        (ROW_NUMBER() OVER (PARTITION BY am.user_id ORDER BY am.tenant_id) - 1)::integer AS tenant_order
      FROM all_memberships am
      WHERE NOT EXISTS (
        SELECT 1 FROM users_tenant_roles utr WHERE utr._parent_id = am.user_id
      )
    ),

    -- Insert the array sub-document rows and capture their generated UUIDs.
    inserted_rows AS (
      INSERT INTO users_tenant_roles ("_order", "_parent_id", "id", "tenant_id")
      SELECT tenant_order, user_id, gen_random_uuid()::text, tenant_id
      FROM   memberships_to_insert
      RETURNING "_parent_id", "id", "tenant_id"
    ),

    -- Pair each inserted row with the user's assignable roles.
    roles_to_insert AS (
      SELECT
        ir."id"           AS parent_id,
        uar.role_value,
        (ROW_NUMBER() OVER (PARTITION BY ir."id" ORDER BY uar.role_value) - 1)::integer AS role_order
      FROM   inserted_rows ir
      JOIN   user_assignable_roles uar ON uar.user_id = ir."_parent_id"
    )

    INSERT INTO users_tenant_roles_roles ("order", "parent_id", "value")
    SELECT role_order, parent_id, role_value::text::"public"."enum_users_tenant_roles_roles"
    FROM   roles_to_insert;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "users_tenant_roles_roles";
    DROP TABLE IF EXISTS "users_tenant_roles";
    DROP TYPE  IF EXISTS "public"."enum_users_tenant_roles_roles";
  `)
}

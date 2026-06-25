import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Ensures the `users_tenants_roles` table exists and is populated.
 *
 * Why this migration exists
 * -------------------------
 * The previous migration (20260624_000001_users_tenant_roles) was originally deployed
 * with different content — it created `users_tenant_roles` + `users_tenant_roles_roles`
 * (the old per-tenant roles approach). Payload already tracked it as complete, so when
 * the file was updated in-place to create `users_tenants_roles` (the consolidated approach),
 * the updated SQL was never executed in production.
 *
 * This migration is idempotent and safe to run on:
 *  - Production DBs (have old `users_tenant_roles` / `users_tenant_roles_roles` tables)
 *  - Fresh DBs (where the old tables may not exist)
 *
 * Backfill strategy (two passes)
 * --------------------------------
 * Pass 1 — if `users_tenant_roles_roles` exists (old approach ran), copy those role
 *           values into `users_tenants_roles` by matching on (user_id, tenant_id).
 * Pass 2 — for any `users_tenants` rows that still have no roles after pass 1, derive
 *           roles from the global `users_role` table (same logic as the original migration).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Step 1: Create the enum and table (fully idempotent).
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_users_tenants_roles"
        AS ENUM('admin', 'staff', 'location-manager', 'user');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

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
  `)

  // Step 2: Pass 1 — migrate from old users_tenant_roles_roles table if it exists.
  // Uses EXECUTE so the query is only compiled when the table is confirmed to exist.
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE  table_schema = 'public'
          AND  table_name   = 'users_tenant_roles_roles'
      ) THEN
        EXECUTE '
          INSERT INTO users_tenants_roles ("order", "parent_id", "value")
          SELECT
            utrr."order",
            ut.id       AS parent_id,
            utrr.value::text::\"public\".\"enum_users_tenants_roles\"
          FROM   users_tenant_roles       utr
          JOIN   users_tenant_roles_roles utrr ON utrr.parent_id = utr.id
          JOIN   users_tenants            ut
                 ON  ut._parent_id = utr._parent_id
                 AND ut.tenant_id  = utr.tenant_id
          WHERE  NOT EXISTS (
                   SELECT 1
                   FROM   users_tenants_roles existing
                   WHERE  existing.parent_id = ut.id
                 )
        ';
      END IF;
    END $$;
  `)

  // Step 3: Pass 2 — for any memberships still without roles, derive from users_role.
  // Also creates a users_tenants row via registration_tenant_id if needed.
  await db.execute(sql`
    WITH

    user_assignable_roles AS (
      SELECT DISTINCT ur.parent_id AS user_id, ur.value AS role_value
      FROM   users_role ur
      WHERE  ur.value IN ('admin', 'staff', 'location-manager', 'user')
        AND  NOT EXISTS (
               SELECT 1 FROM users_role sr
               WHERE  sr.parent_id = ur.parent_id AND sr.value = 'super-admin'
             )
    ),

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

    memberships_without_roles AS (
      SELECT ut.id AS tenants_row_id, ut._parent_id AS user_id
      FROM   users_tenants ut
      JOIN   user_assignable_roles uar ON uar.user_id = ut._parent_id
      WHERE  NOT EXISTS (
               SELECT 1 FROM users_tenants_roles r WHERE r.parent_id = ut.id
             )
    ),

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
    DROP TABLE IF EXISTS "users_tenants_roles";
    DROP TYPE  IF EXISTS "public"."enum_users_tenants_roles";
  `)
}

import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Repair for DBs that ran `20260409000001` before it updated `users_role`.
 * `users_roles` was remapped but `users_role` could still contain `tenant-admin`,
 * which breaks enum casts during dev schema push if that label was removed.
 *
 * If Payload fails on startup because push runs before migrations: run
 * `pnpm db:fix-users-role` (or `tsx scripts/fix-users-role-tenant-admin.ts`) once,
 * or run `payload migrate run` with `PAYLOAD_PUSH_SCHEMA` unset (not `1`).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users_role'
      ) THEN
        UPDATE "users_role" SET "value" = 'admin'::"public"."enum_users_role"
        WHERE "value"::text = 'tenant-admin';
      END IF;
    END $$;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Cannot safely restore tenant-admin labels once removed from enum usage.
}

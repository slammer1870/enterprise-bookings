import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Cleanup legacy auth table.
 *
 * NOTE:
 * `users_sessions` is still required by Payload's auth field model (it is queried during Payload init).
 * Dropping it breaks CI / Playwright (admin login & /api/users/me) with:
 *   relation "users_sessions" does not exist
 *
 * If we ever fully remove the auth/session fields that rely on this join table,
 * we can safely reintroduce a drop migration.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    SELECT 1;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Intentionally no-op: we don't want to resurrect the legacy table.
  await db.execute(sql`SELECT 1;`)
}




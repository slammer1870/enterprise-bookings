import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds `scheduler.title` for Payload's `admin.useAsTitle` to render a stable create-page heading.
 *
 * Why:
 * - The Scheduler admin create page was rendering `[Untitled]` when `branch` wasn't populated yet.
 * - We introduced a hidden `title` field in `apps/atnd-me/src/collections/Scheduler/index.ts`.
 * - e2e tests expect the DB column to exist.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "scheduler"
      ADD COLUMN IF NOT EXISTS "title" text NOT NULL DEFAULT 'Scheduler';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "scheduler"
      DROP COLUMN IF EXISTS "title";
  `)
}


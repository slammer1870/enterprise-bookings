import { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

import * as migration_20260610_repair_tenants_checkout_legal_documents from './20260610_repair_tenants_checkout_legal_documents'
import * as migration_20260623_scheduler_last_generation_job_id from './20260623_scheduler_last_generation_job_id'

/**
 * Safety net when earlier migrations were marked applied without effect — e.g.
 * `20260608_tenants_checkout_legal` rewritten after prod ran the old body, build-time
 * migrate targeting a different DATABASE_URI than runtime, or Docker layer cache skipping
 * the migrate step after new migration files landed.
 *
 * Re-applies idempotent repair steps only; safe on DBs that are already up to date.
 */
export async function up(args: MigrateUpArgs): Promise<void> {
  await migration_20260610_repair_tenants_checkout_legal_documents.up(args)
  await migration_20260623_scheduler_last_generation_job_id.up(args)
}

export async function down(args: MigrateDownArgs): Promise<void> {
  await migration_20260623_scheduler_last_generation_job_id.down(args)
  await migration_20260610_repair_tenants_checkout_legal_documents.down(args)
}

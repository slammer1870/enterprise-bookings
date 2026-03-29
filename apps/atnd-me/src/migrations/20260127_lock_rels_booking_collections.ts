import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add booking_transactions_id and class_passes_id to payload_locked_documents_rels
 * so lock-documents queries succeed when config includes transactions and class-passes.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "booking_transactions_id" integer,
      ADD COLUMN IF NOT EXISTS "class_passes_id" integer;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "booking_transactions_id",
      DROP COLUMN IF EXISTS "class_passes_id";
  `)
}

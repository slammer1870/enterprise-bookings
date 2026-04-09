import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * In CI/test we run Payload with `push: false`, so `payload_locked_documents_rels`
 * must include a column per collection that can participate in locked-documents relations.
 *
 * Kyuzo uses an `staffMembers` collection (via plugins), and Payload will reference
 * `payload_locked_documents_rels.staffMembers_id` during auth flows (e.g. first-user creation).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'payload_locked_documents_rels'
          AND column_name = 'staffMembers_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "staffMembers_id" integer;
      END IF;
    END $$;

    -- Add FK only if the staffMembers table exists (it is plugin-provided).
    DO $$ BEGIN
      IF to_regclass('public.staffMembers') IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_staffMembers_fk') THEN
          ALTER TABLE "payload_locked_documents_rels"
          ADD CONSTRAINT "payload_locked_documents_rels_staffMembers_fk"
          FOREIGN KEY ("staffMembers_id") REFERENCES "public"."staffMembers"("id")
          ON DELETE cascade ON UPDATE no action;
        END IF;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_staffMembers_id_idx"
      ON "payload_locked_documents_rels" USING btree ("staffMembers_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_staffMembers_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_staffMembers_id_idx";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "staffMembers_id";
  `)
}



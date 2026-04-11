import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Ensures `payload_locked_documents_rels.staff_members_id` exists.
 * Some databases still have `staffMembers_id` from the baseline migration; the
 * rename in `20260409000001` used `information_schema.columns` with exact
 * `column_name = 'staffMembers_id'`, which can fail to match in PostgreSQL so
 * the rename never ran while the migration row was still recorded.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'payload_locked_documents_rels'
          AND a.attname = 'staff_members_id'
          AND NOT a.attisdropped
      ) AND EXISTS (
        SELECT 1
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'payload_locked_documents_rels'
          AND a.attname = 'staffMembers_id'
          AND NOT a.attisdropped
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" RENAME COLUMN "staffMembers_id" TO "staff_members_id";
      END IF;
    END $$;

    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_class i
        JOIN pg_namespace n ON n.oid = i.relnamespace
        WHERE n.nspname = 'public'
          AND i.relkind = 'i'
          AND i.relname = 'payload_locked_documents_rels_staffMembers_id_idx'
      ) AND NOT EXISTS (
        SELECT 1 FROM pg_class i2
        JOIN pg_namespace n2 ON n2.oid = i2.relnamespace
        WHERE n2.nspname = 'public'
          AND i2.relkind = 'i'
          AND i2.relname = 'payload_locked_documents_rels_staff_members_id_idx'
      ) THEN
        ALTER INDEX "payload_locked_documents_rels_staffMembers_id_idx"
          RENAME TO "payload_locked_documents_rels_staff_members_id_idx";
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'payload_locked_documents_rels'
          AND a.attname = 'staff_members_id'
          AND NOT a.attisdropped
      ) AND NOT EXISTS (
        SELECT 1
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'payload_locked_documents_rels'
          AND a.attname = 'staffMembers_id'
          AND NOT a.attisdropped
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" RENAME COLUMN "staff_members_id" TO "staffMembers_id";
      END IF;
    END $$;

    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_class i
        JOIN pg_namespace n ON n.oid = i.relnamespace
        WHERE n.nspname = 'public'
          AND i.relkind = 'i'
          AND i.relname = 'payload_locked_documents_rels_staff_members_id_idx'
      ) AND NOT EXISTS (
        SELECT 1 FROM pg_class i2
        JOIN pg_namespace n2 ON n2.oid = i2.relnamespace
        WHERE n2.nspname = 'public'
          AND i2.relkind = 'i'
          AND i2.relname = 'payload_locked_documents_rels_staffMembers_id_idx'
      ) THEN
        ALTER INDEX "payload_locked_documents_rels_staff_members_id_idx"
          RENAME TO "payload_locked_documents_rels_staffMembers_id_idx";
      END IF;
    END $$;
  `)
}

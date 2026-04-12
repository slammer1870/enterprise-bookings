import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

import * as migration_20260410_timeslots_event_type_id from './20260410_timeslots_event_type_id'
import * as migration_20260410_timeslots_staff_member_id from './20260410_timeslots_staff_member_id'
import * as migration_20260415_payload_locked_documents_rels_staff_members_id from './20260415_payload_locked_documents_rels_staff_members_id'

/**
 * Re-applies idempotent column fixes after `timeslots` / rel tables exist.
 *
 * Coolify (and similar) run `payload migrate` at image build time. If
 * `20260410_timeslots_staff_member_id` or `20260410_timeslots_event_type_id` ran
 * when `timeslots` did not exist yet, they no-op but are still marked applied —
 * later DDL never adds `staff_member_id` / `event_type_id`. The locked-docs rel
 * rename can also miss when neither snake_case nor camelCase was detected.
 *
 * Calling the prior migrations' `up` again is safe (all branches are guarded).
 */
export async function up(args: MigrateUpArgs): Promise<void> {
  await migration_20260410_timeslots_staff_member_id.up(args)
  await migration_20260410_timeslots_event_type_id.up(args)
  await migration_20260415_payload_locked_documents_rels_staff_members_id.up(args)

  await args.db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'payload_locked_documents_rels'
          AND c.relkind = 'r'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'payload_locked_documents_rels'
          AND a.attname = 'staff_members_id'
          AND NOT a.attisdropped
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'payload_locked_documents_rels'
          AND a.attname = 'staffMembers_id'
          AND NOT a.attisdropped
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "staff_members_id" integer;
      END IF;
    END $$;

    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'payload_locked_documents_rels'
          AND indexname = 'payload_locked_documents_rels_staff_members_id_idx'
      ) THEN
        NULL;
      ELSIF EXISTS (
        SELECT 1
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'payload_locked_documents_rels'
          AND a.attname = 'staff_members_id'
          AND NOT a.attisdropped
      ) THEN
        CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_staff_members_id_idx"
          ON "payload_locked_documents_rels" USING btree ("staff_members_id");
      END IF;
    END $$;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Not reversible: re-applies guarded DDL and may add columns on drifted DBs.
}

import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Part 2/2: migrate role data and rename booking plugin tables to atnd-me slugs.
 * Runs after 20260409000000 so new enum values are committed and safe to use.
 *
 * Table names differ by era: older DBs used `lessons` / `lessons_id`; baseline
 * migrations may already use `timeslots` / `timeslots_id`. All renames are
 * conditional so migrate:fresh and legacy upgrades both succeed.
 *
 * Payload field renames (`eventType`, `staffMember`, `defaultEventType`) expect
 * snake_case columns `event_type_id` / `staff_member_id` / `default_event_type_id`;
 * older migrations still used `class_option_id` / `staffMember_id` / etc.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
      ) THEN
        UPDATE "users" SET "role" = CASE "role"::text
          WHEN 'tenant-admin' THEN 'admin'::"public"."enum_users_role"
          WHEN 'admin' THEN 'super-admin'::"public"."enum_users_role"
          ELSE "role"
        END;
      END IF;
    END $$;

    UPDATE "users_roles" SET "value" = CASE "value"::text
      WHEN 'tenant-admin' THEN 'admin'::"public"."enum_users_roles"
      WHEN 'admin' THEN 'super-admin'::"public"."enum_users_roles"
      ELSE "value"
    END;

    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users_role'
      ) THEN
        UPDATE "users_role" SET "value" = CASE "value"::text
          WHEN 'tenant-admin' THEN 'admin'::"public"."enum_users_role"
          WHEN 'admin' THEN 'super-admin'::"public"."enum_users_role"
          ELSE "value"
        END;
      END IF;
    END $$;

    UPDATE "admin_invitations" SET "role" = CASE "role"::text
      WHEN 'tenant-admin' THEN 'admin'::"public"."enum_admin_invitations_role"
      WHEN 'admin' THEN 'super-admin'::"public"."enum_admin_invitations_role"
      ELSE "role"
    END;

    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'lessons'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'timeslots'
      ) THEN
        ALTER TABLE "lessons" RENAME TO "timeslots";
      END IF;
    END $$;

    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'class_options'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'event_types'
      ) THEN
        ALTER TABLE "class_options" RENAME TO "event_types";
      END IF;
    END $$;

    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'staff-members'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'staff_members'
      ) THEN
        ALTER TABLE "staff-members" RENAME TO "staff_members";
      END IF;
    END $$;

    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'class_options_rels'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'event_types_rels'
      ) THEN
        ALTER TABLE "class_options_rels" RENAME TO "event_types_rels";
      END IF;
    END $$;

    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payload_locked_documents_rels' AND column_name = 'lessons_id'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payload_locked_documents_rels' AND column_name = 'timeslots_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" RENAME COLUMN "lessons_id" TO "timeslots_id";
      END IF;
    END $$;

    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payload_locked_documents_rels' AND column_name = 'class_options_id'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payload_locked_documents_rels' AND column_name = 'event_types_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" RENAME COLUMN "class_options_id" TO "event_types_id";
      END IF;
    END $$;

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
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'timeslots' AND column_name = 'class_option_id'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'timeslots' AND column_name = 'event_type_id'
      ) THEN
        ALTER TABLE "timeslots" RENAME COLUMN "class_option_id" TO "event_type_id";
      END IF;
    END $$;

    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'timeslots' AND column_name = 'staffMember_id'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'timeslots' AND column_name = 'staff_member_id'
      ) THEN
        ALTER TABLE "timeslots" RENAME COLUMN "staffMember_id" TO "staff_member_id";
      END IF;
    END $$;

    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'scheduler' AND column_name = 'default_class_option_id'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'scheduler' AND column_name = 'default_event_type_id'
      ) THEN
        ALTER TABLE "scheduler" RENAME COLUMN "default_class_option_id" TO "default_event_type_id";
      END IF;
    END $$;

    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'scheduler_week_days_time_slot' AND column_name = 'class_option_id'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'scheduler_week_days_time_slot' AND column_name = 'event_type_id'
      ) THEN
        ALTER TABLE "scheduler_week_days_time_slot" RENAME COLUMN "class_option_id" TO "event_type_id";
      END IF;
    END $$;

    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'scheduler_week_days_time_slot' AND column_name = 'staffMember_id'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'scheduler_week_days_time_slot' AND column_name = 'staff_member_id'
      ) THEN
        ALTER TABLE "scheduler_week_days_time_slot" RENAME COLUMN "staffMember_id" TO "staff_member_id";
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'scheduler_week_days_time_slot' AND column_name = 'staff_member_id'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'scheduler_week_days_time_slot' AND column_name = 'staffMember_id'
      ) THEN
        ALTER TABLE "scheduler_week_days_time_slot" RENAME COLUMN "staff_member_id" TO "staffMember_id";
      END IF;
    END $$;

    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'scheduler_week_days_time_slot' AND column_name = 'event_type_id'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'scheduler_week_days_time_slot' AND column_name = 'class_option_id'
      ) THEN
        ALTER TABLE "scheduler_week_days_time_slot" RENAME COLUMN "event_type_id" TO "class_option_id";
      END IF;
    END $$;

    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'scheduler' AND column_name = 'default_event_type_id'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'scheduler' AND column_name = 'default_class_option_id'
      ) THEN
        ALTER TABLE "scheduler" RENAME COLUMN "default_event_type_id" TO "default_class_option_id";
      END IF;
    END $$;

    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'timeslots' AND column_name = 'staff_member_id'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'timeslots' AND column_name = 'staffMember_id'
      ) THEN
        ALTER TABLE "timeslots" RENAME COLUMN "staff_member_id" TO "staffMember_id";
      END IF;
    END $$;

    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'timeslots' AND column_name = 'event_type_id'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'timeslots' AND column_name = 'class_option_id'
      ) THEN
        ALTER TABLE "timeslots" RENAME COLUMN "event_type_id" TO "class_option_id";
      END IF;
    END $$;

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
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payload_locked_documents_rels' AND column_name = 'event_types_id'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payload_locked_documents_rels' AND column_name = 'class_options_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" RENAME COLUMN "event_types_id" TO "class_options_id";
      END IF;
    END $$;

    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'event_types_rels'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'class_options_rels'
      ) THEN
        ALTER TABLE "event_types_rels" RENAME TO "class_options_rels";
      END IF;
    END $$;

    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'staff_members'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'staff-members'
      ) THEN
        ALTER TABLE "staff_members" RENAME TO "staff-members";
      END IF;
    END $$;

    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'event_types'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'class_options'
      ) THEN
        ALTER TABLE "event_types" RENAME TO "class_options";
      END IF;
    END $$;

    -- Intentionally omit timeslots↔lessons and timeslots_id↔lessons_id here: after
    -- up(), we cannot tell legacy-lesson DBs from baseline-timeslot DBs.

    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
      ) THEN
        UPDATE "users" SET "role" = CASE "role"::text
          WHEN 'super-admin' THEN 'admin'::"public"."enum_users_role"
          WHEN 'admin' THEN 'tenant-admin'::"public"."enum_users_role"
          ELSE "role"
        END;
      END IF;
    END $$;

    UPDATE "users_roles" SET "value" = CASE "value"::text
      WHEN 'super-admin' THEN 'admin'::"public"."enum_users_roles"
      WHEN 'admin' THEN 'tenant-admin'::"public"."enum_users_roles"
      ELSE "value"
    END;

    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users_role'
      ) THEN
        UPDATE "users_role" SET "value" = CASE "value"::text
          WHEN 'super-admin' THEN 'admin'::"public"."enum_users_role"
          WHEN 'admin' THEN 'tenant-admin'::"public"."enum_users_role"
          ELSE "value"
        END;
      END IF;
    END $$;

    UPDATE "admin_invitations" SET "role" = CASE "role"::text
      WHEN 'super-admin' THEN 'admin'::"public"."enum_admin_invitations_role"
      WHEN 'admin' THEN 'tenant-admin'::"public"."enum_admin_invitations_role"
      ELSE "role"
    END;
  `)
}

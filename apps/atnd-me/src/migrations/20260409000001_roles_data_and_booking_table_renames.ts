import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Part 2/2: migrate role data and rename booking plugin tables to atnd-me slugs.
 * Runs after 20260409000000 so new enum values are committed and safe to use.
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

    UPDATE "admin_invitations" SET "role" = CASE "role"::text
      WHEN 'tenant-admin' THEN 'admin'::"public"."enum_admin_invitations_role"
      WHEN 'admin' THEN 'super-admin'::"public"."enum_admin_invitations_role"
      ELSE "role"
    END;

    ALTER TABLE "lessons" RENAME TO "timeslots";
    ALTER TABLE "class_options" RENAME TO "event_types";
    ALTER TABLE "instructors" RENAME TO "staff_members";

    DO $$ BEGIN
      ALTER TABLE "class_options_rels" RENAME TO "event_types_rels";
    EXCEPTION
      WHEN undefined_table THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" RENAME COLUMN "lessons_id" TO "timeslots_id";
    EXCEPTION
      WHEN undefined_column THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" RENAME COLUMN "class_options_id" TO "event_types_id";
    EXCEPTION
      WHEN undefined_column THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" RENAME COLUMN "instructors_id" TO "staff_members_id";
    EXCEPTION
      WHEN undefined_column THEN NULL;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" RENAME COLUMN "timeslots_id" TO "lessons_id";
    EXCEPTION
      WHEN undefined_column THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" RENAME COLUMN "event_types_id" TO "class_options_id";
    EXCEPTION
      WHEN undefined_column THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" RENAME COLUMN "staff_members_id" TO "instructors_id";
    EXCEPTION
      WHEN undefined_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "event_types_rels" RENAME TO "class_options_rels";
    EXCEPTION
      WHEN undefined_table THEN NULL;
    END $$;

    ALTER TABLE "timeslots" RENAME TO "lessons";
    ALTER TABLE "event_types" RENAME TO "class_options";
    ALTER TABLE "staff_members" RENAME TO "instructors";

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

    UPDATE "admin_invitations" SET "role" = CASE "role"::text
      WHEN 'super-admin' THEN 'admin'::"public"."enum_admin_invitations_role"
      WHEN 'admin' THEN 'tenant-admin'::"public"."enum_admin_invitations_role"
      ELSE "role"
    END;
  `)
}

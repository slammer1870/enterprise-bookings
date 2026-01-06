import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Rename role enum value from 'customer' to 'user' to align with Better Auth plugin expectations.
 * This migration ensures the database enum matches the role values expected by the Better Auth plugin.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Rename the enum value 'customer' to 'user' in enum_users_role
  // Note: This will also update all existing rows that have 'customer' to 'user'
  await db.execute(sql`
    DO $$ BEGIN
      -- Check if the enum type exists and has 'customer' value
      IF EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'enum_users_role' AND e.enumlabel = 'customer'
      ) THEN
        -- Rename 'customer' to 'user'
        ALTER TYPE "public"."enum_users_role" RENAME VALUE 'customer' TO 'user';
      END IF;
    END $$;
  `)

  // Do the same for enum_users_roles (plural - from rolesPlugin)
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'enum_users_roles' AND e.enumlabel = 'customer'
      ) THEN
        ALTER TYPE "public"."enum_users_roles" RENAME VALUE 'customer' TO 'user';
      END IF;
    END $$;
  `)

  // Also rename any enum value in admin_invitations if it exists
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'enum_admin_invitations_role' AND e.enumlabel = 'customer'
      ) THEN
        ALTER TYPE "public"."enum_admin_invitations_role" RENAME VALUE 'customer' TO 'user';
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Reverse: rename 'user' back to 'customer'
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'enum_users_role' AND e.enumlabel = 'user'
      ) THEN
        ALTER TYPE "public"."enum_users_role" RENAME VALUE 'user' TO 'customer';
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'enum_users_roles' AND e.enumlabel = 'user'
      ) THEN
        ALTER TYPE "public"."enum_users_roles" RENAME VALUE 'user' TO 'customer';
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'enum_admin_invitations_role' AND e.enumlabel = 'user'
      ) THEN
        ALTER TYPE "public"."enum_admin_invitations_role" RENAME VALUE 'user' TO 'customer';
      END IF;
    END $$;
  `)
}


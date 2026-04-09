import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Part 1/2: add new enum values only. PostgreSQL does not allow using a newly added
 * enum literal in the same transaction as ALTER TYPE ... ADD VALUE, so data updates
 * and table renames run in the following migration.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TYPE "public"."enum_users_role" ADD VALUE 'super-admin';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TYPE "public"."enum_users_role" ADD VALUE 'staff';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TYPE "public"."enum_users_roles" ADD VALUE 'super-admin';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TYPE "public"."enum_users_roles" ADD VALUE 'staff';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TYPE "public"."enum_admin_invitations_role" ADD VALUE 'super-admin';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TYPE "public"."enum_admin_invitations_role" ADD VALUE 'staff';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // PostgreSQL cannot safely drop enum labels in use; leave types unchanged.
}

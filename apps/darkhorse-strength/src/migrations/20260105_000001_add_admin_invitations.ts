import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Better Auth admin invitations table.
 *
 * In CI, Better Auth (via drizzle) may attempt to reconcile schema at runtime.
 * If this table is missing, drizzle can prompt interactively to decide whether
 * it's a "create" or a "rename" (e.g. from users_sessions), which hangs Playwright.
 *
 * This migration makes the schema explicit and non-interactive.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Enum type used by admin_invitations.role
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_admin_invitations_role" AS ENUM('admin', 'user');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `)

  // Table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "admin_invitations" (
      "id" serial PRIMARY KEY NOT NULL,
      "role" "enum_admin_invitations_role" DEFAULT 'admin' NOT NULL,
      "token" varchar NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // payload_locked_documents_rels relationship column (used by Payload admin locking)
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'payload_locked_documents_rels'
          AND column_name = 'admin_invitations_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "admin_invitations_id" integer;
      END IF;
    END $$;
  `)

  // FK constraint
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_admin_invitations_fk') THEN
        ALTER TABLE "payload_locked_documents_rels"
          ADD CONSTRAINT "payload_locked_documents_rels_admin_invitations_fk"
          FOREIGN KEY ("admin_invitations_id")
          REFERENCES "public"."admin_invitations"("id")
          ON DELETE cascade
          ON UPDATE no action;
      END IF;
    END $$;
  `)

  // Indexes
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "admin_invitations_token_idx" ON "admin_invitations" USING btree ("token");
    CREATE INDEX IF NOT EXISTS "admin_invitations_updated_at_idx" ON "admin_invitations" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "admin_invitations_created_at_idx" ON "admin_invitations" USING btree ("created_at");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_admin_invitations_id_idx"
      ON "payload_locked_documents_rels" USING btree ("admin_invitations_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_admin_invitations_fk";

    DROP INDEX IF EXISTS "payload_locked_documents_rels_admin_invitations_id_idx";

    DO $$ BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'payload_locked_documents_rels'
          AND column_name = 'admin_invitations_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "admin_invitations_id";
      END IF;
    END $$;

    DROP INDEX IF EXISTS "admin_invitations_created_at_idx";
    DROP INDEX IF EXISTS "admin_invitations_updated_at_idx";
    DROP INDEX IF EXISTS "admin_invitations_token_idx";

    DROP TABLE IF EXISTS "admin_invitations" CASCADE;

    DO $$ BEGIN
      DROP TYPE IF EXISTS "public"."enum_admin_invitations_role";
    EXCEPTION
      WHEN OTHERS THEN null;
    END $$;
  `)
}



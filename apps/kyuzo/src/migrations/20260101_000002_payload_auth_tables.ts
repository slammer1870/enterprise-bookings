import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add tables required by `payload-auth` (Better Auth plugin) and the associated locked-documents rel columns.
 *
 * In test/CI we disable `push` (auto schema sync) to avoid interactive Drizzle prompts.
 * That means these plugin collections must be represented in migrations.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_admin_invitations_role" AS ENUM('admin', 'user');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_users_role" AS ENUM('user', 'admin');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "accounts" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL,
      "account_id" varchar NOT NULL,
      "provider_id" varchar NOT NULL,
      "access_token" varchar,
      "refresh_token" varchar,
      "access_token_expires_at" timestamp(3) with time zone,
      "refresh_token_expires_at" timestamp(3) with time zone,
      "scope" varchar,
      "id_token" varchar,
      "password" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "sessions" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL,
      "token" varchar NOT NULL,
      "expires_at" timestamp(3) with time zone NOT NULL,
      "ip_address" varchar,
      "user_agent" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "impersonated_by_id" integer
    );

    CREATE TABLE IF NOT EXISTS "verifications" (
      "id" serial PRIMARY KEY NOT NULL,
      "identifier" varchar NOT NULL,
      "value" varchar NOT NULL,
      "expires_at" timestamp(3) with time zone NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "admin_invitations" (
      "id" serial PRIMARY KEY NOT NULL,
      "role" "enum_admin_invitations_role" DEFAULT 'admin' NOT NULL,
      "token" varchar NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- Users columns used by Better Auth
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email_verified'
      ) THEN
        ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;
      END IF;
    END $$;

    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'image'
      ) THEN
        ALTER TABLE "users" ADD COLUMN "image" varchar;
      END IF;
    END $$;

    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
      ) THEN
        ALTER TABLE "users" ADD COLUMN "role" "enum_users_role" DEFAULT 'user' NOT NULL;
      END IF;
    END $$;

    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'banned'
      ) THEN
        ALTER TABLE "users" ADD COLUMN "banned" boolean DEFAULT false;
      END IF;
    END $$;

    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'ban_reason'
      ) THEN
        ALTER TABLE "users" ADD COLUMN "ban_reason" varchar;
      END IF;
    END $$;

    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'ban_expires'
      ) THEN
        ALTER TABLE "users" ADD COLUMN "ban_expires" timestamp(3) with time zone;
      END IF;
    END $$;

    -- payload_locked_documents_rels needs a column per collection for proper FK + no interactive push prompts
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payload_locked_documents_rels' AND column_name = 'accounts_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "accounts_id" integer;
      END IF;
    END $$;

    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payload_locked_documents_rels' AND column_name = 'sessions_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "sessions_id" integer;
      END IF;
    END $$;

    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payload_locked_documents_rels' AND column_name = 'verifications_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "verifications_id" integer;
      END IF;
    END $$;

    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payload_locked_documents_rels' AND column_name = 'admin_invitations_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "admin_invitations_id" integer;
      END IF;
    END $$;

    -- FKs
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_user_id_users_id_fk') THEN
        ALTER TABLE "accounts"
        ADD CONSTRAINT "accounts_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
        ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_user_id_users_id_fk') THEN
        ALTER TABLE "sessions"
        ADD CONSTRAINT "sessions_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
        ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_impersonated_by_id_users_id_fk') THEN
        ALTER TABLE "sessions"
        ADD CONSTRAINT "sessions_impersonated_by_id_users_id_fk"
        FOREIGN KEY ("impersonated_by_id") REFERENCES "public"."users"("id")
        ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_accounts_fk') THEN
        ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_accounts_fk"
        FOREIGN KEY ("accounts_id") REFERENCES "public"."accounts"("id")
        ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_sessions_fk') THEN
        ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_sessions_fk"
        FOREIGN KEY ("sessions_id") REFERENCES "public"."sessions"("id")
        ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_verifications_fk') THEN
        ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_verifications_fk"
        FOREIGN KEY ("verifications_id") REFERENCES "public"."verifications"("id")
        ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_admin_invitations_fk') THEN
        ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_admin_invitations_fk"
        FOREIGN KEY ("admin_invitations_id") REFERENCES "public"."admin_invitations"("id")
        ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    -- Indexes
    CREATE INDEX IF NOT EXISTS "accounts_user_idx" ON "accounts" USING btree ("user_id");
    CREATE INDEX IF NOT EXISTS "accounts_account_id_idx" ON "accounts" USING btree ("account_id");
    CREATE INDEX IF NOT EXISTS "accounts_updated_at_idx" ON "accounts" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "accounts_created_at_idx" ON "accounts" USING btree ("created_at");

    CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" USING btree ("user_id");
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'sessions_token_idx') THEN
        EXECUTE 'CREATE UNIQUE INDEX "sessions_token_idx" ON "sessions" USING btree ("token")';
      END IF;
    EXCEPTION WHEN OTHERS THEN null;
    END $$;
    CREATE INDEX IF NOT EXISTS "sessions_updated_at_idx" ON "sessions" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "sessions_created_at_idx" ON "sessions" USING btree ("created_at");
    CREATE INDEX IF NOT EXISTS "sessions_impersonated_by_idx" ON "sessions" USING btree ("impersonated_by_id");

    CREATE INDEX IF NOT EXISTS "verifications_identifier_idx" ON "verifications" USING btree ("identifier");
    CREATE INDEX IF NOT EXISTS "verifications_updated_at_idx" ON "verifications" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "verifications_created_at_idx" ON "verifications" USING btree ("created_at");

    CREATE INDEX IF NOT EXISTS "admin_invitations_token_idx" ON "admin_invitations" USING btree ("token");
    CREATE INDEX IF NOT EXISTS "admin_invitations_updated_at_idx" ON "admin_invitations" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "admin_invitations_created_at_idx" ON "admin_invitations" USING btree ("created_at");

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_accounts_id_idx" ON "payload_locked_documents_rels" USING btree ("accounts_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_sessions_id_idx" ON "payload_locked_documents_rels" USING btree ("sessions_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_verifications_id_idx" ON "payload_locked_documents_rels" USING btree ("verifications_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_admin_invitations_id_idx" ON "payload_locked_documents_rels" USING btree ("admin_invitations_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- Drop FKs first
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_admin_invitations_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_verifications_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_sessions_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_accounts_fk";

    ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_impersonated_by_id_users_id_fk";
    ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_user_id_users_id_fk";
    ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "accounts_user_id_users_id_fk";

    -- Drop indexes
    DROP INDEX IF EXISTS "payload_locked_documents_rels_admin_invitations_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_verifications_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_sessions_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_accounts_id_idx";

    DROP INDEX IF EXISTS "admin_invitations_created_at_idx";
    DROP INDEX IF EXISTS "admin_invitations_updated_at_idx";
    DROP INDEX IF EXISTS "admin_invitations_token_idx";

    DROP INDEX IF EXISTS "verifications_created_at_idx";
    DROP INDEX IF EXISTS "verifications_updated_at_idx";
    DROP INDEX IF EXISTS "verifications_identifier_idx";

    DROP INDEX IF EXISTS "sessions_impersonated_by_idx";
    DROP INDEX IF EXISTS "sessions_created_at_idx";
    DROP INDEX IF EXISTS "sessions_updated_at_idx";
    DROP INDEX IF EXISTS "sessions_token_idx";
    DROP INDEX IF EXISTS "sessions_user_idx";

    DROP INDEX IF EXISTS "accounts_created_at_idx";
    DROP INDEX IF EXISTS "accounts_updated_at_idx";
    DROP INDEX IF EXISTS "accounts_account_id_idx";
    DROP INDEX IF EXISTS "accounts_user_idx";

    -- Drop columns added to locked-documents rels
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "admin_invitations_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "verifications_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "sessions_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "accounts_id";

    -- Drop tables
    DROP TABLE IF EXISTS "admin_invitations" CASCADE;
    DROP TABLE IF EXISTS "verifications" CASCADE;
    DROP TABLE IF EXISTS "sessions" CASCADE;
    DROP TABLE IF EXISTS "accounts" CASCADE;

    -- Drop enums (best-effort)
    DROP TYPE IF EXISTS "public"."enum_admin_invitations_role";
    DROP TYPE IF EXISTS "public"."enum_users_role";
  `)
}









import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    CREATE TYPE "public"."enum_admin_invitations_role" AS ENUM('admin', 'user');
   EXCEPTION WHEN duplicate_object THEN null;
   END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'user');
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
  
  CREATE TABLE IF NOT EXISTS "instructors" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar,
	"description" varchar,
	"profile_image_id" integer,
	"active" boolean DEFAULT true,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "users_sessions" (
	"_order" integer NOT NULL,
	"_parent_id" integer NOT NULL,
	"id" varchar PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone,
	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "payload_kv" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar NOT NULL,
	"data" jsonb NOT NULL
  );
  
  ALTER TABLE "lessons" DROP CONSTRAINT IF EXISTS "lessons_instructor_id_users_id_fk";
  
  ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_image_id_media_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_payload_jobs_fk";
  
  ALTER TABLE "scheduler_week_days_time_slot" DROP CONSTRAINT IF EXISTS "scheduler_week_days_time_slot_instructor_id_users_id_fk";
  
  DROP INDEX IF EXISTS "users_image_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_payload_jobs_id_idx";
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-01-15T13:07:04.505Z';
  ALTER TABLE "lessons" ALTER COLUMN "original_lock_out_time" SET DEFAULT 0;
  ALTER TABLE "users" ALTER COLUMN "name" DROP NOT NULL;
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2026-01-15T13:07:04.601Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2026-01-15T13:07:04.601Z';
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" boolean DEFAULT false NOT NULL;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "image" varchar;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "enum_users_role" DEFAULT 'user' NOT NULL;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "banned" boolean DEFAULT false;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ban_reason" varchar;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ban_expires" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "accounts_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "sessions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "verifications_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "admin_invitations_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "instructors_id" integer;
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_user_id_users_id_fk') THEN
      ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    END IF;
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_user_id_users_id_fk') THEN
      ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    END IF;
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_impersonated_by_id_users_id_fk') THEN
      ALTER TABLE "sessions" ADD CONSTRAINT "sessions_impersonated_by_id_users_id_fk" FOREIGN KEY ("impersonated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    END IF;
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'instructors_user_id_users_id_fk') THEN
      ALTER TABLE "instructors" ADD CONSTRAINT "instructors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    END IF;
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'instructors_profile_image_id_media_id_fk') THEN
      ALTER TABLE "instructors" ADD CONSTRAINT "instructors_profile_image_id_media_id_fk" FOREIGN KEY ("profile_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    END IF;
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_sessions_parent_id_fk') THEN
      ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  CREATE INDEX IF NOT EXISTS "accounts_user_idx" ON "accounts" USING btree ("user_id");
  CREATE INDEX IF NOT EXISTS "accounts_account_id_idx" ON "accounts" USING btree ("account_id");
  CREATE INDEX IF NOT EXISTS "accounts_updated_at_idx" ON "accounts" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "accounts_created_at_idx" ON "accounts" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" USING btree ("user_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_idx" ON "sessions" USING btree ("token");
  CREATE INDEX IF NOT EXISTS "sessions_updated_at_idx" ON "sessions" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "sessions_created_at_idx" ON "sessions" USING btree ("created_at");
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'impersonated_by_id') THEN
      ALTER TABLE "sessions" ADD COLUMN "impersonated_by_id" integer;
    END IF;
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'impersonated_by_id') THEN
      CREATE INDEX IF NOT EXISTS "sessions_impersonated_by_idx" ON "sessions" USING btree ("impersonated_by_id");
    END IF;
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  CREATE INDEX IF NOT EXISTS "verifications_identifier_idx" ON "verifications" USING btree ("identifier");
  CREATE INDEX IF NOT EXISTS "verifications_updated_at_idx" ON "verifications" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "verifications_created_at_idx" ON "verifications" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "admin_invitations_token_idx" ON "admin_invitations" USING btree ("token");
  CREATE INDEX IF NOT EXISTS "admin_invitations_updated_at_idx" ON "admin_invitations" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "admin_invitations_created_at_idx" ON "admin_invitations" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "instructors_user_idx" ON "instructors" USING btree ("user_id");
  CREATE INDEX IF NOT EXISTS "instructors_profile_image_idx" ON "instructors" USING btree ("profile_image_id");
  CREATE INDEX IF NOT EXISTS "instructors_updated_at_idx" ON "instructors" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "instructors_created_at_idx" ON "instructors" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lessons_instructor_id_instructors_id_fk') THEN
      ALTER TABLE "lessons" ADD CONSTRAINT "lessons_instructor_id_instructors_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructors"("id") ON DELETE set null ON UPDATE no action;
    END IF;
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_accounts_fk') THEN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_accounts_fk" FOREIGN KEY ("accounts_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_sessions_fk') THEN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sessions_fk" FOREIGN KEY ("sessions_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_verifications_fk') THEN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_verifications_fk" FOREIGN KEY ("verifications_id") REFERENCES "public"."verifications"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_admin_invitations_fk') THEN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_admin_invitations_fk" FOREIGN KEY ("admin_invitations_id") REFERENCES "public"."admin_invitations"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_instructors_fk') THEN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_instructors_fk" FOREIGN KEY ("instructors_id") REFERENCES "public"."instructors"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scheduler_week_days_time_slot_instructor_id_instructors_id_fk') THEN
      ALTER TABLE "scheduler_week_days_time_slot" ADD CONSTRAINT "scheduler_week_days_time_slot_instructor_id_instructors_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructors"("id") ON DELETE set null ON UPDATE no action;
    END IF;
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_accounts_id_idx" ON "payload_locked_documents_rels" USING btree ("accounts_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_sessions_id_idx" ON "payload_locked_documents_rels" USING btree ("sessions_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_verifications_id_idx" ON "payload_locked_documents_rels" USING btree ("verifications_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_admin_invitations_id_idx" ON "payload_locked_documents_rels" USING btree ("admin_invitations_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_instructors_id_idx" ON "payload_locked_documents_rels" USING btree ("instructors_id");
  ALTER TABLE "users" DROP COLUMN IF EXISTS "image_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "payload_jobs_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "accounts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "sessions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "verifications" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "admin_invitations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "instructors" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "users_sessions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_kv" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "accounts" CASCADE;
  DROP TABLE "sessions" CASCADE;
  DROP TABLE "verifications" CASCADE;
  DROP TABLE "admin_invitations" CASCADE;
  DROP TABLE "instructors" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  ALTER TABLE "lessons" DROP CONSTRAINT "lessons_instructor_id_instructors_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_accounts_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_sessions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_verifications_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_admin_invitations_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_instructors_fk";
  
  ALTER TABLE "scheduler_week_days_time_slot" DROP CONSTRAINT "scheduler_week_days_time_slot_instructor_id_instructors_id_fk";
  
  DROP INDEX "payload_locked_documents_rels_accounts_id_idx";
  DROP INDEX "payload_locked_documents_rels_sessions_id_idx";
  DROP INDEX "payload_locked_documents_rels_verifications_id_idx";
  DROP INDEX "payload_locked_documents_rels_admin_invitations_id_idx";
  DROP INDEX "payload_locked_documents_rels_instructors_id_idx";
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-12-09T16:41:50.230Z';
  ALTER TABLE "lessons" ALTER COLUMN "original_lock_out_time" DROP DEFAULT;
  ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL;
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-12-09T16:41:50.230Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-12-09T16:41:50.230Z';
  ALTER TABLE "users" ADD COLUMN "image_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "payload_jobs_id" integer;
  ALTER TABLE "lessons" ADD CONSTRAINT "lessons_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_jobs_fk" FOREIGN KEY ("payload_jobs_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scheduler_week_days_time_slot" ADD CONSTRAINT "scheduler_week_days_time_slot_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "users_image_idx" ON "users" USING btree ("image_id");
  CREATE INDEX "payload_locked_documents_rels_payload_jobs_id_idx" ON "payload_locked_documents_rels" USING btree ("payload_jobs_id");
  ALTER TABLE "users" DROP COLUMN "email_verified";
  ALTER TABLE "users" DROP COLUMN "image";
  ALTER TABLE "users" DROP COLUMN "role";
  ALTER TABLE "users" DROP COLUMN "banned";
  ALTER TABLE "users" DROP COLUMN "ban_reason";
  ALTER TABLE "users" DROP COLUMN "ban_expires";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "accounts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "sessions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "verifications_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "admin_invitations_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "instructors_id";
  DROP TYPE "public"."enum_admin_invitations_role";
  DROP TYPE "public"."enum_users_role";`)
}

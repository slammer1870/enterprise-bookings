import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Create enum types only if they don't exist
  await db.execute(sql`
   DO $$ BEGIN
    CREATE TYPE "public"."enum_admin_invitations_role" AS ENUM('admin', 'user');
   EXCEPTION
    WHEN duplicate_object THEN null;
   END $$;
  `)
  
  await db.execute(sql`
   DO $$ BEGIN
    CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'user');
   EXCEPTION
    WHEN duplicate_object THEN null;
   END $$;
  `)
  
  // Create tables only if they don't exist (accounts, sessions, verifications, instructors already exist from previous migration)
  await db.execute(sql`
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
  `)
  
  // Drop constraints if they exist
  await db.execute(sql`
  DO $$ BEGIN
    ALTER TABLE "lessons" DROP CONSTRAINT IF EXISTS "lessons_instructor_id_users_id_fk";
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  
  DO $$ BEGIN
    ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_image_id_media_id_fk";
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  
  DO $$ BEGIN
    ALTER TABLE "scheduler_week_days_time_slot" DROP CONSTRAINT IF EXISTS "scheduler_week_days_time_slot_instructor_id_users_id_fk";
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  
  DROP INDEX IF EXISTS "users_image_idx";
  `)
  
  // Alter columns
  await db.execute(sql`
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-12-08T15:33:22.502Z';
  ALTER TABLE "lessons" ALTER COLUMN "original_lock_out_time" SET DEFAULT 0;
  ALTER TABLE "users" ALTER COLUMN "name" DROP NOT NULL;
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-12-08T15:33:22.607Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-12-08T15:33:22.607Z';
  `)
  
  // Add columns only if they don't exist
  await db.execute(sql`
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email_verified') THEN
      ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'image') THEN
      ALTER TABLE "users" ADD COLUMN "image" varchar;
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role') THEN
      ALTER TABLE "users" ADD COLUMN "role" "enum_users_role" DEFAULT 'user' NOT NULL;
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'banned') THEN
      ALTER TABLE "users" ADD COLUMN "banned" boolean DEFAULT false;
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'ban_reason') THEN
      ALTER TABLE "users" ADD COLUMN "ban_reason" varchar;
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'ban_expires') THEN
      ALTER TABLE "users" ADD COLUMN "ban_expires" timestamp(3) with time zone;
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payload_locked_documents_rels' AND column_name = 'accounts_id') THEN
      ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "accounts_id" integer;
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payload_locked_documents_rels' AND column_name = 'sessions_id') THEN
      ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "sessions_id" integer;
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payload_locked_documents_rels' AND column_name = 'verifications_id') THEN
      ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "verifications_id" integer;
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payload_locked_documents_rels' AND column_name = 'admin_invitations_id') THEN
      ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "admin_invitations_id" integer;
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payload_locked_documents_rels' AND column_name = 'instructors_id') THEN
      ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "instructors_id" integer;
    END IF;
  END $$;
  `)
  
  // Add constraints only if they don't exist
  await db.execute(sql`
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_user_id_users_id_fk') THEN
      ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_user_id_users_id_fk') THEN
      ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_impersonated_by_id_users_id_fk') THEN
      ALTER TABLE "sessions" ADD CONSTRAINT "sessions_impersonated_by_id_users_id_fk" FOREIGN KEY ("impersonated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'instructors_user_id_users_id_fk') THEN
      ALTER TABLE "instructors" ADD CONSTRAINT "instructors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'instructors_profile_image_id_media_id_fk') THEN
      ALTER TABLE "instructors" ADD CONSTRAINT "instructors_profile_image_id_media_id_fk" FOREIGN KEY ("profile_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lessons_instructor_id_instructors_id_fk') THEN
      ALTER TABLE "lessons" ADD CONSTRAINT "lessons_instructor_id_instructors_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructors"("id") ON DELETE set null ON UPDATE no action;
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_accounts_fk') THEN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_accounts_fk" FOREIGN KEY ("accounts_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_sessions_fk') THEN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sessions_fk" FOREIGN KEY ("sessions_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_verifications_fk') THEN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_verifications_fk" FOREIGN KEY ("verifications_id") REFERENCES "public"."verifications"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_admin_invitations_fk') THEN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_admin_invitations_fk" FOREIGN KEY ("admin_invitations_id") REFERENCES "public"."admin_invitations"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_instructors_fk') THEN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_instructors_fk" FOREIGN KEY ("instructors_id") REFERENCES "public"."instructors"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scheduler_week_days_time_slot_instructor_id_instructors_id_fk') THEN
      ALTER TABLE "scheduler_week_days_time_slot" ADD CONSTRAINT "scheduler_week_days_time_slot_instructor_id_instructors_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructors"("id") ON DELETE set null ON UPDATE no action;
    END IF;
  END $$;
  `)
  
  // Create indexes only if they don't exist
  await db.execute(sql`
  CREATE INDEX IF NOT EXISTS "accounts_user_idx" ON "accounts" USING btree ("user_id");
  CREATE INDEX IF NOT EXISTS "accounts_account_id_idx" ON "accounts" USING btree ("account_id");
  CREATE INDEX IF NOT EXISTS "accounts_updated_at_idx" ON "accounts" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "accounts_created_at_idx" ON "accounts" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" USING btree ("user_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_idx" ON "sessions" USING btree ("token");
  CREATE INDEX IF NOT EXISTS "sessions_updated_at_idx" ON "sessions" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "sessions_created_at_idx" ON "sessions" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "sessions_impersonated_by_idx" ON "sessions" USING btree ("impersonated_by_id");
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
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_accounts_id_idx" ON "payload_locked_documents_rels" USING btree ("accounts_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_sessions_id_idx" ON "payload_locked_documents_rels" USING btree ("sessions_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_verifications_id_idx" ON "payload_locked_documents_rels" USING btree ("verifications_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_admin_invitations_id_idx" ON "payload_locked_documents_rels" USING btree ("admin_invitations_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_instructors_id_idx" ON "payload_locked_documents_rels" USING btree ("instructors_id");
  `)
  
  // Drop column only if it exists
  await db.execute(sql`
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'image_id') THEN
      ALTER TABLE "users" DROP COLUMN "image_id";
    END IF;
  END $$;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accounts') THEN
      ALTER TABLE "accounts" DISABLE ROW LEVEL SECURITY;
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sessions') THEN
      ALTER TABLE "sessions" DISABLE ROW LEVEL SECURITY;
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'verifications') THEN
      ALTER TABLE "verifications" DISABLE ROW LEVEL SECURITY;
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_invitations') THEN
      ALTER TABLE "admin_invitations" DISABLE ROW LEVEL SECURITY;
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'instructors') THEN
      ALTER TABLE "instructors" DISABLE ROW LEVEL SECURITY;
    END IF;
  END $$;
  
  DROP TABLE IF EXISTS "admin_invitations" CASCADE;
  
  DO $$ BEGIN
    ALTER TABLE "lessons" DROP CONSTRAINT IF EXISTS "lessons_instructor_id_instructors_id_fk";
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  
  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_accounts_fk";
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  
  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_sessions_fk";
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  
  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_verifications_fk";
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  
  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_admin_invitations_fk";
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  
  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_instructors_fk";
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  
  DO $$ BEGIN
    ALTER TABLE "scheduler_week_days_time_slot" DROP CONSTRAINT IF EXISTS "scheduler_week_days_time_slot_instructor_id_instructors_id_fk";
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_accounts_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_sessions_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_verifications_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_admin_invitations_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_instructors_id_idx";
  
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-12-06T11:02:40.662Z';
  ALTER TABLE "lessons" ALTER COLUMN "original_lock_out_time" DROP DEFAULT;
  ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL;
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-12-06T11:02:40.663Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-12-06T11:02:40.663Z';
  
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'image_id') THEN
      ALTER TABLE "users" ADD COLUMN "image_id" integer;
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lessons_instructor_id_users_id_fk') THEN
      ALTER TABLE "lessons" ADD CONSTRAINT "lessons_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_image_id_media_id_fk') THEN
      ALTER TABLE "users" ADD CONSTRAINT "users_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scheduler_week_days_time_slot_instructor_id_users_id_fk') THEN
      ALTER TABLE "scheduler_week_days_time_slot" ADD CONSTRAINT "scheduler_week_days_time_slot_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    END IF;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "users_image_idx" ON "users" USING btree ("image_id");
  
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email_verified') THEN
      ALTER TABLE "users" DROP COLUMN "email_verified";
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'image') THEN
      ALTER TABLE "users" DROP COLUMN "image";
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role') THEN
      ALTER TABLE "users" DROP COLUMN "role";
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'banned') THEN
      ALTER TABLE "users" DROP COLUMN "banned";
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'ban_reason') THEN
      ALTER TABLE "users" DROP COLUMN "ban_reason";
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'ban_expires') THEN
      ALTER TABLE "users" DROP COLUMN "ban_expires";
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payload_locked_documents_rels' AND column_name = 'accounts_id') THEN
      ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "accounts_id";
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payload_locked_documents_rels' AND column_name = 'sessions_id') THEN
      ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "sessions_id";
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payload_locked_documents_rels' AND column_name = 'verifications_id') THEN
      ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "verifications_id";
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payload_locked_documents_rels' AND column_name = 'admin_invitations_id') THEN
      ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "admin_invitations_id";
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payload_locked_documents_rels' AND column_name = 'instructors_id') THEN
      ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "instructors_id";
    END IF;
  END $$;
  
  DO $$ BEGIN
    DROP TYPE IF EXISTS "public"."enum_admin_invitations_role";
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  
  DO $$ BEGIN
    DROP TYPE IF EXISTS "public"."enum_users_role";
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  `)
}

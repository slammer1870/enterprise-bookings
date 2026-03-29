import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Create tables only if they don't exist
  await db.execute(sql`
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
  `)
  
  // Drop constraints if they exist
  await db.execute(sql`
  DO $$ BEGIN
    ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_parent_id_users_id_fk";
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  
  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_payload_jobs_fk";
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  `)
  
  // Handle enum type recreation
  await db.execute(sql`
  ALTER TABLE "users_roles" ALTER COLUMN "value" SET DATA TYPE text;
  DO $$ BEGIN
    DROP TYPE "public"."enum_users_roles";
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_users_roles" AS ENUM('user', 'admin');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  ALTER TABLE "users_roles" ALTER COLUMN "value" SET DATA TYPE "public"."enum_users_roles" USING "value"::"public"."enum_users_roles";
  `)
  
  // Drop indexes if they exist
  await db.execute(sql`
  DROP INDEX IF EXISTS "class_options_payment_methods_payment_methods_allowed_drop_in_idx";
  DROP INDEX IF EXISTS "users_parent_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_payload_jobs_id_idx";
  `)
  
  // Alter table defaults
  await db.execute(sql`
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-01-20T20:07:15.435Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2026-01-20T20:07:15.538Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2026-01-20T20:07:15.538Z';
  `)
  
  // Add columns only if they don't exist
  await db.execute(sql`
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pages_blocks_faqs' AND column_name = 'title') THEN
      ALTER TABLE "pages_blocks_faqs" ADD COLUMN "title" varchar DEFAULT 'FAQs';
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'parent_user_id') THEN
      ALTER TABLE "users" ADD COLUMN "parent_user_id" integer;
    END IF;
  END $$;
  `)
  
  // Add constraints and indexes only if they don't exist
  await db.execute(sql`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'users_sessions_parent_id_fk'
    ) THEN
      ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'users_parent_user_id_users_id_fk'
    ) THEN
      ALTER TABLE "users" ADD CONSTRAINT "users_parent_user_id_users_id_fk" FOREIGN KEY ("parent_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    END IF;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "class_options_payment_methods_payment_methods_allowed_dr_idx" ON "class_options" USING btree ("payment_methods_allowed_drop_in_id");
  CREATE INDEX IF NOT EXISTS "users_parent_user_idx" ON "users" USING btree ("parent_user_id");
  `)
  
  // Drop columns only if they exist
  await db.execute(sql`
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'parent_id') THEN
      ALTER TABLE "users" DROP COLUMN "parent_id";
    END IF;
  END $$;
  
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payload_locked_documents_rels' AND column_name = 'payload_jobs_id') THEN
      ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "payload_jobs_id";
    END IF;
  END $$;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users_sessions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_kv" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  ALTER TABLE "users" DROP CONSTRAINT "users_parent_user_id_users_id_fk";
  
  ALTER TABLE "users_roles" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_users_roles";
  CREATE TYPE "public"."enum_users_roles" AS ENUM('customer', 'admin');
  ALTER TABLE "users_roles" ALTER COLUMN "value" SET DATA TYPE "public"."enum_users_roles" USING "value"::"public"."enum_users_roles";
  DROP INDEX "class_options_payment_methods_payment_methods_allowed_dr_idx";
  DROP INDEX "users_parent_user_idx";
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-12-14T23:07:32.750Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-12-14T23:07:32.852Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-12-14T23:07:32.852Z';
  ALTER TABLE "users" ADD COLUMN "parent_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "payload_jobs_id" integer;
  ALTER TABLE "users" ADD CONSTRAINT "users_parent_id_users_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_jobs_fk" FOREIGN KEY ("payload_jobs_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "class_options_payment_methods_payment_methods_allowed_drop_in_idx" ON "class_options" USING btree ("payment_methods_allowed_drop_in_id");
  CREATE INDEX "users_parent_idx" ON "users" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_payload_jobs_id_idx" ON "payload_locked_documents_rels" USING btree ("payload_jobs_id");
  ALTER TABLE "pages_blocks_faqs" DROP COLUMN "title";
  ALTER TABLE "users" DROP COLUMN "parent_user_id";`)
}

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Add missing columns to payload_locked_documents_rels for all relations
  await db.execute(sql`
    DO $$ 
    BEGIN
      -- Add admin_invitations_id column if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payload_locked_documents_rels' 
        AND column_name = 'admin_invitations_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "admin_invitations_id" integer;
      END IF;

      -- Add accounts_id column if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payload_locked_documents_rels' 
        AND column_name = 'accounts_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "accounts_id" integer;
      END IF;

      -- Add sessions_id column if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payload_locked_documents_rels' 
        AND column_name = 'sessions_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "sessions_id" integer;
      END IF;

      -- Add verifications_id column if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payload_locked_documents_rels' 
        AND column_name = 'verifications_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "verifications_id" integer;
      END IF;

      -- Add pages_id column if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payload_locked_documents_rels' 
        AND column_name = 'pages_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "pages_id" integer;
      END IF;

      -- Add posts_id column if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payload_locked_documents_rels' 
        AND column_name = 'posts_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "posts_id" integer;
      END IF;

      -- Add forms_id column if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payload_locked_documents_rels' 
        AND column_name = 'forms_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "forms_id" integer;
      END IF;

      -- Add form_submissions_id column if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payload_locked_documents_rels' 
        AND column_name = 'form_submissions_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "form_submissions_id" integer;
      END IF;

      -- Add instructors_id column if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payload_locked_documents_rels' 
        AND column_name = 'instructors_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "instructors_id" integer;
      END IF;

      -- Add lessons_id column if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payload_locked_documents_rels' 
        AND column_name = 'lessons_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "lessons_id" integer;
      END IF;

      -- Add class_options_id column if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payload_locked_documents_rels' 
        AND column_name = 'class_options_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "class_options_id" integer;
      END IF;

      -- Add bookings_id column if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payload_locked_documents_rels' 
        AND column_name = 'bookings_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "bookings_id" integer;
      END IF;

      -- Add drop_ins_id column if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payload_locked_documents_rels' 
        AND column_name = 'drop_ins_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "drop_ins_id" integer;
      END IF;

      -- Add transactions_id column if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payload_locked_documents_rels' 
        AND column_name = 'transactions_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "transactions_id" integer;
      END IF;

      -- Add subscriptions_id column if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payload_locked_documents_rels' 
        AND column_name = 'subscriptions_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "subscriptions_id" integer;
      END IF;

      -- Add plans_id column if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payload_locked_documents_rels' 
        AND column_name = 'plans_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "plans_id" integer;
      END IF;

      -- Add payload_jobs_id column if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payload_locked_documents_rels' 
        AND column_name = 'payload_jobs_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "payload_jobs_id" integer;
      END IF;

      -- Add foreign key constraints for tables that exist
      -- admin_invitations
      IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'admin_invitations'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payload_locked_documents_rels_admin_invitations_fk'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" 
        ADD CONSTRAINT "payload_locked_documents_rels_admin_invitations_fk" 
        FOREIGN KEY ("admin_invitations_id") 
        REFERENCES "public"."admin_invitations"("id") 
        ON DELETE cascade ON UPDATE no action;
      END IF;

      -- accounts
      IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'accounts'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payload_locked_documents_rels_accounts_fk'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" 
        ADD CONSTRAINT "payload_locked_documents_rels_accounts_fk" 
        FOREIGN KEY ("accounts_id") 
        REFERENCES "public"."accounts"("id") 
        ON DELETE cascade ON UPDATE no action;
      END IF;

      -- sessions
      IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sessions'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payload_locked_documents_rels_sessions_fk'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" 
        ADD CONSTRAINT "payload_locked_documents_rels_sessions_fk" 
        FOREIGN KEY ("sessions_id") 
        REFERENCES "public"."sessions"("id") 
        ON DELETE cascade ON UPDATE no action;
      END IF;

      -- verifications
      IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'verifications'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payload_locked_documents_rels_verifications_fk'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" 
        ADD CONSTRAINT "payload_locked_documents_rels_verifications_fk" 
        FOREIGN KEY ("verifications_id") 
        REFERENCES "public"."verifications"("id") 
        ON DELETE cascade ON UPDATE no action;
      END IF;

      -- Create indexes for new columns
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'payload_locked_documents_rels_admin_invitations_id_idx'
      ) THEN
        CREATE INDEX "payload_locked_documents_rels_admin_invitations_id_idx" 
        ON "payload_locked_documents_rels" USING btree ("admin_invitations_id");
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'payload_locked_documents_rels_accounts_id_idx'
      ) THEN
        CREATE INDEX "payload_locked_documents_rels_accounts_id_idx" 
        ON "payload_locked_documents_rels" USING btree ("accounts_id");
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'payload_locked_documents_rels_sessions_id_idx'
      ) THEN
        CREATE INDEX "payload_locked_documents_rels_sessions_id_idx" 
        ON "payload_locked_documents_rels" USING btree ("sessions_id");
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'payload_locked_documents_rels_verifications_id_idx'
      ) THEN
        CREATE INDEX "payload_locked_documents_rels_verifications_id_idx" 
        ON "payload_locked_documents_rels" USING btree ("verifications_id");
      END IF;
    END $$;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$ 
    BEGIN
      -- Drop indexes
      IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'payload_locked_documents_rels_admin_invitations_id_idx'
      ) THEN
        DROP INDEX "payload_locked_documents_rels_admin_invitations_id_idx";
      END IF;

      IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'payload_locked_documents_rels_accounts_id_idx'
      ) THEN
        DROP INDEX "payload_locked_documents_rels_accounts_id_idx";
      END IF;

      IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'payload_locked_documents_rels_sessions_id_idx'
      ) THEN
        DROP INDEX "payload_locked_documents_rels_sessions_id_idx";
      END IF;

      IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'payload_locked_documents_rels_verifications_id_idx'
      ) THEN
        DROP INDEX "payload_locked_documents_rels_verifications_id_idx";
      END IF;

      -- Drop foreign key constraints
      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payload_locked_documents_rels_admin_invitations_fk'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" 
        DROP CONSTRAINT "payload_locked_documents_rels_admin_invitations_fk";
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payload_locked_documents_rels_accounts_fk'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" 
        DROP CONSTRAINT "payload_locked_documents_rels_accounts_fk";
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payload_locked_documents_rels_sessions_fk'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" 
        DROP CONSTRAINT "payload_locked_documents_rels_sessions_fk";
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payload_locked_documents_rels_verifications_fk'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" 
        DROP CONSTRAINT "payload_locked_documents_rels_verifications_fk";
      END IF;

      -- Drop columns (only if they exist)
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payload_locked_documents_rels' 
        AND column_name = 'admin_invitations_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "admin_invitations_id";
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payload_locked_documents_rels' 
        AND column_name = 'accounts_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "accounts_id";
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payload_locked_documents_rels' 
        AND column_name = 'sessions_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "sessions_id";
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payload_locked_documents_rels' 
        AND column_name = 'verifications_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "verifications_id";
      END IF;
    END $$;
  `)
}


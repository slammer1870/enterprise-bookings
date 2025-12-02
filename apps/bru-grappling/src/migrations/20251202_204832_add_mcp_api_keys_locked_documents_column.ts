import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Create the payload_mcp_api_keys table if it doesn't exist (needed when push: false in test/CI)
  // Then add the missing relationship columns
  await db.execute(sql`
    DO $$ 
    BEGIN
      -- Create payload_mcp_api_keys table if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'payload_mcp_api_keys'
      ) THEN
        CREATE TABLE "payload_mcp_api_keys" (
          "id" serial PRIMARY KEY NOT NULL,
          "user_id" integer NOT NULL,
          "label" varchar,
          "description" varchar,
          "users_find" boolean DEFAULT false,
          "users_create" boolean DEFAULT false,
          "users_update" boolean DEFAULT false,
          "users_delete" boolean DEFAULT false,
          "lessons_find" boolean DEFAULT false,
          "lessons_create" boolean DEFAULT false,
          "lessons_update" boolean DEFAULT false,
          "lessons_delete" boolean DEFAULT false,
          "class_options_find" boolean DEFAULT false,
          "class_options_create" boolean DEFAULT false,
          "class_options_update" boolean DEFAULT false,
          "class_options_delete" boolean DEFAULT false,
          "bookings_find" boolean DEFAULT false,
          "bookings_create" boolean DEFAULT false,
          "bookings_update" boolean DEFAULT false,
          "bookings_delete" boolean DEFAULT false,
          "drop_ins_find" boolean DEFAULT false,
          "drop_ins_create" boolean DEFAULT false,
          "drop_ins_update" boolean DEFAULT false,
          "drop_ins_delete" boolean DEFAULT false,
          "subscriptions_find" boolean DEFAULT false,
          "subscriptions_create" boolean DEFAULT false,
          "subscriptions_update" boolean DEFAULT false,
          "subscriptions_delete" boolean DEFAULT false,
          "plans_find" boolean DEFAULT false,
          "plans_create" boolean DEFAULT false,
          "plans_update" boolean DEFAULT false,
          "plans_delete" boolean DEFAULT false,
          "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
          "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
          "enable_a_p_i_key" boolean,
          "api_key" varchar,
          "api_key_index" varchar
        );

        -- Add foreign key constraint for user_id if users table exists
        IF EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        ) THEN
          ALTER TABLE "payload_mcp_api_keys" 
          ADD CONSTRAINT "payload_mcp_api_keys_user_id_users_id_fk" 
          FOREIGN KEY ("user_id") 
          REFERENCES "public"."users"("id") 
          ON DELETE set null ON UPDATE no action;
        END IF;

        -- Create indexes
        CREATE INDEX "payload_mcp_api_keys_user_idx" 
        ON "payload_mcp_api_keys" USING btree ("user_id");
        CREATE INDEX "payload_mcp_api_keys_updated_at_idx" 
        ON "payload_mcp_api_keys" USING btree ("updated_at");
        CREATE INDEX "payload_mcp_api_keys_created_at_idx" 
        ON "payload_mcp_api_keys" USING btree ("created_at");
      END IF;

      -- Add column to payload_locked_documents_rels if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payload_locked_documents_rels' 
        AND column_name = 'payload_mcp_api_keys_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "payload_mcp_api_keys_id" integer;
      END IF;

      -- Add column to payload_preferences_rels if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payload_preferences_rels' 
        AND column_name = 'payload_mcp_api_keys_id'
      ) THEN
        ALTER TABLE "payload_preferences_rels" ADD COLUMN "payload_mcp_api_keys_id" integer;
      END IF;

      -- Add foreign key constraint for payload_locked_documents_rels if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payload_locked_documents_rels_payload_mcp_api_keys_fk'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'payload_mcp_api_keys'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" 
        ADD CONSTRAINT "payload_locked_documents_rels_payload_mcp_api_keys_fk" 
        FOREIGN KEY ("payload_mcp_api_keys_id") 
        REFERENCES "public"."payload_mcp_api_keys"("id") 
        ON DELETE cascade ON UPDATE no action;
      END IF;

      -- Add foreign key constraint for payload_preferences_rels if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payload_preferences_rels_payload_mcp_api_keys_fk'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'payload_mcp_api_keys'
      ) THEN
        ALTER TABLE "payload_preferences_rels" 
        ADD CONSTRAINT "payload_preferences_rels_payload_mcp_api_keys_fk" 
        FOREIGN KEY ("payload_mcp_api_keys_id") 
        REFERENCES "public"."payload_mcp_api_keys"("id") 
        ON DELETE cascade ON UPDATE no action;
      END IF;

      -- Create index for payload_locked_documents_rels if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'payload_locked_documents_rels_payload_mcp_api_keys_id_idx'
      ) THEN
        CREATE INDEX "payload_locked_documents_rels_payload_mcp_api_keys_id_idx" 
        ON "payload_locked_documents_rels" USING btree ("payload_mcp_api_keys_id");
      END IF;

      -- Create index for payload_preferences_rels if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'payload_preferences_rels_payload_mcp_api_keys_id_idx'
      ) THEN
        CREATE INDEX "payload_preferences_rels_payload_mcp_api_keys_id_idx" 
        ON "payload_preferences_rels" USING btree ("payload_mcp_api_keys_id");
      END IF;
    END $$;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$ 
    BEGIN
      -- Drop foreign key constraints if they exist
      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payload_locked_documents_rels_payload_mcp_api_keys_fk'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" 
        DROP CONSTRAINT "payload_locked_documents_rels_payload_mcp_api_keys_fk";
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payload_preferences_rels_payload_mcp_api_keys_fk'
      ) THEN
        ALTER TABLE "payload_preferences_rels" 
        DROP CONSTRAINT "payload_preferences_rels_payload_mcp_api_keys_fk";
      END IF;

      -- Drop indexes if they exist
      IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'payload_locked_documents_rels_payload_mcp_api_keys_id_idx'
      ) THEN
        DROP INDEX "payload_locked_documents_rels_payload_mcp_api_keys_id_idx";
      END IF;

      IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'payload_preferences_rels_payload_mcp_api_keys_id_idx'
      ) THEN
        DROP INDEX "payload_preferences_rels_payload_mcp_api_keys_id_idx";
      END IF;

      -- Drop columns if they exist
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payload_locked_documents_rels' 
        AND column_name = 'payload_mcp_api_keys_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "payload_mcp_api_keys_id";
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payload_preferences_rels' 
        AND column_name = 'payload_mcp_api_keys_id'
      ) THEN
        ALTER TABLE "payload_preferences_rels" DROP COLUMN "payload_mcp_api_keys_id";
      END IF;
    END $$;
  `)
}

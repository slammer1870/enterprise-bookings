import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Only add the missing relationship columns - the table itself is created by Payload's schema push
  await db.execute(sql`
    DO $$ 
    BEGIN
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

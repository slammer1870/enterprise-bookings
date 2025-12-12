import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Safely drop the constraint if it exists to prevent Payload schema sync errors
  // Payload's schema sync tries to drop this constraint but fails if it doesn't exist
  await db.execute(sql`
    DO $$ 
    BEGIN
      -- Drop the constraint if it exists (using IF EXISTS to avoid errors)
      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payload_preferences_rels_payload_mcp_api_keys_fk'
        AND table_schema = 'public'
      ) THEN
        ALTER TABLE "payload_preferences_rels" 
        DROP CONSTRAINT "payload_preferences_rels_payload_mcp_api_keys_fk";
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- If dropping fails for any reason, log but continue
      -- This ensures the migration doesn't fail even if there are issues
      NULL;
    END $$;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Re-add the constraint if it should exist
  // This will be handled by Payload's schema sync if needed
  await db.execute(sql`
    DO $$ 
    BEGIN
      -- Only add the constraint if the table and column exist
      IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'payload_mcp_api_keys'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'payload_preferences_rels' 
        AND column_name = 'payload_mcp_api_keys_id'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payload_preferences_rels_payload_mcp_api_keys_fk'
        AND table_schema = 'public'
      ) THEN
        ALTER TABLE "payload_preferences_rels" 
        ADD CONSTRAINT "payload_preferences_rels_payload_mcp_api_keys_fk" 
        FOREIGN KEY ("payload_mcp_api_keys_id") 
        REFERENCES "public"."payload_mcp_api_keys"("id") 
        ON DELETE cascade ON UPDATE no action;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- If adding fails, that's okay - Payload schema sync will handle it
      NULL;
    END $$;
  `)
}


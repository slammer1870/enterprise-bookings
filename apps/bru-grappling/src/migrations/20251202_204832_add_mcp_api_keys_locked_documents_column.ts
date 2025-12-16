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

    END $$;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$ 
    BEGIN
    END $$;
  `)
}

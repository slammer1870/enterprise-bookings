import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  // Create enum type first
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_users_role" AS ENUM('customer', 'admin');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `)
  
  // Add columns
  await db.execute(sql`
    DO $$ BEGIN
      -- Add email_verified column if it doesn't exist
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email_verified') THEN
        ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;
      END IF;
      
      -- Add image column if it doesn't exist (better-auth uses image instead of image_id)
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'image') THEN
        ALTER TABLE "users" ADD COLUMN "image" varchar;
      END IF;
      
      -- Add role column if it doesn't exist
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role') THEN
        ALTER TABLE "users" ADD COLUMN "role" "enum_users_role" DEFAULT 'customer' NOT NULL;
      END IF;
      
      -- Add banned columns if they don't exist
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'banned') THEN
        ALTER TABLE "users" ADD COLUMN "banned" boolean DEFAULT false;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'ban_reason') THEN
        ALTER TABLE "users" ADD COLUMN "ban_reason" varchar;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'ban_expires') THEN
        ALTER TABLE "users" ADD COLUMN "ban_expires" timestamp(3) with time zone;
      END IF;
    END $$;
  `)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "users" DROP COLUMN IF EXISTS "email_verified";
      ALTER TABLE "users" DROP COLUMN IF EXISTS "image";
      ALTER TABLE "users" DROP COLUMN IF EXISTS "role";
      ALTER TABLE "users" DROP COLUMN IF EXISTS "banned";
      ALTER TABLE "users" DROP COLUMN IF EXISTS "ban_reason";
      ALTER TABLE "users" DROP COLUMN IF EXISTS "ban_expires";
    END $$;
    
    DO $$ BEGIN
      DROP TYPE IF EXISTS "public"."enum_users_role";
    EXCEPTION
      WHEN OTHERS THEN null;
    END $$;
  `)
}

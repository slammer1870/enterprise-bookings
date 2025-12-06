import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_users_role" AS ENUM('customer', 'admin');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    
    DO $$ BEGIN
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" boolean DEFAULT false NOT NULL;
    EXCEPTION WHEN OTHERS THEN null;
    END $$;
    
    DO $$ BEGIN
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "image" varchar;
    EXCEPTION WHEN OTHERS THEN null;
    END $$;
    
    DO $$ BEGIN
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "enum_users_role" DEFAULT 'customer' NOT NULL;
    EXCEPTION WHEN OTHERS THEN null;
    END $$;
    
    DO $$ BEGIN
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "banned" boolean DEFAULT false;
    EXCEPTION WHEN OTHERS THEN null;
    END $$;
    
    DO $$ BEGIN
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ban_reason" varchar;
    EXCEPTION WHEN OTHERS THEN null;
    END $$;
    
    DO $$ BEGIN
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ban_expires" timestamp(3) with time zone;
    EXCEPTION WHEN OTHERS THEN null;
    END $$;
  `)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "users" DROP COLUMN IF EXISTS "email_verified";
    EXCEPTION WHEN OTHERS THEN null;
    END $$;
    
    DO $$ BEGIN
      ALTER TABLE "users" DROP COLUMN IF EXISTS "image";
    EXCEPTION WHEN OTHERS THEN null;
    END $$;
    
    DO $$ BEGIN
      ALTER TABLE "users" DROP COLUMN IF EXISTS "role";
    EXCEPTION WHEN OTHERS THEN null;
    END $$;
    
    DO $$ BEGIN
      ALTER TABLE "users" DROP COLUMN IF EXISTS "banned";
    EXCEPTION WHEN OTHERS THEN null;
    END $$;
    
    DO $$ BEGIN
      ALTER TABLE "users" DROP COLUMN IF EXISTS "ban_reason";
    EXCEPTION WHEN OTHERS THEN null;
    END $$;
    
    DO $$ BEGIN
      ALTER TABLE "users" DROP COLUMN IF EXISTS "ban_expires";
    EXCEPTION WHEN OTHERS THEN null;
    END $$;
    
    DO $$ BEGIN
      DROP TYPE IF EXISTS "public"."enum_users_role";
    EXCEPTION WHEN OTHERS THEN null;
    END $$;
  `)
}


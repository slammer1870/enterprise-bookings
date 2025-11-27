import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // CRITICAL: Drop the constraint and migrate data FIRST
  // This must happen before any other operations to prevent Payload schema sync from failing
  try {
    // Drop the constraints if they exist (even if in invalid state)
    await db.execute(sql`
      DO $$ 
      BEGIN
        -- Drop lessons constraint
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lessons_instructor_id_instructors_id_fk') THEN
          ALTER TABLE "lessons" DROP CONSTRAINT IF EXISTS "lessons_instructor_id_instructors_id_fk";
        END IF;
        
        -- Drop scheduler constraint
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scheduler_week_days_time_slot_instructor_id_instructors_id_fk') THEN
          ALTER TABLE "scheduler_week_days_time_slot" DROP CONSTRAINT IF EXISTS "scheduler_week_days_time_slot_instructor_id_instructors_id_fk";
        END IF;
      EXCEPTION WHEN OTHERS THEN 
        -- Try to drop them anyway, ignoring errors
        BEGIN
          ALTER TABLE "lessons" DROP CONSTRAINT IF EXISTS "lessons_instructor_id_instructors_id_fk";
        EXCEPTION WHEN OTHERS THEN null;
        END;
        BEGIN
          ALTER TABLE "scheduler_week_days_time_slot" DROP CONSTRAINT IF EXISTS "scheduler_week_days_time_slot_instructor_id_instructors_id_fk";
        EXCEPTION WHEN OTHERS THEN null;
        END;
      END $$;
    `)

    // Check if tables exist
    const tablesExist = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'lessons'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'instructors'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
      ) as exists
    `)
    
    if (tablesExist.rows?.[0]?.exists) {
      // Find lessons with instructor_id that don't exist in instructors table but do exist in users table
      // These are the ones we need to migrate
      // Check if users table has image_id column (it might have been dropped in a previous migration)
      const hasImageIdColumn = await db.execute<{ exists: boolean }>(sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'image_id'
        ) as exists
      `)
      
      const userHasImageId = hasImageIdColumn.rows?.[0]?.exists || false
      
      // Build query based on whether image_id column exists
      const orphanedLessons = userHasImageId
        ? await db.execute<{
            instructor_id: number;
            user_id: number | null;
            user_name: string | null;
            user_image_id: number | null;
          }>(sql`
            SELECT DISTINCT 
              l.instructor_id,
              u.id as user_id,
              u.name as user_name,
              u.image_id as user_image_id
            FROM lessons l
            LEFT JOIN instructors i ON i.id = l.instructor_id
            LEFT JOIN users u ON u.id = l.instructor_id
            WHERE l.instructor_id IS NOT NULL
              AND i.id IS NULL
              AND u.id IS NOT NULL
          `)
        : await db.execute<{
            instructor_id: number;
            user_id: number | null;
            user_name: string | null;
            user_image_id: number | null;
          }>(sql`
            SELECT DISTINCT 
              l.instructor_id,
              u.id as user_id,
              u.name as user_name,
              NULL::integer as user_image_id
            FROM lessons l
            LEFT JOIN instructors i ON i.id = l.instructor_id
            LEFT JOIN users u ON u.id = l.instructor_id
            WHERE l.instructor_id IS NOT NULL
              AND i.id IS NULL
              AND u.id IS NOT NULL
          `)

      // Create instructor records for each orphaned user reference
      if (orphanedLessons.rows && orphanedLessons.rows.length > 0) {
        console.log(`Found ${orphanedLessons.rows.length} lessons with instructor_id referencing users that need migration`)
        
        for (const row of orphanedLessons.rows) {
          if (row.user_id) {
            try {
              // Check if instructor already exists for this user
              const existingInstructors = await db.execute<{ id: number }>(sql`
                SELECT id FROM instructors WHERE user_id = ${row.user_id} LIMIT 1
              `)

              let instructorId: number

              if (existingInstructors.rows && existingInstructors.rows.length > 0) {
                // Use existing instructor
                instructorId = existingInstructors.rows[0].id
                console.log(`Using existing instructor ${instructorId} for user ${row.user_id}`)
              } else {
                // Create new instructor record from user
                // Copy user's image to instructor's profile_image_id if available
                const newInstructor = await db.execute<{ id: number }>(sql`
                  INSERT INTO instructors (user_id, name, profile_image_id, active, created_at, updated_at)
                  VALUES (
                    ${row.user_id}, 
                    ${row.user_name || `User ${row.user_id}`}, 
                    ${row.user_image_id || null},
                    true, 
                    now(), 
                    now()
                  )
                  RETURNING id
                `)
                instructorId = newInstructor.rows[0].id
                console.log(`Created new instructor ${instructorId} for user ${row.user_id}${row.user_image_id ? ` (with image ${row.user_image_id})` : ''}`)
              }

              // Update all lessons with this orphaned instructor_id to point to the new instructor
              const updateResult = await db.execute(sql`
                UPDATE lessons 
                SET instructor_id = ${instructorId}
                WHERE instructor_id = ${row.instructor_id}
                  AND NOT EXISTS (SELECT 1 FROM instructors WHERE id = ${row.instructor_id})
              `)
              console.log(`Updated lessons with instructor_id ${row.instructor_id} to point to instructor ${instructorId}`)
            } catch (error) {
              console.error(`Error migrating instructor reference ${row.instructor_id} (user ${row.user_id}):`, error)
              // If we can't create an instructor, set the reference to NULL
              await db.execute(sql`
                UPDATE lessons 
                SET instructor_id = NULL
                WHERE instructor_id = ${row.instructor_id}
                  AND NOT EXISTS (SELECT 1 FROM instructors WHERE id = ${row.instructor_id})
              `)
            }
          }
        }
      }

      // Clean up any remaining invalid references in lessons (not user IDs, just invalid)
      const cleanupResult = await db.execute(sql`
        UPDATE "lessons" 
        SET "instructor_id" = NULL 
        WHERE "instructor_id" IS NOT NULL 
        AND NOT EXISTS (
          SELECT 1 FROM "instructors" WHERE "instructors"."id" = "lessons"."instructor_id"
        )
        AND NOT EXISTS (
          SELECT 1 FROM "users" WHERE "users"."id" = "lessons"."instructor_id"
        )
      `)
      const cleanupRows = cleanupResult.rowCount || 0
      if (cleanupRows > 0) {
        console.log(`Cleaned up ${cleanupRows} invalid instructor_id references in lessons (not user IDs)`)
      }

      // Now fix scheduler_week_days_time_slot table
      const schedulerOrphaned = userHasImageId
        ? await db.execute<{
            instructor_id: number
            user_id: number | null
            user_name: string | null
            user_image_id: number | null
          }>(sql`
            SELECT DISTINCT 
              s.instructor_id,
              u.id as user_id,
              u.name as user_name,
              u.image_id as user_image_id
            FROM scheduler_week_days_time_slot s
            LEFT JOIN instructors i ON i.id = s.instructor_id
            LEFT JOIN users u ON u.id = s.instructor_id
            WHERE s.instructor_id IS NOT NULL
              AND i.id IS NULL
              AND u.id IS NOT NULL
          `)
        : await db.execute<{
            instructor_id: number
            user_id: number | null
            user_name: string | null
            user_image_id: number | null
          }>(sql`
            SELECT DISTINCT 
              s.instructor_id,
              u.id as user_id,
              u.name as user_name,
              NULL::integer as user_image_id
            FROM scheduler_week_days_time_slot s
            LEFT JOIN instructors i ON i.id = s.instructor_id
            LEFT JOIN users u ON u.id = s.instructor_id
            WHERE s.instructor_id IS NOT NULL
              AND i.id IS NULL
              AND u.id IS NOT NULL
          `)

      if (schedulerOrphaned.rows && schedulerOrphaned.rows.length > 0) {
        console.log(`Found ${schedulerOrphaned.rows.length} scheduler time slots with instructor_id referencing users that need migration`)
        
        for (const row of schedulerOrphaned.rows) {
          if (row.user_id) {
            try {
              // Check if instructor already exists for this user
              const existingInstructors = await db.execute<{ id: number }>(sql`
                SELECT id FROM instructors WHERE user_id = ${row.user_id} LIMIT 1
              `)

              let instructorId: number

              if (existingInstructors.rows && existingInstructors.rows.length > 0) {
                instructorId = existingInstructors.rows[0].id
                console.log(`Using existing instructor ${instructorId} for user ${row.user_id} (from scheduler)`)
              } else {
                // Create new instructor record from user
                const newInstructor = await db.execute<{ id: number }>(sql`
                  INSERT INTO instructors (user_id, name, profile_image_id, active, created_at, updated_at)
                  VALUES (
                    ${row.user_id}, 
                    ${row.user_name || `User ${row.user_id}`}, 
                    ${row.user_image_id || null},
                    true, 
                    now(), 
                    now()
                  )
                  RETURNING id
                `)
                instructorId = newInstructor.rows[0].id
                console.log(`Created new instructor ${instructorId} for user ${row.user_id} (from scheduler)${row.user_image_id ? ` (with image ${row.user_image_id})` : ''}`)
              }

              // Update scheduler time slots
              const updateResult = await db.execute(sql`
                UPDATE scheduler_week_days_time_slot 
                SET instructor_id = ${instructorId}
                WHERE instructor_id = ${row.instructor_id}
                  AND NOT EXISTS (SELECT 1 FROM instructors WHERE id = ${row.instructor_id})
              `)
              console.log(`Updated scheduler time slots: instructor_id ${row.instructor_id} -> ${instructorId} (${updateResult.rowCount || 0} rows)`)
            } catch (error) {
              console.error(`Error migrating scheduler instructor reference ${row.instructor_id} (user ${row.user_id}):`, error)
              // If we can't create an instructor, set the reference to NULL
              await db.execute(sql`
                UPDATE scheduler_week_days_time_slot 
                SET instructor_id = NULL
                WHERE instructor_id = ${row.instructor_id}
                  AND NOT EXISTS (SELECT 1 FROM instructors WHERE id = ${row.instructor_id})
              `)
            }
          }
        }
      }

      // Clean up any remaining invalid references in scheduler_week_days_time_slot
      const schedulerCleanupResult = await db.execute(sql`
        UPDATE scheduler_week_days_time_slot 
        SET instructor_id = NULL 
        WHERE instructor_id IS NOT NULL 
        AND NOT EXISTS (
          SELECT 1 FROM instructors WHERE instructors.id = scheduler_week_days_time_slot.instructor_id
        )
        AND NOT EXISTS (
          SELECT 1 FROM users WHERE users.id = scheduler_week_days_time_slot.instructor_id
        )
      `)
      const schedulerCleanupRows = schedulerCleanupResult.rowCount || 0
      if (schedulerCleanupRows > 0) {
        console.log(`Cleaned up ${schedulerCleanupRows} invalid instructor_id references in scheduler_week_days_time_slot`)
      }
    }
  } catch (error) {
    console.warn('Warning during data migration (continuing):', error)
    // Continue with migration even if data migration fails
  }

  await db.execute(sql`
   DO $$ BEGIN
    CREATE TYPE "public"."enum_users_role" AS ENUM('user', 'admin');
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
  
  DO $$ BEGIN
    ALTER TABLE "lessons" DROP CONSTRAINT IF EXISTS "lessons_instructor_id_users_id_fk";
   EXCEPTION WHEN OTHERS THEN null;
   END $$;
  
  DO $$ BEGIN
    ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_image_id_media_id_fk";
   EXCEPTION WHEN OTHERS THEN null;
   END $$;
  
  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_payload_jobs_fk";
   EXCEPTION WHEN OTHERS THEN null;
   END $$;
  
  DO $$ BEGIN
    ALTER TABLE "scheduler_week_days_time_slot" DROP CONSTRAINT IF EXISTS "scheduler_week_days_time_slot_instructor_id_users_id_fk";
   EXCEPTION WHEN OTHERS THEN null;
   END $$;
  
  DROP INDEX IF EXISTS "class_options_payment_methods_payment_methods_allowed_drop_in_idx";
  DROP INDEX IF EXISTS "users_image_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_payload_jobs_id_idx";
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-11-27T16:55:03.255Z';
  ALTER TABLE "users" ALTER COLUMN "name" DROP NOT NULL;
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-11-27T16:55:03.458Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-11-27T16:55:03.458Z';
  DO $$ BEGIN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" boolean DEFAULT false NOT NULL;
   EXCEPTION WHEN OTHERS THEN null;
   END $$;
  DO $$ BEGIN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "image" varchar;
   EXCEPTION WHEN OTHERS THEN null;
   END $$;
  DO $$ BEGIN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "enum_users_role" DEFAULT 'user' NOT NULL;
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
  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "accounts_id" integer;
   EXCEPTION WHEN OTHERS THEN null;
   END $$;
  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "sessions_id" integer;
   EXCEPTION WHEN OTHERS THEN null;
   END $$;
  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "verifications_id" integer;
   EXCEPTION WHEN OTHERS THEN null;
   END $$;
  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "instructors_id" integer;
   EXCEPTION WHEN OTHERS THEN null;
   END $$;
  DO $$ BEGIN
    ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
   EXCEPTION WHEN OTHERS THEN null;
   END $$;
  DO $$ BEGIN
    ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
   EXCEPTION WHEN OTHERS THEN null;
   END $$;
  DO $$ BEGIN
    ALTER TABLE "sessions" ADD CONSTRAINT "sessions_impersonated_by_id_users_id_fk" FOREIGN KEY ("impersonated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
   EXCEPTION WHEN OTHERS THEN null;
   END $$;
  DO $$ BEGIN
    ALTER TABLE "instructors" ADD CONSTRAINT "instructors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
   EXCEPTION WHEN OTHERS THEN null;
   END $$;
  DO $$ BEGIN
    ALTER TABLE "instructors" ADD CONSTRAINT "instructors_profile_image_id_media_id_fk" FOREIGN KEY ("profile_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
   EXCEPTION WHEN OTHERS THEN null;
   END $$;
  DO $$ BEGIN
    ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
   EXCEPTION WHEN OTHERS THEN null;
   END $$;
  CREATE INDEX IF NOT EXISTS "accounts_user_idx" ON "accounts" USING btree ("user_id");
  CREATE INDEX IF NOT EXISTS "accounts_account_id_idx" ON "accounts" USING btree ("account_id");
  CREATE INDEX IF NOT EXISTS "accounts_updated_at_idx" ON "accounts" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "accounts_created_at_idx" ON "accounts" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" USING btree ("user_id");
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'sessions_token_idx') THEN
      EXECUTE 'CREATE UNIQUE INDEX "sessions_token_idx" ON "sessions" USING btree ("token")';
    END IF;
   EXCEPTION WHEN OTHERS THEN null;
   END $$;
  CREATE INDEX IF NOT EXISTS "sessions_updated_at_idx" ON "sessions" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "sessions_created_at_idx" ON "sessions" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "sessions_impersonated_by_idx" ON "sessions" USING btree ("impersonated_by_id");
  CREATE INDEX IF NOT EXISTS "verifications_identifier_idx" ON "verifications" USING btree ("identifier");
  CREATE INDEX IF NOT EXISTS "verifications_updated_at_idx" ON "verifications" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "verifications_created_at_idx" ON "verifications" USING btree ("created_at");
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'instructors_user_idx') THEN
      EXECUTE 'CREATE UNIQUE INDEX "instructors_user_idx" ON "instructors" USING btree ("user_id")';
    END IF;
   EXCEPTION WHEN OTHERS THEN null;
   END $$;
  CREATE INDEX IF NOT EXISTS "instructors_profile_image_idx" ON "instructors" USING btree ("profile_image_id");
  CREATE INDEX IF NOT EXISTS "instructors_updated_at_idx" ON "instructors" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "instructors_created_at_idx" ON "instructors" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'payload_kv_key_idx') THEN
      EXECUTE 'CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key")';
    END IF;
   EXCEPTION WHEN OTHERS THEN null;
   END $$;
  DO $$ BEGIN
    -- Drop the constraint if it exists (in case it's in an invalid state)
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lessons_instructor_id_instructors_id_fk') THEN
      ALTER TABLE "lessons" DROP CONSTRAINT "lessons_instructor_id_instructors_id_fk";
    END IF;
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  
  -- Clean up any remaining invalid references (in case cleanup above didn't catch them)
  DO $$ 
  BEGIN
    UPDATE "lessons" 
    SET "instructor_id" = NULL 
    WHERE "instructor_id" IS NOT NULL 
    AND NOT EXISTS (
      SELECT 1 FROM "instructors" WHERE "instructors"."id" = "lessons"."instructor_id"
    );
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  
  DO $$ BEGIN
    -- Now add the foreign key constraint
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lessons_instructor_id_instructors_id_fk') THEN
      ALTER TABLE "lessons" ADD CONSTRAINT "lessons_instructor_id_instructors_id_fk" 
        FOREIGN KEY ("instructor_id") REFERENCES "public"."instructors"("id") 
        ON DELETE set null ON UPDATE no action;
    END IF;
   EXCEPTION WHEN OTHERS THEN null;
   END $$;
  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_accounts_fk" FOREIGN KEY ("accounts_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
   EXCEPTION WHEN OTHERS THEN null;
   END $$;
  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sessions_fk" FOREIGN KEY ("sessions_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
   EXCEPTION WHEN OTHERS THEN null;
   END $$;
  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_verifications_fk" FOREIGN KEY ("verifications_id") REFERENCES "public"."verifications"("id") ON DELETE cascade ON UPDATE no action;
   EXCEPTION WHEN OTHERS THEN null;
   END $$;
  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_instructors_fk" FOREIGN KEY ("instructors_id") REFERENCES "public"."instructors"("id") ON DELETE cascade ON UPDATE no action;
   EXCEPTION WHEN OTHERS THEN null;
   END $$;
  DO $$ BEGIN
    ALTER TABLE "scheduler_week_days_time_slot" ADD CONSTRAINT "scheduler_week_days_time_slot_instructor_id_instructors_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructors"("id") ON DELETE set null ON UPDATE no action;
   EXCEPTION WHEN OTHERS THEN null;
   END $$;
  CREATE INDEX IF NOT EXISTS "class_options_payment_methods_payment_methods_allowed_dr_idx" ON "class_options" USING btree ("payment_methods_allowed_drop_in_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_accounts_id_idx" ON "payload_locked_documents_rels" USING btree ("accounts_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_sessions_id_idx" ON "payload_locked_documents_rels" USING btree ("sessions_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_verifications_id_idx" ON "payload_locked_documents_rels" USING btree ("verifications_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_instructors_id_idx" ON "payload_locked_documents_rels" USING btree ("instructors_id");
  DO $$ BEGIN
    ALTER TABLE "users" DROP COLUMN IF EXISTS "image_id";
   EXCEPTION WHEN OTHERS THEN null;
   END $$;
  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "payload_jobs_id";
   EXCEPTION WHEN OTHERS THEN null;
   END $$;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "accounts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "sessions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "verifications" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "instructors" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "users_sessions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_kv" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "accounts" CASCADE;
  DROP TABLE "sessions" CASCADE;
  DROP TABLE "verifications" CASCADE;
  DROP TABLE "instructors" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  ALTER TABLE "lessons" DROP CONSTRAINT "lessons_instructor_id_instructors_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_accounts_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_sessions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_verifications_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_instructors_fk";
  
  ALTER TABLE "scheduler_week_days_time_slot" DROP CONSTRAINT "scheduler_week_days_time_slot_instructor_id_instructors_id_fk";
  
  DROP INDEX "class_options_payment_methods_payment_methods_allowed_dr_idx";
  DROP INDEX "payload_locked_documents_rels_accounts_id_idx";
  DROP INDEX "payload_locked_documents_rels_sessions_id_idx";
  DROP INDEX "payload_locked_documents_rels_verifications_id_idx";
  DROP INDEX "payload_locked_documents_rels_instructors_id_idx";
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-11-25T19:19:47.014Z';
  ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL;
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-11-25T19:19:47.014Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-11-25T19:19:47.014Z';
  ALTER TABLE "users" ADD COLUMN "image_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "payload_jobs_id" integer;
  ALTER TABLE "lessons" ADD CONSTRAINT "lessons_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_jobs_fk" FOREIGN KEY ("payload_jobs_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scheduler_week_days_time_slot" ADD CONSTRAINT "scheduler_week_days_time_slot_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "class_options_payment_methods_payment_methods_allowed_drop_in_idx" ON "class_options" USING btree ("payment_methods_allowed_drop_in_id");
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
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "instructors_id";
  DROP TYPE "public"."enum_users_role";`)
}

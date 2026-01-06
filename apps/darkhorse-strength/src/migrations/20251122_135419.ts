import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

/**
 * Migration to create instructors collection and migrate data from lessons.instructor (user) to instructors
 *
 * This migration:
 * 1. Creates the instructors table (if Payload hasn't already)
 * 2. Drops constraints to allow data migration
 * 3. Finds lessons with instructor_id that reference users (not instructors)
 * 4. Creates instructor records from user attributes using direct SQL
 * 5. Updates lessons to reference instructors instead of users
 * 6. Also handles scheduler_week_days_time_slot table
 * 7. Cleans up invalid references
 */
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
    `);

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
    `);
    
    if (tablesExist.rows?.[0]?.exists) {
      // Ensure instructors table has all required columns before migrating data
      await db.execute(sql`
        DO $$ 
        BEGIN
          -- Add image_id column if table exists but column doesn't
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'instructors')
            AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instructors' AND column_name = 'image_id') THEN
            ALTER TABLE "instructors" ADD COLUMN "image_id" integer;
          END IF;
          
          -- Add active column if table exists but column doesn't
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'instructors')
            AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instructors' AND column_name = 'active') THEN
            ALTER TABLE "instructors" ADD COLUMN "active" boolean DEFAULT true NOT NULL;
          END IF;
          
          -- Add name column if table exists but column doesn't
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'instructors')
            AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instructors' AND column_name = 'name') THEN
            ALTER TABLE "instructors" ADD COLUMN "name" varchar;
          END IF;
        END $$;
      `);
      
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
      `);
      
      const userHasImageId = hasImageIdColumn.rows?.[0]?.exists || false;
      
      // Check if instructors table has image_id column (needed for INSERT statements)
      const hasInstructorImageId = await db.execute<{ exists: boolean }>(sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'instructors' 
          AND column_name = 'image_id'
        ) as exists
      `);
      const instructorHasImageId = hasInstructorImageId.rows?.[0]?.exists || false;
      
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
          `);

      // Create instructor records for each orphaned user reference
      if (orphanedLessons.rows && orphanedLessons.rows.length > 0) {
        console.log(`Found ${orphanedLessons.rows.length} lessons with instructor_id referencing users that need migration`);
        
        for (const row of orphanedLessons.rows) {
          if (row.user_id) {
            try {
              // Check if instructor already exists for this user
              const existingInstructors = await db.execute<{ id: number }>(sql`
                SELECT id FROM instructors WHERE user_id = ${row.user_id} LIMIT 1
              `);

              let instructorId: number;

              if (existingInstructors.rows && existingInstructors.rows.length > 0 && existingInstructors.rows[0]) {
                // Use existing instructor
                instructorId = existingInstructors.rows[0].id;
                console.log(`Using existing instructor ${instructorId} for user ${row.user_id}`);
              } else {
                // Create new instructor record from user
                // Copy user's image to instructor's image_id if available and column exists
                const newInstructor = instructorHasImageId
                  ? await db.execute<{ id: number }>(sql`
                      INSERT INTO instructors (user_id, name, image_id, active, created_at, updated_at)
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
                  : await db.execute<{ id: number }>(sql`
                      INSERT INTO instructors (user_id, name, active, created_at, updated_at)
                      VALUES (
                        ${row.user_id}, 
                        ${row.user_name || `User ${row.user_id}`}, 
                        true, 
                        now(), 
                        now()
                      )
                      RETURNING id
                    `);
                if (!newInstructor.rows[0]) {
                  throw new Error(`Failed to create instructor for user ${row.user_id}: INSERT did not return id`);
                }
                instructorId = newInstructor.rows[0].id;
                console.log(`Created new instructor ${instructorId} for user ${row.user_id}${row.user_image_id ? ` (with image ${row.user_image_id})` : ''}`);
              }

              // Update all lessons with this orphaned instructor_id to point to the new instructor
              const updateResult = await db.execute(sql`
                UPDATE lessons 
                SET instructor_id = ${instructorId}
                WHERE instructor_id = ${row.instructor_id}
                  AND NOT EXISTS (SELECT 1 FROM instructors WHERE id = ${row.instructor_id})
              `);
              console.log(`Updated lessons with instructor_id ${row.instructor_id} to point to instructor ${instructorId}`);
            } catch (error) {
              console.error(`Error migrating instructor reference ${row.instructor_id} (user ${row.user_id}):`, error);
              // If we can't create an instructor, set the reference to NULL
              await db.execute(sql`
                UPDATE lessons 
                SET instructor_id = NULL
                WHERE instructor_id = ${row.instructor_id}
                  AND NOT EXISTS (SELECT 1 FROM instructors WHERE id = ${row.instructor_id})
              `);
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
      `);
      const cleanupRows = cleanupResult.rowCount || 0;
      if (cleanupRows > 0) {
        console.log(`Cleaned up ${cleanupRows} invalid instructor_id references in lessons (not user IDs)`);
      }

      // Now fix scheduler_week_days_time_slot table
      const schedulerOrphaned = userHasImageId
        ? await db.execute<{
            instructor_id: number;
            user_id: number | null;
            user_name: string | null;
            user_image_id: number | null;
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
            instructor_id: number;
            user_id: number | null;
            user_name: string | null;
            user_image_id: number | null;
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
          `);

      if (schedulerOrphaned.rows && schedulerOrphaned.rows.length > 0) {
        console.log(`Found ${schedulerOrphaned.rows.length} scheduler time slots with instructor_id referencing users that need migration`);
        
        for (const row of schedulerOrphaned.rows) {
          if (row.user_id) {
            try {
              // Check if instructor already exists for this user
              const existingInstructors = await db.execute<{ id: number }>(sql`
                SELECT id FROM instructors WHERE user_id = ${row.user_id} LIMIT 1
              `);

              let instructorId: number;

              if (existingInstructors.rows && existingInstructors.rows.length > 0 && existingInstructors.rows[0]) {
                instructorId = existingInstructors.rows[0].id;
                console.log(`Using existing instructor ${instructorId} for user ${row.user_id} (from scheduler)`);
              } else {
                // Create new instructor record from user
                // Copy user's image to instructor's image_id if available and column exists
                const newInstructor = instructorHasImageId
                  ? await db.execute<{ id: number }>(sql`
                      INSERT INTO instructors (user_id, name, image_id, active, created_at, updated_at)
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
                  : await db.execute<{ id: number }>(sql`
                      INSERT INTO instructors (user_id, name, active, created_at, updated_at)
                      VALUES (
                        ${row.user_id}, 
                        ${row.user_name || `User ${row.user_id}`}, 
                        true, 
                        now(), 
                        now()
                      )
                      RETURNING id
                    `);
                if (!newInstructor.rows[0]) {
                  throw new Error(`Failed to create instructor for user ${row.user_id}: INSERT did not return id`);
                }
                instructorId = newInstructor.rows[0].id;
                console.log(`Created new instructor ${instructorId} for user ${row.user_id} (from scheduler)${row.user_image_id ? ` (with image ${row.user_image_id})` : ''}`);
              }

              // Update scheduler time slots
              const updateResult = await db.execute(sql`
                UPDATE scheduler_week_days_time_slot 
                SET instructor_id = ${instructorId}
                WHERE instructor_id = ${row.instructor_id}
                  AND NOT EXISTS (SELECT 1 FROM instructors WHERE id = ${row.instructor_id})
              `);
              console.log(`Updated scheduler time slots: instructor_id ${row.instructor_id} -> ${instructorId} (${updateResult.rowCount || 0} rows)`);
            } catch (error) {
              console.error(`Error migrating scheduler instructor reference ${row.instructor_id} (user ${row.user_id}):`, error);
              // If we can't create an instructor, set the reference to NULL
              await db.execute(sql`
                UPDATE scheduler_week_days_time_slot 
                SET instructor_id = NULL
                WHERE instructor_id = ${row.instructor_id}
                  AND NOT EXISTS (SELECT 1 FROM instructors WHERE id = ${row.instructor_id})
              `);
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
      `);
      const schedulerCleanupRows = schedulerCleanupResult.rowCount || 0;
      if (schedulerCleanupRows > 0) {
        console.log(`Cleaned up ${schedulerCleanupRows} invalid instructor_id references in scheduler_week_days_time_slot`);
      }
    }
  } catch (error) {
    console.warn('Warning during data migration (continuing):', error);
    // Continue with migration even if data migration fails
  }

  // Step 1: Ensure instructors table exists (Payload may have already created it)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "instructors" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL,
      "description" text,
      "image_id" integer,
      "active" boolean DEFAULT true NOT NULL,
      "name" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS "instructors_user_id_idx" ON "instructors" USING btree ("user_id");
    CREATE INDEX IF NOT EXISTS "instructors_image_id_idx" ON "instructors" USING btree ("image_id");
    
    -- Add columns if table exists but columns don't
    DO $$ 
    BEGIN
      -- Add image_id column if table exists but column doesn't
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'instructors')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instructors' AND column_name = 'image_id') THEN
        ALTER TABLE "instructors" ADD COLUMN "image_id" integer;
      END IF;
      
      -- Add active column if table exists but column doesn't
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'instructors')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instructors' AND column_name = 'active') THEN
        ALTER TABLE "instructors" ADD COLUMN "active" boolean DEFAULT true NOT NULL;
      END IF;
      
      -- Add name column if table exists but column doesn't
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'instructors')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instructors' AND column_name = 'name') THEN
        ALTER TABLE "instructors" ADD COLUMN "name" varchar;
      END IF;
    END $$;
  `);

  // Add constraints and indexes
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'instructors_user_id_users_id_fk') THEN
        ALTER TABLE "instructors" ADD CONSTRAINT "instructors_user_id_users_id_fk" 
          FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    EXCEPTION WHEN OTHERS THEN null;
    END $$;
    
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'instructors_image_id_media_id_fk') THEN
        ALTER TABLE "instructors" ADD CONSTRAINT "instructors_image_id_media_id_fk" 
          FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
      END IF;
    EXCEPTION WHEN OTHERS THEN null;
    END $$;
    
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'instructors_user_id_unique') THEN
        EXECUTE 'CREATE UNIQUE INDEX "instructors_user_id_unique" ON "instructors" USING btree ("user_id")';
      END IF;
    EXCEPTION WHEN OTHERS THEN null;
    END $$;
  `);

  // Ensure lessons constraint exists
  await db.execute(sql`
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
      -- Add scheduler instructor constraint if it doesn't exist
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scheduler_week_days_time_slot_instructor_id_instructors_id_fk') THEN
        ALTER TABLE "scheduler_week_days_time_slot" ADD CONSTRAINT "scheduler_week_days_time_slot_instructor_id_instructors_id_fk" 
          FOREIGN KEY ("instructor_id") REFERENCES "public"."instructors"("id") 
          ON DELETE set null ON UPDATE no action;
      END IF;
    EXCEPTION WHEN OTHERS THEN null;
    END $$;
  `);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  // Reverse the migration

  // Step 1: Revert lessons table to use user_id
  await db.execute(sql`
    DO $$ 
    BEGIN
      -- Drop new foreign key constraint
      IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'lessons_instructor_id_instructors_id_fk' 
                 AND table_name = 'lessons') THEN
        ALTER TABLE "lessons" DROP CONSTRAINT "lessons_instructor_id_instructors_id_fk";
      END IF;
      
      -- Drop new index
      DROP INDEX IF EXISTS "lessons_instructor_id_idx";
      
      -- Add column for user_id
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'lessons' AND column_name = 'instructor_id_old') THEN
        ALTER TABLE "lessons" ADD COLUMN "instructor_id_old" integer;
      END IF;
    END $$;
  `);

  // Step 2: Map instructor_id back to user_id
  const instructorToUserMap = await db.execute<{
    id: number;
    user_id: number;
  }>(sql`
    SELECT id, user_id FROM instructors
  `);

  for (const row of instructorToUserMap.rows || []) {
    await db.execute(sql`
      UPDATE lessons 
      SET instructor_id_old = ${row.user_id}
      WHERE instructor_id = ${row.id}
    `);
  }

  // Step 3: Rename column and restore old foreign key
  await db.execute(sql`
    DO $$ 
    BEGIN
      ALTER TABLE "lessons" DROP COLUMN IF EXISTS "instructor_id";
      ALTER TABLE "lessons" RENAME COLUMN "instructor_id_old" TO "instructor_id";
      
      ALTER TABLE "lessons" ADD CONSTRAINT "lessons_instructor_id_users_id_fk" 
        FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
      
      CREATE INDEX IF NOT EXISTS "lessons_instructor_id_idx" ON "lessons" USING btree ("instructor_id");
    END $$;
  `);

  // Step 4: Drop instructors table
  await db.execute(sql`
    DROP TABLE IF EXISTS "instructors" CASCADE;
  `);
}

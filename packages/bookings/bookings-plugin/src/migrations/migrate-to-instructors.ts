import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

/**
 * Migration to create instructors collection and migrate data from lessons.instructor (user) to instructors
 *
 * This migration:
 * 1. Creates the instructors table (if Payload hasn't already)
 * 2. Creates instructor records for each unique user referenced as an instructor in lessons
 * 3. Copies user image to instructor image if available
 * 4. Updates lessons to reference instructors instead of users
 *
 * Note: This migration should be run after Payload auto-generates the schema migration for the instructors collection.
 * If the instructors table doesn't exist yet, this migration will create it.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Step 1: Ensure instructors table exists (Payload may have already created it)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "instructors" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL,
      "description" text,
      "image_id" integer,
      "active" boolean DEFAULT true NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "instructors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
      CONSTRAINT "instructors_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action,
      CONSTRAINT "instructors_user_id_unique" UNIQUE("user_id")
    );
    
    CREATE INDEX IF NOT EXISTS "instructors_user_id_idx" ON "instructors" USING btree ("user_id");
    CREATE INDEX IF NOT EXISTS "instructors_image_id_idx" ON "instructors" USING btree ("image_id");
    
    -- Add active column if table exists but column doesn't
    DO $$ 
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'instructors')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instructors' AND column_name = 'active') THEN
        ALTER TABLE "instructors" ADD COLUMN "active" boolean DEFAULT true NOT NULL;
      END IF;
    END $$;
  `);

  // Step 2: Check if lessons table still has the old instructor_id column pointing to users
  // We need to check both if the column exists AND if it references users table
  const columnInfo = await db.execute<{
    exists: boolean;
    constraint_name: string | null;
    references_users: boolean;
  }>(sql`
    SELECT 
      EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'lessons' 
        AND column_name = 'instructor_id'
        AND table_schema = 'public'
      ) as exists,
      tc.constraint_name,
      CASE 
        WHEN tc.constraint_name LIKE '%users_id_fk' THEN true
        ELSE false
      END as references_users
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'lessons' 
      AND kcu.column_name = 'instructor_id'
      AND tc.constraint_type = 'FOREIGN KEY'
    LIMIT 1
  `);

  const columnExists = columnInfo.rows?.[0]?.exists;
  const referencesUsers = columnInfo.rows?.[0]?.references_users || false;

  // Step 3: Get all unique user IDs that are referenced as instructors in lessons
  // This handles both cases: old schema (direct user reference) and new schema (instructor reference that might need user lookup)
  let uniqueInstructorUsers: {
    rows?: Array<{ user_id: number; image_id: number | null }>;
  };

  if (referencesUsers && columnExists) {
    // Old schema: instructor_id directly references users
    uniqueInstructorUsers = await db.execute<{
      user_id: number;
      image_id: number | null;
    }>(sql`
      SELECT DISTINCT l.instructor_id as user_id, u.image_id
      FROM lessons l
      INNER JOIN users u ON l.instructor_id = u.id
      WHERE l.instructor_id IS NOT NULL
    `);
  } else if (columnExists) {
    // New schema: instructor_id references instructors, but we need to check if any lessons have invalid references
    // or if there are any users that should be instructors but aren't yet
    // First, get all lessons with instructor_id that might need migration
    const lessonsWithInstructors = await db.execute<{
      instructor_id: number | null;
    }>(sql`
      SELECT instructor_id FROM lessons WHERE instructor_id IS NOT NULL
    `);

    // Check if all instructor_ids are valid instructor records
    const invalidInstructors = await db.execute<{
      user_id: number;
      image_id: number | null;
    }>(sql`
      SELECT DISTINCT l.instructor_id as user_id, u.image_id
      FROM lessons l
      INNER JOIN users u ON l.instructor_id = u.id
      LEFT JOIN instructors i ON i.id = l.instructor_id
      WHERE l.instructor_id IS NOT NULL
        AND i.id IS NULL
        AND EXISTS (SELECT 1 FROM users WHERE id = l.instructor_id)
    `);

    uniqueInstructorUsers = invalidInstructors;
  } else {
    // Column doesn't exist yet, migration not needed
    return;
  }

  // Step 4: Create instructor records using Payload API for proper validation and hooks
  const instructorMap = new Map<number, number>();

  for (const row of uniqueInstructorUsers.rows || []) {
    const userId = row.user_id;
    const imageId = row.image_id;

    try {
      // Check if instructor already exists for this user
      const existingInstructors = await payload.find({
        collection: "instructors",
        where: {
          user: {
            equals: userId,
          },
        },
        limit: 1,
        req,
      });

      let instructorId: number;

      if (existingInstructors.docs && existingInstructors.docs.length > 0) {
        instructorId =
          existingInstructors.docs[0]?.id &&
          typeof existingInstructors.docs[0].id === "number"
            ? existingInstructors.docs[0].id
            : parseInt(existingInstructors.docs[0]?.id as string);
      } else {
        // Create new instructor record, copying image from user if available
        // Set active to true by default for migrated instructors
        const newInstructor = await payload.create({
          collection: "instructors",
          data: {
            user: userId,
            image: imageId || undefined,
            active: true,
          },
          req,
        });
        instructorId =
          typeof newInstructor.id === "number"
            ? newInstructor.id
            : parseInt(newInstructor.id as string);
      }

      instructorMap.set(userId, instructorId);
    } catch (error) {
      console.error(`Error creating instructor for user ${userId}:`, error);
      // Continue with other users even if one fails
    }
  }

  // Step 5: Only proceed with schema migration if we're migrating from users to instructors
  if (referencesUsers && instructorMap.size > 0) {
    // Add temporary column for new instructor_id
    await db.execute(sql`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'lessons' AND column_name = 'instructor_id_new') THEN
          ALTER TABLE "lessons" ADD COLUMN "instructor_id_new" integer;
        END IF;
      END $$;
    `);

    // Step 6: Update lessons with new instructor_id values
    for (const [userId, instructorId] of instructorMap.entries()) {
      await db.execute(sql`
        UPDATE lessons 
        SET instructor_id_new = ${instructorId}
        WHERE instructor_id = ${userId}
      `);
    }

    // Step 7: Drop old foreign key constraint and column, rename new column
    await db.execute(sql`
      DO $$ 
      BEGIN
        -- Drop old foreign key constraint if it exists
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'lessons_instructor_id_users_id_fk' 
                   AND table_name = 'lessons') THEN
          ALTER TABLE "lessons" DROP CONSTRAINT "lessons_instructor_id_users_id_fk";
        END IF;
        
        -- Drop old index if it exists
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'lessons_instructor_id_idx') THEN
          DROP INDEX IF EXISTS "lessons_instructor_id_idx";
        END IF;
        
        -- Drop old column
        ALTER TABLE "lessons" DROP COLUMN IF EXISTS "instructor_id";
        
        -- Rename new column
        ALTER TABLE "lessons" RENAME COLUMN "instructor_id_new" TO "instructor_id";
        
        -- Add new foreign key constraint (Payload may have already added this)
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                       WHERE constraint_name = 'lessons_instructor_id_instructors_id_fk' 
                       AND table_name = 'lessons') THEN
          ALTER TABLE "lessons" ADD CONSTRAINT "lessons_instructor_id_instructors_id_fk" 
            FOREIGN KEY ("instructor_id") REFERENCES "public"."instructors"("id") ON DELETE set null ON UPDATE no action;
        END IF;
        
        -- Add new index (Payload may have already added this)
        CREATE INDEX IF NOT EXISTS "lessons_instructor_id_idx" ON "lessons" USING btree ("instructor_id");
      END $$;
    `);
  } else if (!referencesUsers && instructorMap.size > 0) {
    // Schema is already migrated, but we have lessons with invalid instructor references
    // Update those lessons to point to the newly created instructor records
    for (const [userId, instructorId] of instructorMap.entries()) {
      // Find lessons that have this user_id as instructor_id (which shouldn't happen in new schema)
      // This handles edge cases where data might be inconsistent
      await db.execute(sql`
        UPDATE lessons 
        SET instructor_id = ${instructorId}
        WHERE instructor_id = ${userId}
          AND NOT EXISTS (
            SELECT 1 FROM instructors WHERE id = ${userId}
          )
      `);
    }
  }
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

import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

/**
 * Migration to replace user references with instructor references in lessons
 *
 * This migration:
 * 1. Finds all lessons where instructor_id points to a user (not an instructor)
 * 2. For each such lesson, finds the instructor associated with that user
 * 3. Updates the lesson to reference the instructor instead of the user
 *
 * This assumes that instructors already exist (created by previous migrations).
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  try {
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

    if (!tablesExist.rows?.[0]?.exists) {
      console.log("Required tables do not exist, skipping migration");
      return;
    }

    // Step 1: Find lessons where instructor_id points to a user (not an instructor)
    // and find the corresponding instructor for that user
    const lessonsToUpdate = await db.execute<{
      lesson_id: number;
      user_id: number;
      instructor_id: number;
    }>(sql`
      SELECT DISTINCT
        l.id as lesson_id,
        l.instructor_id as user_id,
        i.id as instructor_id
      FROM lessons l
      INNER JOIN users u ON l.instructor_id = u.id
      INNER JOIN instructors i ON i.user_id = u.id
      LEFT JOIN instructors i_check ON i_check.id = l.instructor_id
      WHERE l.instructor_id IS NOT NULL
        AND i_check.id IS NULL
    `);

    if (lessonsToUpdate.rows && lessonsToUpdate.rows.length > 0) {
      console.log(`Found ${lessonsToUpdate.rows.length} lessons with user references that need to be updated to instructor references`);

      // Update each lesson
      for (const row of lessonsToUpdate.rows) {
        try {
          await db.execute(sql`
            UPDATE lessons 
            SET instructor_id = ${row.instructor_id}
            WHERE id = ${row.lesson_id}
              AND instructor_id = ${row.user_id}
          `);
          console.log(`Updated lesson ${row.lesson_id}: user ${row.user_id} -> instructor ${row.instructor_id}`);
        } catch (error) {
          console.error(`Error updating lesson ${row.lesson_id}:`, error);
        }
      }
    } else {
      console.log("No lessons found with user references that need updating");
    }

    // Step 2: Clean up any remaining invalid references (lessons pointing to users that don't have instructors)
    const invalidLessons = await db.execute<{ lesson_id: number }>(sql`
      SELECT l.id as lesson_id
      FROM lessons l
      INNER JOIN users u ON l.instructor_id = u.id
      LEFT JOIN instructors i ON i.user_id = u.id
      WHERE l.instructor_id IS NOT NULL
        AND i.id IS NULL
    `);

    if (invalidLessons.rows && invalidLessons.rows.length > 0) {
      console.log(`Found ${invalidLessons.rows.length} lessons with user references that don't have corresponding instructors - setting to NULL`);
      
      for (const row of invalidLessons.rows) {
        try {
          await db.execute(sql`
            UPDATE lessons 
            SET instructor_id = NULL
            WHERE id = ${row.lesson_id}
          `);
          console.log(`Set instructor_id to NULL for lesson ${row.lesson_id} (no instructor found for user)`);
        } catch (error) {
          console.error(`Error updating lesson ${row.lesson_id}:`, error);
        }
      }
    }
  } catch (error) {
    console.error("Error during migration:", error);
    throw error;
  }
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Reverse migration: convert instructor references back to user references
  try {
    const tablesExist = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'lessons'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'instructors'
      ) as exists
    `);

    if (!tablesExist.rows?.[0]?.exists) {
      return;
    }

    // Find lessons with instructor references and convert back to user references
    const lessonsToRevert = await db.execute<{
      lesson_id: number;
      instructor_id: number;
      user_id: number;
    }>(sql`
      SELECT DISTINCT
        l.id as lesson_id,
        l.instructor_id as instructor_id,
        i.user_id
      FROM lessons l
      INNER JOIN instructors i ON l.instructor_id = i.id
      WHERE l.instructor_id IS NOT NULL
    `);

    if (lessonsToRevert.rows && lessonsToRevert.rows.length > 0) {
      console.log(`Reverting ${lessonsToRevert.rows.length} lessons from instructor references back to user references`);

      for (const row of lessonsToRevert.rows) {
        try {
          await db.execute(sql`
            UPDATE lessons 
            SET instructor_id = ${row.user_id}
            WHERE id = ${row.lesson_id}
          `);
        } catch (error) {
          console.error(`Error reverting lesson ${row.lesson_id}:`, error);
        }
      }
    }
  } catch (error) {
    console.error("Error during migration rollback:", error);
    throw error;
  }
}

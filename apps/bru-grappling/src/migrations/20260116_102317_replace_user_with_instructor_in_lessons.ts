import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

/**
 * Migration to replace user references with instructor references in lessons
 *
 * This migration:
 * 1. Finds all lessons where instructor_id points to a user (not an instructor)
 * 2. For each such lesson, finds the instructor associated with that user
 * 3. Updates the lesson to reference the instructor instead of the user
 * 4. Also handles scheduler_week_days_time_slot table if it exists
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

    // Step 1: Check if users table has image_id column
    const hasImageIdColumn = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'image_id'
        AND table_schema = 'public'
      ) as exists
    `);
    const userHasImageId = hasImageIdColumn.rows?.[0]?.exists || false;

    // Step 2: Find lessons where instructor_id points to a user (not an instructor)
    // First, ensure instructors exist for all users referenced in lessons
    const usersNeedingInstructors = userHasImageId
      ? await db.execute<{
          user_id: number;
          user_name: string | null;
          user_image_id: number | null;
        }>(sql`
          SELECT DISTINCT
            l.instructor_id as user_id,
            u.name as user_name,
            u.image_id as user_image_id
          FROM lessons l
          INNER JOIN users u ON l.instructor_id = u.id
          LEFT JOIN instructors i ON i.user_id = l.instructor_id
          WHERE l.instructor_id IS NOT NULL
            AND i.id IS NULL
        `)
      : await db.execute<{
          user_id: number;
          user_name: string | null;
          user_image_id: number | null;
        }>(sql`
          SELECT DISTINCT
            l.instructor_id as user_id,
            u.name as user_name,
            NULL::integer as user_image_id
          FROM lessons l
          INNER JOIN users u ON l.instructor_id = u.id
          LEFT JOIN instructors i ON i.user_id = l.instructor_id
          WHERE l.instructor_id IS NOT NULL
            AND i.id IS NULL
        `);

    // Create instructors for users that don't have them yet, and update existing ones with images
    if (usersNeedingInstructors.rows && usersNeedingInstructors.rows.length > 0) {
      console.log(`Found ${usersNeedingInstructors.rows.length} users referenced in lessons that need instructor records`);
      
      for (const row of usersNeedingInstructors.rows) {
        try {
          const userName = row.user_name || `User ${row.user_id}`;
          
          // Check if instructor already exists
          const existingInstructor = await db.execute<{ id: number; profile_image_id: number | null }>(sql`
            SELECT id, profile_image_id FROM instructors WHERE user_id = ${row.user_id} LIMIT 1
          `);
          
          if (!existingInstructor.rows || existingInstructor.rows.length === 0) {
            // Create instructor using Payload API to ensure proper validation
            const newInstructor = await payload.create({
              collection: "instructors",
              data: {
                user: row.user_id,
                name: userName,
                active: true,
                profileImage: row.user_image_id || undefined,
              },
              req,
            });
            console.log(`Created instructor ${newInstructor.id} for user ${row.user_id}${row.user_image_id ? ` with image ${row.user_image_id}` : ''}`);
          } else if (existingInstructor.rows && existingInstructor.rows.length > 0) {
            // Update existing instructor with image if it doesn't have one
            const existing = existingInstructor.rows[0]!;
            if (row.user_image_id && !existing.profile_image_id) {
              await payload.update({
                collection: "instructors",
                id: existing.id,
                data: {
                  profileImage: row.user_image_id,
                },
                req,
              });
              console.log(`Updated instructor ${existing.id} for user ${row.user_id} with image ${row.user_image_id}`);
            }
          }
        } catch (error) {
          console.error(`Error creating/updating instructor for user ${row.user_id}:`, error);
        }
      }
    }

    // Step 3: Update all lessons in bulk - group by user_id to instructor_id mapping
    // This ensures all lessons for each user get updated to their corresponding instructor
    const userToInstructorMap = await db.execute<{
      user_id: number;
      instructor_id: number;
    }>(sql`
      SELECT DISTINCT
        u.id as user_id,
        i.id as instructor_id
      FROM users u
      INNER JOIN instructors i ON i.user_id = u.id
      WHERE EXISTS (
        SELECT 1 FROM lessons l 
        WHERE l.instructor_id = u.id
          AND NOT EXISTS (SELECT 1 FROM instructors i_check WHERE i_check.id = l.instructor_id)
      )
    `);

    if (userToInstructorMap.rows && userToInstructorMap.rows.length > 0) {
      console.log(`Found ${userToInstructorMap.rows.length} user-to-instructor mappings to update`);

      // Update all lessons for each user in bulk
      for (const mapping of userToInstructorMap.rows) {
        try {
          const updateResult = await db.execute(sql`
            UPDATE lessons 
            SET instructor_id = ${mapping.instructor_id}
            WHERE instructor_id = ${mapping.user_id}
              AND NOT EXISTS (SELECT 1 FROM instructors i_check WHERE i_check.id = lessons.instructor_id)
          `);
          const updatedCount = updateResult.rowCount || 0;
          if (updatedCount > 0) {
            console.log(`Updated ${updatedCount} lessons: user ${mapping.user_id} -> instructor ${mapping.instructor_id}`);
          }
        } catch (error) {
          console.error(`Error updating lessons for user ${mapping.user_id}:`, error);
        }
      }
    } else {
      console.log("No lessons found with user references that need updating");
    }

    // Step 4: Handle scheduler_week_days_time_slot table if it exists
    const schedulerTableExists = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'scheduler_week_days_time_slot'
      ) as exists
    `);

    if (schedulerTableExists.rows?.[0]?.exists) {
      // First, ensure instructors exist for all users referenced in scheduler slots
      const schedulerUsersNeedingInstructors = userHasImageId
        ? await db.execute<{
            user_id: number;
            user_name: string | null;
            user_image_id: number | null;
          }>(sql`
            SELECT DISTINCT
              s.instructor_id as user_id,
              u.name as user_name,
              u.image_id as user_image_id
            FROM scheduler_week_days_time_slot s
            INNER JOIN users u ON s.instructor_id = u.id
            LEFT JOIN instructors i ON i.user_id = s.instructor_id
            WHERE s.instructor_id IS NOT NULL
              AND i.id IS NULL
          `)
        : await db.execute<{
            user_id: number;
            user_name: string | null;
            user_image_id: number | null;
          }>(sql`
            SELECT DISTINCT
              s.instructor_id as user_id,
              u.name as user_name,
              NULL::integer as user_image_id
            FROM scheduler_week_days_time_slot s
            INNER JOIN users u ON s.instructor_id = u.id
            LEFT JOIN instructors i ON i.user_id = s.instructor_id
            WHERE s.instructor_id IS NOT NULL
              AND i.id IS NULL
          `);

      // Create instructors for users that don't have them yet, and update existing ones with images
      if (schedulerUsersNeedingInstructors.rows && schedulerUsersNeedingInstructors.rows.length > 0) {
        console.log(`Found ${schedulerUsersNeedingInstructors.rows.length} users referenced in scheduler slots that need instructor records`);
        
        for (const row of schedulerUsersNeedingInstructors.rows) {
          try {
            const userName = row.user_name || `User ${row.user_id}`;
            
            // Check if instructor already exists
            const existingInstructor = await db.execute<{ id: number; profile_image_id: number | null }>(sql`
              SELECT id, profile_image_id FROM instructors WHERE user_id = ${row.user_id} LIMIT 1
            `);
            
            if (!existingInstructor.rows || existingInstructor.rows.length === 0) {
              // Create instructor using Payload API to ensure proper validation
              const newInstructor = await payload.create({
                collection: "instructors",
                data: {
                  user: row.user_id,
                  name: userName,
                  active: true,
                  profileImage: row.user_image_id || undefined,
                },
                req,
              });
              console.log(`Created instructor ${newInstructor.id} for user ${row.user_id} (from scheduler)${row.user_image_id ? ` with image ${row.user_image_id}` : ''}`);
            } else if (existingInstructor.rows && existingInstructor.rows.length > 0) {
              // Update existing instructor with image if it doesn't have one
              const existing = existingInstructor.rows[0]!;
              if (row.user_image_id && !existing.profile_image_id) {
                await payload.update({
                  collection: "instructors",
                  id: existing.id,
                  data: {
                    profileImage: row.user_image_id,
                  },
                  req,
                });
                console.log(`Updated instructor ${existing.id} for user ${row.user_id} with image ${row.user_image_id} (from scheduler)`);
              }
            }
          } catch (error) {
            console.error(`Error creating/updating instructor for user ${row.user_id} (from scheduler):`, error);
          }
        }
      }

      // Update scheduler slots in bulk
      const schedulerUserToInstructorMap = await db.execute<{
        user_id: number;
        instructor_id: number;
      }>(sql`
        SELECT DISTINCT
          u.id as user_id,
          i.id as instructor_id
        FROM users u
        INNER JOIN instructors i ON i.user_id = u.id
        WHERE EXISTS (
          SELECT 1 FROM scheduler_week_days_time_slot s 
          WHERE s.instructor_id = u.id
            AND NOT EXISTS (SELECT 1 FROM instructors i_check WHERE i_check.id = s.instructor_id)
        )
      `);

      if (schedulerUserToInstructorMap.rows && schedulerUserToInstructorMap.rows.length > 0) {
        console.log(`Found ${schedulerUserToInstructorMap.rows.length} scheduler user-to-instructor mappings to update`);

        for (const mapping of schedulerUserToInstructorMap.rows) {
          try {
            const updateResult = await db.execute(sql`
              UPDATE scheduler_week_days_time_slot 
              SET instructor_id = ${mapping.instructor_id}
              WHERE instructor_id = ${mapping.user_id}
                AND NOT EXISTS (SELECT 1 FROM instructors i_check WHERE i_check.id = scheduler_week_days_time_slot.instructor_id)
            `);
            const updatedCount = updateResult.rowCount || 0;
            if (updatedCount > 0) {
              console.log(`Updated ${updatedCount} scheduler slots: user ${mapping.user_id} -> instructor ${mapping.instructor_id}`);
            }
          } catch (error) {
            console.error(`Error updating scheduler slots for user ${mapping.user_id}:`, error);
          }
        }
      } else {
        console.log("No scheduler time slots found with user references that need updating");
      }
    }

    // Step 5: Clean up any remaining invalid references (lessons pointing to users that don't have instructors)
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

    // Handle scheduler table if it exists
    const schedulerTableExists = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'scheduler_week_days_time_slot'
      ) as exists
    `);

    if (schedulerTableExists.rows?.[0]?.exists) {
      const schedulerToRevert = await db.execute<{
        slot_id: number;
        instructor_id: number;
        user_id: number;
      }>(sql`
        SELECT DISTINCT
          s.id as slot_id,
          s.instructor_id as instructor_id,
          i.user_id
        FROM scheduler_week_days_time_slot s
        INNER JOIN instructors i ON s.instructor_id = i.id
        WHERE s.instructor_id IS NOT NULL
      `);

      if (schedulerToRevert.rows && schedulerToRevert.rows.length > 0) {
        for (const row of schedulerToRevert.rows) {
          try {
            await db.execute(sql`
              UPDATE scheduler_week_days_time_slot 
              SET instructor_id = ${row.user_id}
              WHERE id = ${row.slot_id}
            `);
          } catch (error) {
            console.error(`Error reverting scheduler slot ${row.slot_id}:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error during migration rollback:", error);
    throw error;
  }
}

import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

/**
 * Migration to replace user references with instructor references in timeslots
 *
 * This migration:
 * 1. Finds all timeslots where instructor_id points to a user (not an instructor)
 * 2. For each such lesson, finds the instructor associated with that user
 * 3. Updates the lesson to reference the instructor instead of the user
 *
 * This assumes that staffMembers already exist (created by previous migrations).
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  try {
    // Check if tables exist
    const tablesExist = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'timeslots'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'staffMembers'
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

    // Step 2: Find timeslots where instructor_id points to a user (not an instructor)
    // First, ensure staffMembers exist for all users referenced in timeslots
    const usersNeedingStaffMembers = userHasImageId
      ? await db.execute<{
          user_id: number;
          user_name: string | null;
          user_image_id: number | null;
        }>(sql`
          SELECT DISTINCT
            l.instructor_id as user_id,
            u.name as user_name,
            u.image_id as user_image_id
          FROM timeslots l
          INNER JOIN users u ON l.instructor_id = u.id
          LEFT JOIN staffMembers i ON i.user_id = l.instructor_id
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
          FROM timeslots l
          INNER JOIN users u ON l.instructor_id = u.id
          LEFT JOIN staffMembers i ON i.user_id = l.instructor_id
          WHERE l.instructor_id IS NOT NULL
            AND i.id IS NULL
        `);

    // Create staffMembers for users that don't have them yet, and update existing ones with images
    if (usersNeedingStaffMembers.rows && usersNeedingStaffMembers.rows.length > 0) {
      console.log(`Found ${usersNeedingStaffMembers.rows.length} users referenced in timeslots that need instructor records`);
      
      for (const row of usersNeedingStaffMembers.rows) {
        try {
          const userName = row.user_name || `User ${row.user_id}`;
          
          // Check if instructor already exists
          const existingStaffMember = await db.execute<{ id: number; profile_image_id: number | null }>(sql`
            SELECT id, profile_image_id FROM staffMembers WHERE user_id = ${row.user_id} LIMIT 1
          `);
          
          if (!existingStaffMember.rows || existingStaffMember.rows.length === 0) {
            // Create instructor using Payload API to ensure proper validation
            const newStaffMember = await payload.create({
              collection: "staffMembers",
              data: {
                user: row.user_id,
                name: userName,
                active: true,
                profileImage: row.user_image_id || undefined,
              },
              req,
            });
            console.log(`Created instructor ${newStaffMember.id} for user ${row.user_id}${row.user_image_id ? ` with image ${row.user_image_id}` : ''}`);
          } else if (existingStaffMember.rows && existingStaffMember.rows.length > 0) {
            // Update existing instructor with image if it doesn't have one
            const existing = existingStaffMember.rows[0]!;
            if (row.user_image_id && !existing.profile_image_id) {
              await payload.update({
                collection: "staffMembers",
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

    // Step 3: Update all timeslots in bulk - group by user_id to instructor_id mapping
    // This ensures all timeslots for each user get updated to their corresponding instructor
    const userToStaffMemberMap = await db.execute<{
      user_id: number;
      instructor_id: number;
    }>(sql`
      SELECT DISTINCT
        u.id as user_id,
        i.id as instructor_id
      FROM users u
      INNER JOIN staffMembers i ON i.user_id = u.id
      WHERE EXISTS (
        SELECT 1 FROM timeslots l 
        WHERE l.instructor_id = u.id
          AND NOT EXISTS (SELECT 1 FROM staffMembers i_check WHERE i_check.id = l.instructor_id)
      )
    `);

    if (userToStaffMemberMap.rows && userToStaffMemberMap.rows.length > 0) {
      console.log(`Found ${userToStaffMemberMap.rows.length} user-to-instructor mappings to update`);

      // Update all timeslots for each user in bulk
      for (const mapping of userToStaffMemberMap.rows) {
        try {
          const updateResult = await db.execute(sql`
            UPDATE timeslots 
            SET instructor_id = ${mapping.instructor_id}
            WHERE instructor_id = ${mapping.user_id}
              AND NOT EXISTS (SELECT 1 FROM staffMembers i_check WHERE i_check.id = timeslots.instructor_id)
          `);
          const updatedCount = updateResult.rowCount || 0;
          if (updatedCount > 0) {
            console.log(`Updated ${updatedCount} timeslots: user ${mapping.user_id} -> instructor ${mapping.instructor_id}`);
          }
        } catch (error) {
          console.error(`Error updating timeslots for user ${mapping.user_id}:`, error);
        }
      }
    } else {
      console.log("No timeslots found with user references that need updating");
    }

    // Step 4: Clean up any remaining invalid references (timeslots pointing to users that don't have staffMembers)
    const invalidTimeslots = await db.execute<{ lesson_id: number }>(sql`
      SELECT l.id as lesson_id
      FROM timeslots l
      INNER JOIN users u ON l.instructor_id = u.id
      LEFT JOIN staffMembers i ON i.user_id = u.id
      WHERE l.instructor_id IS NOT NULL
        AND i.id IS NULL
    `);

    if (invalidTimeslots.rows && invalidTimeslots.rows.length > 0) {
      console.log(`Found ${invalidTimeslots.rows.length} timeslots with user references that don't have corresponding staffMembers - setting to NULL`);
      
      for (const row of invalidTimeslots.rows) {
        try {
          await db.execute(sql`
            UPDATE timeslots 
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
        WHERE table_schema = 'public' AND table_name = 'timeslots'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'staffMembers'
      ) as exists
    `);

    if (!tablesExist.rows?.[0]?.exists) {
      return;
    }

    // Find timeslots with instructor references and convert back to user references
    const timeslotsToRevert = await db.execute<{
      lesson_id: number;
      instructor_id: number;
      user_id: number;
    }>(sql`
      SELECT DISTINCT
        l.id as lesson_id,
        l.instructor_id as instructor_id,
        i.user_id
      FROM timeslots l
      INNER JOIN staffMembers i ON l.instructor_id = i.id
      WHERE l.instructor_id IS NOT NULL
    `);

    if (timeslotsToRevert.rows && timeslotsToRevert.rows.length > 0) {
      console.log(`Reverting ${timeslotsToRevert.rows.length} timeslots from instructor references back to user references`);

      for (const row of timeslotsToRevert.rows) {
        try {
          await db.execute(sql`
            UPDATE timeslots 
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

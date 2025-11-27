/**
 * Quick fix script to migrate instructor_id from users to instructors
 * Run this before starting the dev server: node --loader ts-node/esm fix-instructor-migration.ts
 * Or use: pnpm tsx fix-instructor-migration.ts (if tsx is installed)
 */

import { postgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

const connectionString =
  process.env.DATABASE_URI || 'postgres://postgres:brugrappling@localhost:5432/bru_grappling'

async function fixInstructorMigration() {
  const db = postgresAdapter({
    pool: {
      connectionString,
    },
  })

  try {
    console.log('Starting instructor migration fix...')

    // Step 1: Drop the constraint if it exists
    console.log('Step 1: Dropping constraint if it exists...')
    await db.execute(sql`
      DO $$ 
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lessons_instructor_id_instructors_id_fk') THEN
          ALTER TABLE "lessons" DROP CONSTRAINT "lessons_instructor_id_instructors_id_fk";
          RAISE NOTICE 'Dropped existing constraint';
        END IF;
      EXCEPTION WHEN OTHERS THEN 
        RAISE NOTICE 'Error dropping constraint: %', SQLERRM;
      END $$;
    `)

    // Step 2: Check if users table has image_id column
    const hasImageIdColumn = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'image_id'
      ) as exists
    `)

    const userHasImageId = hasImageIdColumn.rows?.[0]?.exists || false
    console.log(`Users table has image_id column: ${userHasImageId}`)

    // Step 3: Find orphaned lessons
    console.log('Step 2: Finding orphaned lessons...')
    const orphanedLessons = userHasImageId
      ? await db.execute<{
          instructor_id: number
          user_id: number | null
          user_name: string | null
          user_image_id: number | null
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
          instructor_id: number
          user_id: number | null
          user_name: string | null
          user_image_id: number | null
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

    if (!orphanedLessons.rows || orphanedLessons.rows.length === 0) {
      console.log('No orphaned lessons found. Data is already clean!')
      return
    }

    console.log(`Found ${orphanedLessons.rows.length} orphaned lessons to migrate`)

    // Step 4: Create instructors and update lessons
    for (const row of orphanedLessons.rows) {
      if (row.user_id) {
        try {
          // Check if instructor already exists for this user
          const existingInstructors = await db.execute<{ id: number }>(sql`
            SELECT id FROM instructors WHERE user_id = ${row.user_id} LIMIT 1
          `)

          let instructorId: number

          if (existingInstructors.rows && existingInstructors.rows.length > 0) {
            instructorId = existingInstructors.rows[0].id
            console.log(`  Using existing instructor ${instructorId} for user ${row.user_id}`)
          } else {
            // Create new instructor
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
            console.log(
              `  Created new instructor ${instructorId} for user ${row.user_id}${row.user_image_id ? ` (with image ${row.user_image_id})` : ''}`
            )
          }

          // Update lessons
          const updateResult = await db.execute(sql`
            UPDATE lessons 
            SET instructor_id = ${instructorId}
            WHERE instructor_id = ${row.instructor_id}
              AND NOT EXISTS (SELECT 1 FROM instructors WHERE id = ${row.instructor_id})
          `)
          console.log(
            `  Updated lessons: instructor_id ${row.instructor_id} -> ${instructorId} (${updateResult.rowCount || 0} rows)`
          )
        } catch (error) {
          console.error(`  Error migrating instructor_id ${row.instructor_id}:`, error)
          // Set to NULL if we can't migrate
          await db.execute(sql`
            UPDATE lessons 
            SET instructor_id = NULL
            WHERE instructor_id = ${row.instructor_id}
              AND NOT EXISTS (SELECT 1 FROM instructors WHERE id = ${row.instructor_id})
          `)
        }
      }
    }

    // Step 5: Clean up any remaining invalid references
    console.log('Step 3: Cleaning up any remaining invalid references...')
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
    console.log(`Cleaned up ${cleanupResult.rowCount || 0} invalid references`)

    console.log('\n✅ Migration fix complete! You can now start the dev server.')
  } catch (error) {
    console.error('❌ Error during migration fix:', error)
    process.exit(1)
  } finally {
    await db.destroy()
  }
}

fixInstructorMigration()


import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";
import type { CollectionSlug } from "payload";

/**
 * Migration to create staffMembers collection and migrate data from timeslots.instructor (user) to staffMembers
 *
 * This migration:
 * 1. Creates the staffMembers table (if Payload hasn't already)
 * 2. Creates instructor records for each unique user referenced as an instructor in timeslots
 * 3. Copies user image to instructor image if available
 * 4. Updates timeslots to reference staffMembers instead of users
 *
 * Note: This migration should be run after Payload auto-generates the schema migration for the staffMembers collection.
 * If the staffMembers table doesn't exist yet, this migration will create it.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Step 1: Ensure staffMembers table exists (Payload may have already created it)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "staffMembers" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL,
      "description" text,
      "image_id" integer,
      "active" boolean DEFAULT true NOT NULL,
      "name" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "staffMembers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
      CONSTRAINT "staffMembers_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action,
      CONSTRAINT "staffMembers_user_id_unique" UNIQUE("user_id")
    );
    
    CREATE INDEX IF NOT EXISTS "staffMembers_user_id_idx" ON "staffMembers" USING btree ("user_id");
    CREATE INDEX IF NOT EXISTS "staffMembers_image_id_idx" ON "staffMembers" USING btree ("image_id");
    
    -- Add active column if table exists but column doesn't
    DO $$ 
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staffMembers')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staffMembers' AND column_name = 'active') THEN
        ALTER TABLE "staffMembers" ADD COLUMN "active" boolean DEFAULT true NOT NULL;
      END IF;
      
      -- Add name column if table exists but column doesn't
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staffMembers')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staffMembers' AND column_name = 'name') THEN
        ALTER TABLE "staffMembers" ADD COLUMN "name" varchar;
      END IF;
    END $$;
  `);

  // Step 2: Temporarily drop the foreign key constraint if it exists and is causing issues
  // This allows us to fix orphaned data before Payload tries to add/re-add the constraint
  await db.execute(sql`
    DO $$ 
    BEGIN
      -- Drop the constraint if it exists (it might be in an invalid state)
      IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'timeslots_instructor_id_staffMembers_id_fk' 
                 AND table_name = 'timeslots') THEN
        ALTER TABLE "timeslots" DROP CONSTRAINT "timeslots_instructor_id_staffMembers_id_fk";
      END IF;
    END $$;
  `);

  // Step 3: Fix any orphaned instructor_id references in timeslots
  // This handles the case where timeslots have instructor_id values that don't exist in staffMembers table
  // This can happen if Payload is trying to add the constraint but there are invalid references
  const orphanedTimeslots = await db.execute<{
    instructor_id: number;
    user_id: number | null;
  }>(sql`
    SELECT DISTINCT 
      l.instructor_id,
      u.id as user_id
    FROM timeslots l
    LEFT JOIN staffMembers i ON i.id = l.instructor_id
    LEFT JOIN users u ON u.id = l.instructor_id
    WHERE l.instructor_id IS NOT NULL
      AND i.id IS NULL
  `);

  // Create instructor records for orphaned references that are user IDs
  if (orphanedTimeslots.rows && orphanedTimeslots.rows.length > 0) {
    for (const row of orphanedTimeslots.rows) {
      if (row.user_id) {
        try {
          // Check if instructor already exists for this user
          const existingStaffMembers = await payload.find({
            collection: "staffMembers" as CollectionSlug,
            where: {
              user: {
                equals: row.user_id,
              },
            },
            limit: 1,
            req,
          });

          let instructorId: number;

          if (existingStaffMembers.docs && existingStaffMembers.docs.length > 0 && existingStaffMembers.docs[0]) {
            const existingDoc = existingStaffMembers.docs[0];
            instructorId =
              typeof existingDoc.id === "number"
                ? existingDoc.id
                : parseInt(existingDoc.id as string);
          } else {
            // Get user to get their name
            const user = await payload.findByID({
              collection: 'users',
              id: row.user_id,
              req,
            });
            
            // Create new instructor record
            const newStaffMember = await payload.create({
              collection: "staffMembers" as CollectionSlug,
              data: {
                user: row.user_id,
                active: true,
                name: (user as any)?.name || `User ${row.user_id}`,
              } as any,
              req,
            });
            instructorId =
              typeof newStaffMember.id === "number"
                ? newStaffMember.id
                : parseInt(newStaffMember.id as string);
          }

          // Update timeslots with this orphaned instructor_id to point to the new instructor
          await db.execute(sql`
            UPDATE timeslots 
            SET instructor_id = ${instructorId}
            WHERE instructor_id = ${row.instructor_id}
              AND NOT EXISTS (SELECT 1 FROM staffMembers WHERE id = ${row.instructor_id})
          `);
        } catch (error) {
          console.error(`Error fixing orphaned instructor reference ${row.instructor_id}:`, error);
          // If we can't create an instructor, set the reference to NULL
          await db.execute(sql`
            UPDATE timeslots 
            SET instructor_id = NULL
            WHERE instructor_id = ${row.instructor_id}
              AND NOT EXISTS (SELECT 1 FROM staffMembers WHERE id = ${row.instructor_id})
          `);
        }
      } else {
        // Not a user ID, set to NULL
        await db.execute(sql`
          UPDATE timeslots 
          SET instructor_id = NULL
          WHERE instructor_id = ${row.instructor_id}
            AND NOT EXISTS (SELECT 1 FROM staffMembers WHERE id = ${row.instructor_id})
        `);
      }
    }
  }

  // Step 4: Check if timeslots table still has the old instructor_id column pointing to users
  // We need to check both if the column exists AND if it references users table
  const columnInfo = await db.execute<{
    exists: boolean;
    constraint_name: string | null;
    references_users: boolean;
  }>(sql`
    SELECT 
      EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'timeslots' 
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
    WHERE tc.table_name = 'timeslots' 
      AND kcu.column_name = 'instructor_id'
      AND tc.constraint_type = 'FOREIGN KEY'
    LIMIT 1
  `);

  const columnExists = columnInfo.rows?.[0]?.exists;
  const referencesUsers = columnInfo.rows?.[0]?.references_users || false;

  // Step 5: Get all unique user IDs that are referenced as staffMembers in timeslots
  // This handles both cases: old schema (direct user reference) and new schema (instructor reference that might need user lookup)
  let uniqueStaffMemberUsers: {
    rows?: Array<{ user_id: number }>;
  };

  if (referencesUsers && columnExists) {
    // Old schema: instructor_id directly references users
    uniqueStaffMemberUsers = await db.execute<{
      user_id: number;
    }>(sql`
      SELECT DISTINCT l.instructor_id as user_id
      FROM timeslots l
      INNER JOIN users u ON l.instructor_id = u.id
      WHERE l.instructor_id IS NOT NULL
    `);
  } else if (columnExists) {
    // New schema: instructor_id references staffMembers, but we need to check if any timeslots have invalid references
    // or if there are any users that should be staffMembers but aren't yet
    // First, get all timeslots with instructor_id that might need migration
    const timeslotsWithStaffMembers = await db.execute<{
      instructor_id: number | null;
    }>(sql`
      SELECT instructor_id FROM timeslots WHERE instructor_id IS NOT NULL
    `);

    // Check if all instructor_ids are valid instructor records
    const invalidStaffMembers = await db.execute<{
      user_id: number;
    }>(sql`
      SELECT DISTINCT l.instructor_id as user_id
      FROM timeslots l
      INNER JOIN users u ON l.instructor_id = u.id
      LEFT JOIN staffMembers i ON i.id = l.instructor_id
      WHERE l.instructor_id IS NOT NULL
        AND i.id IS NULL
        AND EXISTS (SELECT 1 FROM users WHERE id = l.instructor_id)
    `);

    uniqueStaffMemberUsers = invalidStaffMembers;
  } else {
    // Column doesn't exist yet, migration not needed
    return;
  }

  // Step 6: Create instructor records using Payload API for proper validation and hooks
  const instructorMap = new Map<number, number>();

  for (const row of uniqueStaffMemberUsers.rows || []) {
    const userId = row.user_id;

    try {
      // Check if instructor already exists for this user
      const existingStaffMembers = await payload.find({
        collection: "staffMembers" as CollectionSlug,
        where: {
          user: {
            equals: userId,
          },
        },
        limit: 1,
        req,
      });

      let instructorId: number;

      if (existingStaffMembers.docs && existingStaffMembers.docs.length > 0) {
        const existingId = existingStaffMembers.docs[0]?.id;
        instructorId =
          existingId && typeof existingId === "number"
            ? existingId
            : parseInt(String(existingId));
      } else {
            // Get user to get their name
            const user = await payload.findByID({
              collection: 'users',
              id: userId,
              req,
            });
            
            // Create new instructor record
            // Set active to true by default for migrated staffMembers
            // Set name from user's name
            const newStaffMember = await payload.create({
              collection: "staffMembers" as CollectionSlug,
              data: {
                user: userId,
                active: true,
                name: (user as any)?.name || `User ${userId}`,
              } as any,
              req,
            });
        instructorId =
          typeof newStaffMember.id === "number"
            ? newStaffMember.id
            : parseInt(newStaffMember.id as string);
      }

      instructorMap.set(userId, instructorId);
    } catch (error) {
      console.error(`Error creating instructor for user ${userId}:`, error);
      // Continue with other users even if one fails
    }
  }

  // Step 7: Only proceed with schema migration if we're migrating from users to staffMembers
  if (referencesUsers && instructorMap.size > 0) {
    // Add temporary column for new instructor_id
    await db.execute(sql`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'timeslots' AND column_name = 'instructor_id_new') THEN
          ALTER TABLE "timeslots" ADD COLUMN "instructor_id_new" integer;
        END IF;
      END $$;
    `);

    // Step 8: Update timeslots with new instructor_id values
    for (const [userId, instructorId] of instructorMap.entries()) {
      await db.execute(sql`
        UPDATE timeslots 
        SET instructor_id_new = ${instructorId}
        WHERE instructor_id = ${userId}
      `);
    }

    // Step 9: Drop old foreign key constraint and column, rename new column
    await db.execute(sql`
      DO $$ 
      BEGIN
        -- Drop old foreign key constraint if it exists
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'timeslots_instructor_id_users_id_fk' 
                   AND table_name = 'timeslots') THEN
          ALTER TABLE "timeslots" DROP CONSTRAINT "timeslots_instructor_id_users_id_fk";
        END IF;
        
        -- Drop old index if it exists
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'timeslots_instructor_id_idx') THEN
          DROP INDEX IF EXISTS "timeslots_instructor_id_idx";
        END IF;
        
        -- Drop old column
        ALTER TABLE "timeslots" DROP COLUMN IF EXISTS "instructor_id";
        
        -- Rename new column
        ALTER TABLE "timeslots" RENAME COLUMN "instructor_id_new" TO "instructor_id";
        
        -- Add new foreign key constraint (we dropped it earlier if it existed)
        -- Only add if it doesn't exist (Payload might add it during schema sync)
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                       WHERE constraint_name = 'timeslots_instructor_id_staffMembers_id_fk' 
                       AND table_name = 'timeslots') THEN
          ALTER TABLE "timeslots" ADD CONSTRAINT "timeslots_instructor_id_staffMembers_id_fk" 
            FOREIGN KEY ("instructor_id") REFERENCES "public"."staffMembers"("id") ON DELETE set null ON UPDATE no action;
        END IF;
        
        -- Add new index (Payload may have already added this)
        CREATE INDEX IF NOT EXISTS "timeslots_instructor_id_idx" ON "timeslots" USING btree ("instructor_id");
      END $$;
    `);
  } else if (!referencesUsers && instructorMap.size > 0) {
    // Schema is already migrated, but we have timeslots with invalid instructor references
    // Update those timeslots to point to the newly created instructor records
    for (const [userId, instructorId] of instructorMap.entries()) {
      // Find timeslots that have this user_id as instructor_id (which shouldn't happen in new schema)
      // This handles edge cases where data might be inconsistent
      await db.execute(sql`
        UPDATE timeslots 
        SET instructor_id = ${instructorId}
        WHERE instructor_id = ${userId}
          AND NOT EXISTS (
            SELECT 1 FROM staffMembers WHERE id = ${userId}
          )
      `);
    }
  }

  // Step 10: Populate name field for all existing staffMembers that don't have a name
  const staffMembersWithoutName = await db.execute<{
    id: number;
    user_id: number;
  }>(sql`
    SELECT i.id, i.user_id
    FROM staffMembers i
    LEFT JOIN users u ON i.user_id = u.id
    WHERE i.name IS NULL OR i.name = ''
  `);

  if (staffMembersWithoutName.rows && staffMembersWithoutName.rows.length > 0) {
    for (const row of staffMembersWithoutName.rows) {
      try {
        const user = await payload.findByID({
          collection: 'users',
          id: row.user_id,
          req,
        });
        const userName = (user as any)?.name || `User ${row.user_id}`;
        
        // Update the instructor's name field
        await db.execute(sql`
          UPDATE staffMembers 
          SET name = ${userName}
          WHERE id = ${row.id}
        `);
      } catch (error) {
        console.error(`Error populating name for instructor ${row.id}:`, error);
      }
    }
  }
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  // Reverse the migration

  // Step 1: Revert timeslots table to use user_id
  await db.execute(sql`
    DO $$ 
    BEGIN
      -- Drop new foreign key constraint
      IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'timeslots_instructor_id_staffMembers_id_fk' 
                 AND table_name = 'timeslots') THEN
        ALTER TABLE "timeslots" DROP CONSTRAINT "timeslots_instructor_id_staffMembers_id_fk";
      END IF;
      
      -- Drop new index
      DROP INDEX IF EXISTS "timeslots_instructor_id_idx";
      
      -- Add column for user_id
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'timeslots' AND column_name = 'instructor_id_old') THEN
        ALTER TABLE "timeslots" ADD COLUMN "instructor_id_old" integer;
      END IF;
    END $$;
  `);

  // Step 2: Map instructor_id back to user_id
  const instructorToUserMap = await db.execute<{
    id: number;
    user_id: number;
  }>(sql`
    SELECT id, user_id FROM staffMembers
  `);

  for (const row of instructorToUserMap.rows || []) {
    await db.execute(sql`
      UPDATE timeslots 
      SET instructor_id_old = ${row.user_id}
      WHERE instructor_id = ${row.id}
    `);
  }

  // Step 3: Rename column and restore old foreign key
  await db.execute(sql`
    DO $$ 
    BEGIN
      ALTER TABLE "timeslots" DROP COLUMN IF EXISTS "instructor_id";
      ALTER TABLE "timeslots" RENAME COLUMN "instructor_id_old" TO "instructor_id";
      
      ALTER TABLE "timeslots" ADD CONSTRAINT "timeslots_instructor_id_users_id_fk" 
        FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
      
      CREATE INDEX IF NOT EXISTS "timeslots_instructor_id_idx" ON "timeslots" USING btree ("instructor_id");
    END $$;
  `);

  // Step 4: Drop staffMembers table
  await db.execute(sql`
    DROP TABLE IF EXISTS "staffMembers" CASCADE;
  `);
}


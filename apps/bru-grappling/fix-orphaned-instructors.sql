-- Fix orphaned instructor_id references in lessons table
-- Run this script before starting the server if you encounter foreign key constraint errors

-- Step 1: Drop the constraint if it exists (even if in invalid state)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lessons_instructor_id_instructors_id_fk') THEN
    ALTER TABLE "lessons" DROP CONSTRAINT "lessons_instructor_id_instructors_id_fk";
    RAISE NOTICE 'Dropped existing constraint';
  END IF;
EXCEPTION WHEN OTHERS THEN 
  RAISE NOTICE 'Error dropping constraint (may not exist): %', SQLERRM;
END $$;

-- Step 2: Clean up orphaned instructor_id references
UPDATE "lessons" 
SET "instructor_id" = NULL 
WHERE "instructor_id" IS NOT NULL 
AND NOT EXISTS (
  SELECT 1 FROM "instructors" WHERE "instructors"."id" = "lessons"."instructor_id"
);

-- Show how many rows were affected
DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE 'Cleaned up % orphaned instructor_id references', affected_count;
END $$;

-- Step 3: Verify no orphaned references remain
SELECT COUNT(*) as orphaned_count
FROM "lessons" 
WHERE "instructor_id" IS NOT NULL 
AND NOT EXISTS (
  SELECT 1 FROM "instructors" WHERE "instructors"."id" = "lessons"."instructor_id"
);



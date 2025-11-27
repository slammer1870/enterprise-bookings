-- Quick fix SQL script to migrate instructor_id from users to instructors
-- Run this with: psql $DATABASE_URI -f fix-instructor-migration.sql
-- Or: psql postgres://postgres:brugrappling@localhost:5432/bru_grappling -f fix-instructor-migration.sql

-- Set search path to public schema
SET search_path TO public;

-- Step 1: Drop the constraints if they exist
DO $$ 
BEGIN
  -- Drop lessons constraint
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public' 
    AND c.conname = 'lessons_instructor_id_instructors_id_fk'
  ) THEN
    ALTER TABLE public.lessons DROP CONSTRAINT lessons_instructor_id_instructors_id_fk;
    RAISE NOTICE 'Dropped lessons_instructor_id_instructors_id_fk constraint';
  END IF;
  
  -- Drop scheduler_week_days_time_slot constraint
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public' 
    AND c.conname = 'scheduler_week_days_time_slot_instructor_id_instructors_id_fk'
  ) THEN
    ALTER TABLE public.scheduler_week_days_time_slot DROP CONSTRAINT scheduler_week_days_time_slot_instructor_id_instructors_id_fk;
    RAISE NOTICE 'Dropped scheduler_week_days_time_slot_instructor_id_instructors_id_fk constraint';
  END IF;
EXCEPTION WHEN OTHERS THEN 
  RAISE NOTICE 'Error dropping constraints: %', SQLERRM;
END $$;

-- Step 2: Create instructors from users that are referenced in lessons
-- First, check if tables exist and if users table has image_id column
DO $$
DECLARE
  tables_exist BOOLEAN;
  has_image_id BOOLEAN;
  user_id_val INTEGER;
  user_name_val VARCHAR;
  user_image_id_val INTEGER;
  instructor_id_val INTEGER;
  lesson_instructor_id INTEGER;
BEGIN
  -- Check if tables exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'lessons'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'instructors'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'users'
  ) INTO tables_exist;

  IF NOT tables_exist THEN
    RAISE NOTICE 'Tables do not exist yet. Migration will be handled by Payload migrations.';
    RETURN;
  END IF;

  -- Check if image_id column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'image_id'
  ) INTO has_image_id;

  -- Loop through orphaned lessons
  FOR lesson_instructor_id IN 
    SELECT DISTINCT l.instructor_id
    FROM public.lessons l
    LEFT JOIN public.instructors i ON i.id = l.instructor_id
    LEFT JOIN public.users u ON u.id = l.instructor_id
    WHERE l.instructor_id IS NOT NULL
      AND i.id IS NULL
      AND u.id IS NOT NULL
  LOOP
    -- Get user info
    IF has_image_id THEN
      SELECT u.id, u.name, u.image_id
      INTO user_id_val, user_name_val, user_image_id_val
      FROM public.users u
      WHERE u.id = lesson_instructor_id;
    ELSE
      SELECT u.id, u.name, NULL::INTEGER
      INTO user_id_val, user_name_val, user_image_id_val
      FROM public.users u
      WHERE u.id = lesson_instructor_id;
    END IF;

    IF user_id_val IS NOT NULL THEN
      -- Check if instructor already exists for this user
      SELECT id INTO instructor_id_val
      FROM public.instructors
      WHERE user_id = user_id_val
      LIMIT 1;

      -- Create instructor if it doesn't exist
      IF instructor_id_val IS NULL THEN
        INSERT INTO public.instructors (user_id, name, profile_image_id, active, created_at, updated_at)
        VALUES (
          user_id_val,
          COALESCE(user_name_val, 'User ' || user_id_val::TEXT),
          user_image_id_val,
          true,
          now(),
          now()
        )
        RETURNING id INTO instructor_id_val;
        
        RAISE NOTICE 'Created instructor % for user %', instructor_id_val, user_id_val;
      ELSE
        RAISE NOTICE 'Using existing instructor % for user %', instructor_id_val, user_id_val;
      END IF;

      -- Update lessons to point to the instructor
      UPDATE public.lessons
      SET instructor_id = instructor_id_val
      WHERE instructor_id = lesson_instructor_id
        AND NOT EXISTS (SELECT 1 FROM public.instructors WHERE id = lesson_instructor_id);
        
      RAISE NOTICE 'Updated lessons: instructor_id % -> %', lesson_instructor_id, instructor_id_val;
    END IF;
  END LOOP;

  -- Clean up any remaining invalid references in lessons
  UPDATE public.lessons l
  SET instructor_id = NULL
  WHERE l.instructor_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.instructors WHERE id = l.instructor_id)
    AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = l.instructor_id);

  -- Now fix scheduler_week_days_time_slot table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scheduler_week_days_time_slot') THEN
    RAISE NOTICE 'Fixing scheduler_week_days_time_slot table...';
    
    -- Loop through orphaned scheduler time slots
    FOR lesson_instructor_id IN 
      SELECT DISTINCT s.instructor_id
      FROM public.scheduler_week_days_time_slot s
      LEFT JOIN public.instructors i ON i.id = s.instructor_id
      LEFT JOIN public.users u ON u.id = s.instructor_id
      WHERE s.instructor_id IS NOT NULL
        AND i.id IS NULL
        AND u.id IS NOT NULL
    LOOP
    -- Get user info
    IF has_image_id THEN
      SELECT u.id, u.name, u.image_id
      INTO user_id_val, user_name_val, user_image_id_val
      FROM public.users u
      WHERE u.id = lesson_instructor_id;
    ELSE
      SELECT u.id, u.name, NULL::INTEGER
      INTO user_id_val, user_name_val, user_image_id_val
      FROM public.users u
      WHERE u.id = lesson_instructor_id;
    END IF;

    IF user_id_val IS NOT NULL THEN
      -- Check if instructor already exists for this user
      SELECT id INTO instructor_id_val
      FROM public.instructors
      WHERE user_id = user_id_val
      LIMIT 1;

      -- Create instructor if it doesn't exist
      IF instructor_id_val IS NULL THEN
        INSERT INTO public.instructors (user_id, name, profile_image_id, active, created_at, updated_at)
        VALUES (
          user_id_val,
          COALESCE(user_name_val, 'User ' || user_id_val::TEXT),
          user_image_id_val,
          true,
          now(),
          now()
        )
        RETURNING id INTO instructor_id_val;
        
        RAISE NOTICE 'Created instructor % for user % (from scheduler)', instructor_id_val, user_id_val;
      ELSE
        RAISE NOTICE 'Using existing instructor % for user % (from scheduler)', instructor_id_val, user_id_val;
      END IF;

      -- Update scheduler time slots to point to the instructor
      UPDATE public.scheduler_week_days_time_slot
      SET instructor_id = instructor_id_val
      WHERE instructor_id = lesson_instructor_id
        AND NOT EXISTS (SELECT 1 FROM public.instructors WHERE id = lesson_instructor_id);
        
      RAISE NOTICE 'Updated scheduler time slots: instructor_id % -> %', lesson_instructor_id, instructor_id_val;
    END IF;
    END LOOP;

    -- Clean up any remaining invalid references in scheduler_week_days_time_slot
    UPDATE public.scheduler_week_days_time_slot s
    SET instructor_id = NULL
    WHERE s.instructor_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.instructors WHERE id = s.instructor_id)
      AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = s.instructor_id);
  END IF;
END $$;

-- Verify the fix
DO $$
DECLARE
  tables_exist BOOLEAN;
  total_lessons INTEGER;
  lessons_with_instructor INTEGER;
  valid_instructor_refs INTEGER;
  invalid_instructor_refs INTEGER;
  total_slots INTEGER;
  slots_with_instructor INTEGER;
  valid_slot_refs INTEGER;
  invalid_slot_refs INTEGER;
BEGIN
  -- Check if tables exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'lessons'
  ) INTO tables_exist;

  IF NOT tables_exist THEN
    RAISE NOTICE 'Tables do not exist yet. Skipping verification.';
    RETURN;
  END IF;

  -- Verify lessons table
  SELECT 
    COUNT(*),
    COUNT(CASE WHEN l.instructor_id IS NOT NULL THEN 1 END),
    COUNT(CASE WHEN l.instructor_id IS NOT NULL 
      AND EXISTS (SELECT 1 FROM public.instructors WHERE id = l.instructor_id) 
      THEN 1 END),
    COUNT(CASE WHEN l.instructor_id IS NOT NULL 
      AND NOT EXISTS (SELECT 1 FROM public.instructors WHERE id = l.instructor_id) 
      THEN 1 END)
  INTO total_lessons, lessons_with_instructor, valid_instructor_refs, invalid_instructor_refs
  FROM public.lessons l;
  
  RAISE NOTICE 'Lessons table:';
  RAISE NOTICE '  Total: %', total_lessons;
  RAISE NOTICE '  With instructor: %', lessons_with_instructor;
  RAISE NOTICE '  Valid refs: %', valid_instructor_refs;
  RAISE NOTICE '  Invalid refs: %', invalid_instructor_refs;
  
  -- Verify scheduler_week_days_time_slot table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scheduler_week_days_time_slot') THEN
    SELECT 
      COUNT(*),
      COUNT(CASE WHEN s.instructor_id IS NOT NULL THEN 1 END),
      COUNT(CASE WHEN s.instructor_id IS NOT NULL 
        AND EXISTS (SELECT 1 FROM public.instructors WHERE id = s.instructor_id) 
        THEN 1 END),
      COUNT(CASE WHEN s.instructor_id IS NOT NULL 
        AND NOT EXISTS (SELECT 1 FROM public.instructors WHERE id = s.instructor_id) 
        THEN 1 END)
    INTO total_slots, slots_with_instructor, valid_slot_refs, invalid_slot_refs
    FROM public.scheduler_week_days_time_slot s;
    
    RAISE NOTICE 'Scheduler time slots:';
    RAISE NOTICE '  Total: %', total_slots;
    RAISE NOTICE '  With instructor: %', slots_with_instructor;
    RAISE NOTICE '  Valid refs: %', valid_slot_refs;
    RAISE NOTICE '  Invalid refs: %', invalid_slot_refs;
  END IF;

  RAISE NOTICE 'Migration complete!';
  RAISE NOTICE 'Total lessons: %', total_lessons;
  RAISE NOTICE 'Lessons with instructor: %', lessons_with_instructor;
  RAISE NOTICE 'Valid instructor refs: %', valid_instructor_refs;
  RAISE NOTICE 'Invalid instructor refs: %', invalid_instructor_refs;
  RAISE NOTICE 'You can now start the dev server.';
END $$;


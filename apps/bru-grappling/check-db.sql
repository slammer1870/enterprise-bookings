-- Quick script to check if tables exist
-- Run: psql "${DATABASE_URI:-postgres://postgres:brugrappling@localhost:5432/bru_grappling}" -f check-db.sql

SELECT 
  table_schema,
  table_name,
  CASE 
    WHEN table_name IN ('lessons', 'instructors', 'users') THEN '✓'
    ELSE ''
  END as relevant
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('lessons', 'instructors', 'users', 'accounts', 'sessions')
ORDER BY table_name;

-- Check for orphaned instructor_ids
SELECT 
  COUNT(*) as total_lessons,
  COUNT(CASE WHEN instructor_id IS NOT NULL THEN 1 END) as lessons_with_instructor,
  COUNT(CASE WHEN instructor_id IS NOT NULL 
    AND EXISTS (SELECT 1 FROM instructors WHERE id = lessons.instructor_id) 
    THEN 1 END) as valid_refs,
  COUNT(CASE WHEN instructor_id IS NOT NULL 
    AND NOT EXISTS (SELECT 1 FROM instructors WHERE id = lessons.instructor_id)
    AND EXISTS (SELECT 1 FROM users WHERE id = lessons.instructor_id)
    THEN 1 END) as orphaned_user_refs
FROM lessons;



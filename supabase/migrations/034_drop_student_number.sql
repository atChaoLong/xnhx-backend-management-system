ALTER TABLE public.students
  DROP COLUMN IF EXISTS student_number;

DROP INDEX IF EXISTS idx_students_student_number;


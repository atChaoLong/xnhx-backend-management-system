-- Backfill historical trial_lessons.student_id links.
-- Prefer authoritative formal order links, then low-risk unique student contact matches.

WITH order_trial_student AS (
  SELECT
    trial_lesson_id,
    MIN(student_id::text)::uuid AS student_id
  FROM public.formal_orders
  WHERE trial_lesson_id IS NOT NULL
    AND student_id IS NOT NULL
  GROUP BY trial_lesson_id
  HAVING COUNT(DISTINCT student_id) = 1
)
UPDATE public.trial_lessons AS tl
SET student_id = ots.student_id
FROM order_trial_student AS ots
WHERE tl.id = ots.trial_lesson_id
  AND tl.student_id IS NULL;

WITH normalized_students AS (
  SELECT
    id,
    lower(trim(student_name)) AS student_name_key,
    nullif(regexp_replace(trim(parent_phone), '[[:space:]-]+', '', 'g'), '') AS contact_key
  FROM public.students
  WHERE parent_phone IS NOT NULL
    AND trim(parent_phone) <> ''
),
unique_contact_name_students AS (
  SELECT
    contact_key,
    student_name_key,
    MIN(id::text)::uuid AS student_id
  FROM normalized_students
  WHERE contact_key IS NOT NULL
    AND student_name_key IS NOT NULL
    AND student_name_key <> ''
  GROUP BY contact_key, student_name_key
  HAVING COUNT(DISTINCT id) = 1
),
normalized_trials AS (
  SELECT
    id,
    lower(trim(child_name)) AS child_name_key,
    nullif(regexp_replace(trim(phone), '[[:space:]-]+', '', 'g'), '') AS contact_key
  FROM public.trial_lessons
  WHERE student_id IS NULL
    AND phone IS NOT NULL
    AND trim(phone) <> ''
)
UPDATE public.trial_lessons AS tl
SET student_id = ucns.student_id
FROM normalized_trials AS nt
JOIN unique_contact_name_students AS ucns
  ON ucns.contact_key = nt.contact_key
 AND ucns.student_name_key = nt.child_name_key
WHERE tl.id = nt.id
  AND tl.student_id IS NULL;

WITH normalized_students AS (
  SELECT
    id,
    nullif(regexp_replace(trim(parent_phone), '[[:space:]-]+', '', 'g'), '') AS contact_key
  FROM public.students
  WHERE parent_phone IS NOT NULL
    AND trim(parent_phone) <> ''
),
unique_contact_students AS (
  SELECT
    contact_key,
    MIN(id::text)::uuid AS student_id
  FROM normalized_students
  WHERE contact_key IS NOT NULL
  GROUP BY contact_key
  HAVING COUNT(DISTINCT id) = 1
),
normalized_trials AS (
  SELECT
    id,
    nullif(regexp_replace(trim(phone), '[[:space:]-]+', '', 'g'), '') AS contact_key
  FROM public.trial_lessons
  WHERE student_id IS NULL
    AND phone IS NOT NULL
    AND trim(phone) <> ''
)
UPDATE public.trial_lessons AS tl
SET student_id = ucs.student_id
FROM normalized_trials AS nt
JOIN unique_contact_students AS ucs
  ON ucs.contact_key = nt.contact_key
WHERE tl.id = nt.id
  AND tl.student_id IS NULL;

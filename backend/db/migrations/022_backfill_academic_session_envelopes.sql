-- =============================================================================
-- Migration 022: Deterministic Historical Envelope Backfill
-- Target Database: mcceorgn_main / aacasorg_main
-- Idempotent, safe, zero-data-loss execution
-- Backfills:
--   1. students.entry_session_id
--   2. course_registrations.entry_session_id & course_registrations.academic_session_id
--   3. result_batches.cohort_session_id & result_batches.academic_session_id
-- =============================================================================

-- Step 1: Ensure canonical academic sessions exist in academic_sessions table
INSERT IGNORE INTO `academic_sessions` (`id`, `name`, `start_date`, `end_date`, `is_active`, `created_at`)
VALUES
  (UUID(), '2021/2022', '2021-10-01', '2022-09-30', 0, NOW()),
  (UUID(), '2022/2023', '2022-10-01', '2023-09-30', 0, NOW()),
  (UUID(), '2023/2024', '2023-10-01', '2024-09-30', 0, NOW()),
  (UUID(), '2024/2025', '2024-10-01', '2025-09-30', 0, NOW()),
  (UUID(), '2025/2026', '2025-10-01', '2026-09-30', 0, NOW()),
  (UUID(), '2026/2027', '2026-10-01', '2027-09-30', 1, NOW());

-- Step 2: Backfill students.entry_session_id from students.session_name
UPDATE `students` s
INNER JOIN `academic_sessions` sess ON sess.name = TRIM(s.session_name)
SET s.entry_session_id = sess.id
WHERE s.entry_session_id IS NULL OR s.entry_session_id = '';

-- Fallback for students where session_name was empty but admissions.session_id exists
UPDATE `students` s
INNER JOIN `admissions` a ON a.id = s.admission_id
INNER JOIN `academic_sessions` sess ON (sess.id = a.session_id OR sess.name = a.session_id)
SET s.entry_session_id = sess.id
WHERE (s.entry_session_id IS NULL OR s.entry_session_id = '')
  AND a.session_id IS NOT NULL AND a.session_id != '';

-- Step 3: Backfill course_registrations.entry_session_id from students.entry_session_id
UPDATE `course_registrations` cr
INNER JOIN `students` s ON s.id = cr.student_id
SET cr.entry_session_id = s.entry_session_id
WHERE s.entry_session_id IS NOT NULL AND s.entry_session_id != ''
  AND (cr.entry_session_id IS NULL OR cr.entry_session_id = '');

-- Fallback for cr.entry_session_id from cr.session_id if still null
UPDATE `course_registrations` cr
INNER JOIN `academic_sessions` sess ON (sess.id = cr.session_id OR sess.name = cr.session_id)
SET cr.entry_session_id = sess.id
WHERE cr.entry_session_id IS NULL OR cr.entry_session_id = '';

-- Step 4: Backfill course_registrations.academic_session_id
-- We map Contact 1..6 based on (Entry Cohort, Entry Mode, Contact Level)

-- 4A. Fresh students (admitted 2021/2022)
-- Contact 1 -> 2021/2022
UPDATE `course_registrations` cr
INNER JOIN `students` s ON s.id = cr.student_id
INNER JOIN `academic_sessions` sess_entry ON sess_entry.id = cr.entry_session_id AND sess_entry.name = '2021/2022'
INNER JOIN `academic_sessions` sess_target ON sess_target.name = '2021/2022'
SET cr.academic_session_id = sess_target.id
WHERE (s.entry_mode IS NULL OR (s.entry_mode NOT LIKE '%Direct%' AND s.entry_mode != 'de'))
  AND (cr.level = 'Contact 1' OR cr.level = '1' OR cr.level = '100 Level')
  AND (cr.academic_session_id IS NULL OR cr.academic_session_id = '');

-- Contact 2 -> 2022/2023 (Fresh)
UPDATE `course_registrations` cr
INNER JOIN `students` s ON s.id = cr.student_id
INNER JOIN `academic_sessions` sess_entry ON sess_entry.id = cr.entry_session_id AND sess_entry.name = '2021/2022'
INNER JOIN `academic_sessions` sess_target ON sess_target.name = '2022/2023'
SET cr.academic_session_id = sess_target.id
WHERE (s.entry_mode IS NULL OR (s.entry_mode NOT LIKE '%Direct%' AND s.entry_mode != 'de'))
  AND (cr.level = 'Contact 2' OR cr.level = '2' OR cr.level = '200 Level')
  AND (cr.academic_session_id IS NULL OR cr.academic_session_id = '');

-- Contact 3 -> 2023/2024 (Fresh)
UPDATE `course_registrations` cr
INNER JOIN `students` s ON s.id = cr.student_id
INNER JOIN `academic_sessions` sess_entry ON sess_entry.id = cr.entry_session_id AND sess_entry.name = '2021/2022'
INNER JOIN `academic_sessions` sess_target ON sess_target.name = '2023/2024'
SET cr.academic_session_id = sess_target.id
WHERE (s.entry_mode IS NULL OR (s.entry_mode NOT LIKE '%Direct%' AND s.entry_mode != 'de'))
  AND (cr.level = 'Contact 3' OR cr.level = '3' OR cr.level = '300 Level')
  AND (cr.academic_session_id IS NULL OR cr.academic_session_id = '');

-- Contact 4 -> 2024/2025 (Fresh)
UPDATE `course_registrations` cr
INNER JOIN `students` s ON s.id = cr.student_id
INNER JOIN `academic_sessions` sess_entry ON sess_entry.id = cr.entry_session_id AND sess_entry.name = '2021/2022'
INNER JOIN `academic_sessions` sess_target ON sess_target.name = '2024/2025'
SET cr.academic_session_id = sess_target.id
WHERE (s.entry_mode IS NULL OR (s.entry_mode NOT LIKE '%Direct%' AND s.entry_mode != 'de'))
  AND (cr.level = 'Contact 4' OR cr.level = '4' OR cr.level = '400 Level')
  AND (cr.academic_session_id IS NULL OR cr.academic_session_id = '');

-- Contact 5 -> 2025/2026 (Fresh)
UPDATE `course_registrations` cr
INNER JOIN `students` s ON s.id = cr.student_id
INNER JOIN `academic_sessions` sess_entry ON sess_entry.id = cr.entry_session_id AND sess_entry.name = '2021/2022'
INNER JOIN `academic_sessions` sess_target ON sess_target.name = '2025/2026'
SET cr.academic_session_id = sess_target.id
WHERE (s.entry_mode IS NULL OR (s.entry_mode NOT LIKE '%Direct%' AND s.entry_mode != 'de'))
  AND (cr.level = 'Contact 5' OR cr.level = '5')
  AND (cr.academic_session_id IS NULL OR cr.academic_session_id = '');

-- Contact 6 -> 2026/2027 (Fresh)
UPDATE `course_registrations` cr
INNER JOIN `students` s ON s.id = cr.student_id
INNER JOIN `academic_sessions` sess_entry ON sess_entry.id = cr.entry_session_id AND sess_entry.name = '2021/2022'
INNER JOIN `academic_sessions` sess_target ON sess_target.name = '2026/2027'
SET cr.academic_session_id = sess_target.id
WHERE (s.entry_mode IS NULL OR (s.entry_mode NOT LIKE '%Direct%' AND s.entry_mode != 'de'))
  AND (cr.level = 'Contact 6' OR cr.level = '6')
  AND (cr.academic_session_id IS NULL OR cr.academic_session_id = '');

-- 4B. Direct Entry students (admitted 2021/2022 into Contact 2)
-- Contact 2 -> 2021/2022 (DE)
UPDATE `course_registrations` cr
INNER JOIN `students` s ON s.id = cr.student_id
INNER JOIN `academic_sessions` sess_entry ON sess_entry.id = cr.entry_session_id AND sess_entry.name = '2021/2022'
INNER JOIN `academic_sessions` sess_target ON sess_target.name = '2021/2022'
SET cr.academic_session_id = sess_target.id
WHERE (s.entry_mode LIKE '%Direct%' OR s.entry_mode = 'de')
  AND (cr.level = 'Contact 2' OR cr.level = '2' OR cr.level = '200 Level')
  AND (cr.academic_session_id IS NULL OR cr.academic_session_id = '');

-- Contact 3 -> 2022/2023 (DE)
UPDATE `course_registrations` cr
INNER JOIN `students` s ON s.id = cr.student_id
INNER JOIN `academic_sessions` sess_entry ON sess_entry.id = cr.entry_session_id AND sess_entry.name = '2021/2022'
INNER JOIN `academic_sessions` sess_target ON sess_target.name = '2022/2023'
SET cr.academic_session_id = sess_target.id
WHERE (s.entry_mode LIKE '%Direct%' OR s.entry_mode = 'de')
  AND (cr.level = 'Contact 3' OR cr.level = '3' OR cr.level = '300 Level')
  AND (cr.academic_session_id IS NULL OR cr.academic_session_id = '');

-- Contact 4 -> 2023/2024 (DE)
UPDATE `course_registrations` cr
INNER JOIN `students` s ON s.id = cr.student_id
INNER JOIN `academic_sessions` sess_entry ON sess_entry.id = cr.entry_session_id AND sess_entry.name = '2021/2022'
INNER JOIN `academic_sessions` sess_target ON sess_target.name = '2023/2024'
SET cr.academic_session_id = sess_target.id
WHERE (s.entry_mode LIKE '%Direct%' OR s.entry_mode = 'de')
  AND (cr.level = 'Contact 4' OR cr.level = '4' OR cr.level = '400 Level')
  AND (cr.academic_session_id IS NULL OR cr.academic_session_id = '');

-- Contact 5 -> 2024/2025 (DE)
UPDATE `course_registrations` cr
INNER JOIN `students` s ON s.id = cr.student_id
INNER JOIN `academic_sessions` sess_entry ON sess_entry.id = cr.entry_session_id AND sess_entry.name = '2021/2022'
INNER JOIN `academic_sessions` sess_target ON sess_target.name = '2024/2025'
SET cr.academic_session_id = sess_target.id
WHERE (s.entry_mode LIKE '%Direct%' OR s.entry_mode = 'de')
  AND (cr.level = 'Contact 5' OR cr.level = '5')
  AND (cr.academic_session_id IS NULL OR cr.academic_session_id = '');

-- Contact 6 -> 2025/2026 (DE)
UPDATE `course_registrations` cr
INNER JOIN `students` s ON s.id = cr.student_id
INNER JOIN `academic_sessions` sess_entry ON sess_entry.id = cr.entry_session_id AND sess_entry.name = '2021/2022'
INNER JOIN `academic_sessions` sess_target ON sess_target.name = '2025/2026'
SET cr.academic_session_id = sess_target.id
WHERE (s.entry_mode LIKE '%Direct%' OR s.entry_mode = 'de')
  AND (cr.level = 'Contact 6' OR cr.level = '6')
  AND (cr.academic_session_id IS NULL OR cr.academic_session_id = '');

-- Fallback for any other registrations: if academic_session_id is still NULL, fallback to cr.session_id
UPDATE `course_registrations` cr
SET cr.academic_session_id = cr.session_id
WHERE cr.academic_session_id IS NULL OR cr.academic_session_id = '';

-- Step 5: Backfill result_batches
-- 5A. Backfill cohort_session_id from current session_id (which held the cohort)
UPDATE `result_batches` rb
SET rb.cohort_session_id = rb.session_id
WHERE rb.cohort_session_id IS NULL OR rb.cohort_session_id = '';

-- 5B. Backfill academic_session_id on result_batches by correlating with registered students' academic_session_id
UPDATE `result_batches` rb
INNER JOIN (
    SELECT cri.course_id, cr.semester_id, cr.academic_session_id
    FROM course_registrations cr
    JOIN course_registration_items cri ON cri.registration_id = cr.id
    WHERE cr.academic_session_id IS NOT NULL AND cr.academic_session_id != ''
    GROUP BY cri.course_id, cr.semester_id, cr.academic_session_id
) reg_match ON reg_match.course_id = rb.course_id AND reg_match.semester_id = rb.semester_id
SET rb.academic_session_id = reg_match.academic_session_id
WHERE rb.academic_session_id IS NULL OR rb.academic_session_id = '';

-- Fallback for any standalone result batches: fallback to session_id
UPDATE `result_batches` rb
SET rb.academic_session_id = rb.session_id
WHERE rb.academic_session_id IS NULL OR rb.academic_session_id = '';


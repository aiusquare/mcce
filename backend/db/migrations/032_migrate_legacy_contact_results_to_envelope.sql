-- =============================================================================
-- Migration 032: Migrate Legacy Result Sheets to Academic Session Envelope
-- Target Database: mcceorgn_main / aacasorg_main (MySQL 5.7+ / MariaDB 10.3+)
-- Safe, additive, deterministic, and 100% backward-compatible
--
-- This script migrates all result sheets (result_batches) and their score attempts
-- from the legacy "all Contacts under entry cohort 2021/2022" structure into the
-- canonical chronological Academic Session Envelope order:
--
--   * Contact 1 -> Academic Session 2021/2022
--   * Contact 2 -> Academic Session 2022/2023 (Fresh) / 2021/2022 (Direct Entry)
--   * Contact 3 -> Academic Session 2023/2024
--   * Contact 4 -> Academic Session 2024/2025
--   * Contact 5 -> Academic Session 2025/2026
--   * Contact 6 -> Academic Session 2026/2027
--
-- Legacy columns (`session_id`) remain 100% untouched for backward compatibility.
-- =============================================================================

START TRANSACTION;

-- -----------------------------------------------------------------------------
-- Step 1: Ensure canonical academic sessions exist in academic_sessions table
-- -----------------------------------------------------------------------------
INSERT INTO `academic_sessions` (`id`, `name`, `start_date`, `end_date`, `is_active`, `created_at`)
SELECT UUID(), '2021/2022', '2021-10-01', '2022-09-30', 0, NOW()
WHERE NOT EXISTS (SELECT 1 FROM `academic_sessions` WHERE name = '2021/2022');

INSERT INTO `academic_sessions` (`id`, `name`, `start_date`, `end_date`, `is_active`, `created_at`)
SELECT UUID(), '2022/2023', '2022-10-01', '2023-09-30', 0, NOW()
WHERE NOT EXISTS (SELECT 1 FROM `academic_sessions` WHERE name = '2022/2023');

INSERT INTO `academic_sessions` (`id`, `name`, `start_date`, `end_date`, `is_active`, `created_at`)
SELECT UUID(), '2023/2024', '2023-10-01', '2024-09-30', 0, NOW()
WHERE NOT EXISTS (SELECT 1 FROM `academic_sessions` WHERE name = '2023/2024');

INSERT INTO `academic_sessions` (`id`, `name`, `start_date`, `end_date`, `is_active`, `created_at`)
SELECT UUID(), '2024/2025', '2024-10-01', '2025-09-30', 0, NOW()
WHERE NOT EXISTS (SELECT 1 FROM `academic_sessions` WHERE name = '2024/2025');

INSERT INTO `academic_sessions` (`id`, `name`, `start_date`, `end_date`, `is_active`, `created_at`)
SELECT UUID(), '2025/2026', '2025-10-01', '2026-09-30', 0, NOW()
WHERE NOT EXISTS (SELECT 1 FROM `academic_sessions` WHERE name = '2025/2026');

INSERT INTO `academic_sessions` (`id`, `name`, `start_date`, `end_date`, `is_active`, `created_at`)
SELECT UUID(), '2026/2027', '2026-10-01', '2027-09-30', 1, NOW()
WHERE NOT EXISTS (SELECT 1 FROM `academic_sessions` WHERE name = '2026/2027');

-- -----------------------------------------------------------------------------
-- Step 2: Establish lookup table of canonical session UUIDs by year
-- -----------------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_envelope_sessions;
CREATE TEMPORARY TABLE tmp_envelope_sessions AS
SELECT
    CAST(SUBSTRING(name, 1, 4) AS UNSIGNED) AS start_year,
    MIN(id) AS id,
    MIN(name) AS name
FROM academic_sessions
WHERE name REGEXP '^[0-9]{4}/[0-9]{4}$'
GROUP BY CAST(SUBSTRING(name, 1, 4) AS UNSIGNED);

-- -----------------------------------------------------------------------------
-- Step 3: Preserve student entry cohorts on result_batches
-- In the legacy system, rb.session_id recorded the target student entry cohort.
-- -----------------------------------------------------------------------------
UPDATE result_batches rb
JOIN academic_sessions cohort
  ON cohort.id = rb.session_id OR cohort.name = TRIM(rb.session_id)
SET rb.cohort_session_id = cohort.id
WHERE rb.cohort_session_id IS NULL OR rb.cohort_session_id = '';

-- Fallback for any rb where session_id didn't match academic_sessions by name/id:
UPDATE result_batches
SET cohort_session_id = (SELECT id FROM academic_sessions WHERE name = '2021/2022' LIMIT 1)
WHERE cohort_session_id IS NULL OR cohort_session_id = '';

-- -----------------------------------------------------------------------------
-- Step 4: Resolve and store contact_number on all result_batches
-- -----------------------------------------------------------------------------
UPDATE result_batches rb
LEFT JOIN semesters sem ON sem.id = rb.semester_id OR sem.name = rb.semester_id
SET rb.contact_number = CASE
    WHEN LOWER(CONCAT_WS(' ', sem.name, rb.semester_id, rb.level)) REGEXP 'contact[[:space:]]*1'
      OR rb.level IN ('1', '100', '100 Level') THEN 1
    WHEN LOWER(CONCAT_WS(' ', sem.name, rb.semester_id, rb.level)) REGEXP 'contact[[:space:]]*2'
      OR rb.level IN ('2', '200', '200 Level') THEN 2
    WHEN LOWER(CONCAT_WS(' ', sem.name, rb.semester_id, rb.level)) REGEXP 'contact[[:space:]]*3'
      OR rb.level IN ('3', '300', '300 Level') THEN 3
    WHEN LOWER(CONCAT_WS(' ', sem.name, rb.semester_id, rb.level)) REGEXP 'contact[[:space:]]*4'
      OR rb.level IN ('4', '400', '400 Level') THEN 4
    WHEN LOWER(CONCAT_WS(' ', sem.name, rb.semester_id, rb.level)) REGEXP 'contact[[:space:]]*5'
      OR rb.level IN ('5', '500', '500 Level') THEN 5
    WHEN LOWER(CONCAT_WS(' ', sem.name, rb.semester_id, rb.level)) REGEXP 'contact[[:space:]]*6'
      OR rb.level IN ('6', '600', '600 Level') THEN 6
    ELSE rb.contact_number
END
WHERE rb.contact_number IS NULL OR rb.contact_number = 0;

-- -----------------------------------------------------------------------------
-- Step 5: Resolve student registration evidence
-- Link batches to course_registrations where registered students exist.
-- -----------------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_registration_batch_match;
CREATE TEMPORARY TABLE tmp_registration_batch_match AS
SELECT
    rb.id AS result_batch_id,
    cr.academic_session_id,
    COUNT(DISTINCT cr.student_id) AS student_count
FROM result_batches rb
JOIN course_registration_items cri ON cri.course_id = rb.course_id
JOIN course_registrations cr ON cr.id = cri.registration_id
JOIN students s ON s.id = cr.student_id
WHERE cr.academic_session_id IS NOT NULL 
  AND cr.academic_session_id <> ''
  AND cr.status IN ('approved', 'submitted')
  AND (
      cr.semester_id = rb.semester_id 
      OR cr.level = rb.level 
      OR (rb.contact_number IS NOT NULL AND LOWER(CONCAT_WS(' ', cr.semester_id, cr.level)) REGEXP CONCAT('contact[[:space:]]*', rb.contact_number))
  )
GROUP BY rb.id, cr.academic_session_id;

-- Rank evidence to pick the majority session if a batch has both Fresh and DE
DROP TEMPORARY TABLE IF EXISTS tmp_ranked_batch_evidence;
CREATE TEMPORARY TABLE tmp_ranked_batch_evidence AS
SELECT
    m.result_batch_id,
    MIN(m.academic_session_id) AS academic_session_id,
    MAX(m.student_count) AS student_count
FROM tmp_registration_batch_match m
INNER JOIN (
    SELECT result_batch_id, MAX(student_count) AS max_students
    FROM tmp_registration_batch_match
    GROUP BY result_batch_id
) top ON top.result_batch_id = m.result_batch_id AND top.max_students = m.student_count
GROUP BY m.result_batch_id;

-- Apply majority registration evidence
UPDATE result_batches rb
JOIN tmp_ranked_batch_evidence ev ON ev.result_batch_id = rb.id
SET rb.academic_session_id = ev.academic_session_id
WHERE rb.academic_session_id IS NULL 
   OR rb.academic_session_id = ''
   OR rb.academic_session_id = rb.session_id;

-- -----------------------------------------------------------------------------
-- Step 6: Canonical Academic Session Mapping for all remaining batches
-- Maps every remaining batch (including empty batches and batches without attempts)
-- based on its Contact / Level according to the institutional academic schedule:
--
--   * Contact 1 / 100 Level -> 2021/2022
--   * Contact 2 / 200 Level -> 2022/2023
--   * Contact 3 / 300 Level -> 2023/2024
--   * Contact 4 / 400 Level -> 2024/2025
--   * Contact 5 / 500 Level -> 2025/2026
--   * Contact 6 / 600 Level -> 2026/2027
-- -----------------------------------------------------------------------------

-- Contact 1 -> 2021/2022
UPDATE result_batches
SET academic_session_id = (SELECT id FROM academic_sessions WHERE name = '2021/2022' LIMIT 1)
WHERE (contact_number = 1 OR level IN ('1', '100', '100 Level'))
  AND (academic_session_id IS NULL OR academic_session_id = '');

-- Contact 2 -> 2022/2023
UPDATE result_batches
SET academic_session_id = (SELECT id FROM academic_sessions WHERE name = '2022/2023' LIMIT 1)
WHERE (contact_number = 2 OR level IN ('2', '200', '200 Level'))
  AND (academic_session_id IS NULL OR academic_session_id = '');

-- Contact 3 -> 2023/2024
UPDATE result_batches
SET academic_session_id = (SELECT id FROM academic_sessions WHERE name = '2023/2024' LIMIT 1)
WHERE (contact_number = 3 OR level IN ('3', '300', '300 Level'))
  AND (academic_session_id IS NULL OR academic_session_id = '');

-- Contact 4 -> 2024/2025
UPDATE result_batches
SET academic_session_id = (SELECT id FROM academic_sessions WHERE name = '2024/2025' LIMIT 1)
WHERE (contact_number = 4 OR level IN ('4', '400', '400 Level'))
  AND (academic_session_id IS NULL OR academic_session_id = '');

-- Contact 5 -> 2025/2026
UPDATE result_batches
SET academic_session_id = (SELECT id FROM academic_sessions WHERE name = '2025/2026' LIMIT 1)
WHERE (contact_number = 5 OR level IN ('5', '500', '500 Level'))
  AND (academic_session_id IS NULL OR academic_session_id = '');

-- Contact 6 -> 2026/2027
UPDATE result_batches
SET academic_session_id = (SELECT id FROM academic_sessions WHERE name = '2026/2027' LIMIT 1)
WHERE (contact_number = 6 OR level IN ('6', '600', '600 Level'))
  AND (academic_session_id IS NULL OR academic_session_id = '');

-- Final safety fallback: for any batches with no contact number or level, fallback to cohort session
UPDATE result_batches
SET academic_session_id = cohort_session_id
WHERE academic_session_id IS NULL OR academic_session_id = '';

-- -----------------------------------------------------------------------------
-- Step 7: Synchronize contact_number on all result_attempts
-- Ensures that individual attempts remember their progression contact snapshot.
-- -----------------------------------------------------------------------------
UPDATE result_attempts ra
JOIN result_batches rb ON rb.id = ra.batch_id
SET ra.contact_number = rb.contact_number
WHERE (ra.contact_number IS NULL OR ra.contact_number = 0)
  AND rb.contact_number IS NOT NULL;

COMMIT;

-- =============================================================================
-- Verification Outputs
-- =============================================================================

-- Verification 1: Summary of Result Batches by Academic Session & Contact
SELECT
    COALESCE(sess_acad.name, 'UNMAPPED') AS academic_session,
    COALESCE(sess_cohort.name, 'UNMAPPED') AS entry_cohort,
    rb.contact_number AS contact,
    COUNT(DISTINCT rb.id) AS total_batches,
    COUNT(DISTINCT ra.id) AS total_attempts,
    SUM(CASE WHEN ra.total_score IS NOT NULL OR COALESCE(ra.grade, '') NOT IN ('', '-', 'NR') THEN 1 ELSE 0 END) AS scored_attempts
FROM result_batches rb
LEFT JOIN academic_sessions sess_acad ON sess_acad.id = rb.academic_session_id
LEFT JOIN academic_sessions sess_cohort ON sess_cohort.id = rb.cohort_session_id
LEFT JOIN result_attempts ra ON ra.batch_id = rb.id
GROUP BY sess_acad.name, sess_cohort.name, rb.contact_number
ORDER BY sess_acad.name, rb.contact_number;

-- Verification 2: Check for any remaining unmapped batches (Must be 0)
SELECT 
    COUNT(*) AS unmapped_batches_count
FROM result_batches
WHERE academic_session_id IS NULL OR academic_session_id = '';

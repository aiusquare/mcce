-- Contact-programme academic-session normalisation
--
-- Run this ONCE in phpMyAdmin after taking a database backup.
--
-- Policy encoded here (the school begins in 2021/2022):
--   Fresh:        Contact 1 in entry year, then one contact per later session.
--   Direct Entry: Contact 2 in entry year, then one contact per later session.
--
-- Examples:
--   2021/2022: Fresh C1, DE C2
--   2022/2023: Fresh C2, DE C3
--   2025/2026: Fresh C5, DE C6
--
-- This script deliberately corrects existing, conflicting canonical values.
-- It does not change legacy session_id values, delete data, or invent a
-- result-batch session when its enrolled students imply more than one session.

START TRANSACTION;

-- A session name must use YYYY/YYYY+1 and have one canonical row.
CREATE TEMPORARY TABLE tmp_normalize_sessions AS
SELECT
    CAST(SUBSTRING(name, 1, 4) AS UNSIGNED) AS start_year,
    MIN(id) AS id,
    MIN(name) AS name
FROM academic_sessions
WHERE name REGEXP '^[0-9]{4}/[0-9]{4}$'
GROUP BY CAST(SUBSTRING(name, 1, 4) AS UNSIGNED)
HAVING COUNT(*) = 1;

-- 1. Complete missing immutable student entry-cohort references from the
-- legacy entry-session name. Existing valid values are intentionally retained.
UPDATE students s
JOIN academic_sessions entry_session ON entry_session.name = TRIM(s.session_name)
SET s.entry_session_id = entry_session.id
WHERE (s.entry_session_id IS NULL OR s.entry_session_id = '');

-- 2. Create one deterministic expected teaching-session mapping per course
-- registration. Contact is read from the real semester name first, then from
-- stored level/semester fallback labels.
CREATE TEMPORARY TABLE tmp_normalize_registrations AS
SELECT
    source.registration_id,
    source.entry_session_id,
    target_session.id AS expected_academic_session_id,
    source.contact_number,
    source.entry_route
FROM (
    SELECT
        cr.id AS registration_id,
        s.entry_session_id,
        CAST(SUBSTRING(entry_session.name, 1, 4) AS UNSIGNED) AS entry_year,
        CASE
            WHEN LOWER(COALESCE(s.entry_mode, '')) LIKE '%direct%'
              OR LOWER(COALESCE(s.entry_mode, '')) = 'de'
              OR COALESCE(ad.matric_number, '') REGEXP '[[:alpha:]]+2/[0-9]+'
                THEN 'direct_entry'
            ELSE 'fresh'
        END AS entry_route,
        CASE
            WHEN LOWER(CONCAT_WS(' ', sem.name, cr.semester_id, cr.level)) REGEXP 'contact[[:space:]]*1'
              OR cr.level IN ('1', '100', '100 Level') THEN 1
            WHEN LOWER(CONCAT_WS(' ', sem.name, cr.semester_id, cr.level)) REGEXP 'contact[[:space:]]*2'
              OR cr.level IN ('2', '200', '200 Level') THEN 2
            WHEN LOWER(CONCAT_WS(' ', sem.name, cr.semester_id, cr.level)) REGEXP 'contact[[:space:]]*3'
              OR cr.level IN ('3', '300', '300 Level') THEN 3
            WHEN LOWER(CONCAT_WS(' ', sem.name, cr.semester_id, cr.level)) REGEXP 'contact[[:space:]]*4'
              OR cr.level IN ('4', '400', '400 Level') THEN 4
            WHEN LOWER(CONCAT_WS(' ', sem.name, cr.semester_id, cr.level)) REGEXP 'contact[[:space:]]*5'
              OR cr.level IN ('5', '500', '500 Level') THEN 5
            WHEN LOWER(CONCAT_WS(' ', sem.name, cr.semester_id, cr.level)) REGEXP 'contact[[:space:]]*6'
              OR cr.level IN ('6', '600', '600 Level') THEN 6
            ELSE NULL
        END AS contact_number,
        CASE
            WHEN LOWER(COALESCE(s.entry_mode, '')) LIKE '%direct%'
              OR LOWER(COALESCE(s.entry_mode, '')) = 'de'
              OR COALESCE(ad.matric_number, '') REGEXP '[[:alpha:]]+2/[0-9]+'
                THEN 2
            ELSE 1
        END AS entry_contact
    FROM course_registrations cr
    JOIN students s ON s.id = cr.student_id
    JOIN academic_sessions entry_session ON entry_session.id = s.entry_session_id
    LEFT JOIN admissions ad ON ad.id = s.admission_id
    LEFT JOIN semesters sem ON (sem.id = cr.semester_id OR sem.name = cr.semester_id)
    WHERE entry_session.name REGEXP '^[0-9]{4}/[0-9]{4}$'
) source
JOIN tmp_normalize_sessions target_session
  ON target_session.start_year = source.entry_year + (source.contact_number - source.entry_contact)
WHERE source.contact_number BETWEEN 1 AND 6;

-- The registration envelope is authoritative for teaching session and cohort.
UPDATE course_registrations cr
JOIN tmp_normalize_registrations expected ON expected.registration_id = cr.id
SET
    cr.entry_session_id = expected.entry_session_id,
    cr.academic_session_id = expected.expected_academic_session_id
WHERE COALESCE(cr.entry_session_id, '') <> expected.entry_session_id
   OR COALESCE(cr.academic_session_id, '') <> expected.expected_academic_session_id;

-- 3. Derive each result batch from its actual students and the batch Contact.
-- A batch is updated only when all of its active result attempts agree on one
-- teaching session. Cohort is populated only when all attempts have one cohort.
CREATE TEMPORARY TABLE tmp_normalize_result_batches AS
SELECT
    source.result_batch_id,
    MIN(source.expected_academic_session_id) AS expected_academic_session_id,
    COUNT(DISTINCT source.expected_academic_session_id) AS academic_session_count,
    MIN(source.entry_session_id) AS expected_cohort_session_id,
    COUNT(DISTINCT source.entry_session_id) AS cohort_session_count
FROM (
    SELECT
        rb.id AS result_batch_id,
        s.entry_session_id,
        target_session.id AS expected_academic_session_id
    FROM result_batches rb
    JOIN result_attempts ra ON ra.batch_id = rb.id AND ra.status = 'active'
    JOIN students s ON s.id = ra.student_id
    JOIN academic_sessions entry_session ON entry_session.id = s.entry_session_id
    LEFT JOIN admissions ad ON ad.id = s.admission_id
    LEFT JOIN semesters sem ON (sem.id = rb.semester_id OR sem.name = rb.semester_id)
    JOIN tmp_normalize_sessions target_session
      ON target_session.start_year = CAST(SUBSTRING(entry_session.name, 1, 4) AS UNSIGNED) + (
          CASE
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
              ELSE NULL
          END
          - CASE
              WHEN LOWER(COALESCE(s.entry_mode, '')) LIKE '%direct%'
                OR LOWER(COALESCE(s.entry_mode, '')) = 'de'
                OR COALESCE(ad.matric_number, '') REGEXP '[[:alpha:]]+2/[0-9]+'
                  THEN 2
              ELSE 1
            END
      )
    WHERE entry_session.name REGEXP '^[0-9]{4}/[0-9]{4}$'
) source
GROUP BY source.result_batch_id;

UPDATE result_batches rb
JOIN tmp_normalize_result_batches expected ON expected.result_batch_id = rb.id
SET
    rb.academic_session_id = expected.expected_academic_session_id,
    rb.cohort_session_id = CASE
        WHEN expected.cohort_session_count = 1 THEN expected.expected_cohort_session_id
        ELSE rb.cohort_session_id
    END
WHERE expected.academic_session_count = 1
  AND (
      COALESCE(rb.academic_session_id, '') <> expected.expected_academic_session_id
      OR (
          expected.cohort_session_count = 1
          AND COALESCE(rb.cohort_session_id, '') <> expected.expected_cohort_session_id
      )
  );

COMMIT;

-- Verification report: every mapped registration should now have the expected
-- canonical academic session. `remaining_batch_conflicts` needs manual review;
-- it is intentionally not overwritten by this script.
SELECT
    entry_route,
    contact_number,
    target_session.name AS teaching_session,
    COUNT(*) AS normalized_registration_count
FROM tmp_normalize_registrations mapped
JOIN academic_sessions target_session ON target_session.id = mapped.expected_academic_session_id
GROUP BY entry_route, contact_number, target_session.name
ORDER BY target_session.name, contact_number, entry_route;

SELECT
    COUNT(*) AS remaining_registration_mismatches
FROM course_registrations cr
JOIN tmp_normalize_registrations expected ON expected.registration_id = cr.id
WHERE cr.academic_session_id <> expected.expected_academic_session_id
   OR cr.entry_session_id <> expected.entry_session_id;

SELECT
    COUNT(*) AS normalized_result_batches,
    SUM(CASE WHEN academic_session_count > 1 THEN 1 ELSE 0 END) AS remaining_batch_conflicts,
    SUM(CASE WHEN academic_session_count = 1 THEN 1 ELSE 0 END) AS unambiguous_batches
FROM tmp_normalize_result_batches;

SELECT
    rb.id AS result_batch_id,
    rb.session_id AS legacy_session_id,
    rb.academic_session_id,
    rb.cohort_session_id,
    expected.academic_session_count,
    expected.cohort_session_count
FROM result_batches rb
JOIN tmp_normalize_result_batches expected ON expected.result_batch_id = rb.id
WHERE expected.academic_session_count > 1
ORDER BY rb.id;

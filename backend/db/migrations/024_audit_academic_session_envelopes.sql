-- Academic-session envelope reconciliation audit
--
-- Run this READ-ONLY file in phpMyAdmin after
-- 023_add_academic_session_envelope_columns.sql.
--
-- It makes no schema or data changes. Save/export every result set and use
-- it to prepare a separately approved, institution-specific backfill. Do not
-- run the retired 022_backfill_academic_session_envelopes.sql: it assumes a
-- fixed set of years and can misclassify historical data.

SET @session_schema := DATABASE();

-- 1. Confirm that the envelope schema is ready. Every value should be 1.
SELECT
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @session_schema AND table_name = 'students' AND column_name = 'entry_session_id') AS students_entry_session_ready,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @session_schema AND table_name = 'course_registrations' AND column_name = 'academic_session_id') AS registrations_academic_session_ready,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @session_schema AND table_name = 'course_registrations' AND column_name = 'entry_session_id') AS registrations_entry_session_ready,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @session_schema AND table_name = 'result_batches' AND column_name = 'academic_session_id') AS batches_academic_session_ready,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @session_schema AND table_name = 'result_batches' AND column_name = 'cohort_session_id') AS batches_cohort_session_ready;

-- 2. Academic-session reference data. There must be no duplicate names and
-- at most one active session before any later integrity phase.
SELECT id, name, start_date, end_date, is_active, created_at
FROM academic_sessions
ORDER BY start_date, name, id;

SELECT name, COUNT(*) AS duplicate_count, GROUP_CONCAT(id ORDER BY id SEPARATOR ', ') AS session_ids
FROM academic_sessions
GROUP BY name
HAVING COUNT(*) > 1;

SELECT COUNT(*) AS active_session_count
FROM academic_sessions
WHERE is_active = 1;

-- 3. Student entry-cohort evidence. "unmapped" values need an approved
-- mapping; do not infer one from a level or the current active session.
SELECT
    NULLIF(TRIM(s.session_name), '') AS legacy_session_name,
    COUNT(*) AS student_count,
    SUM(CASE WHEN s.entry_session_id IS NULL OR s.entry_session_id = '' THEN 1 ELSE 0 END) AS missing_entry_session_id,
    SUM(CASE WHEN exact_name.id IS NOT NULL THEN 1 ELSE 0 END) AS exact_name_match_count
FROM students s
LEFT JOIN (
    SELECT name, MIN(id) AS id
    FROM academic_sessions
    GROUP BY name
    HAVING COUNT(*) = 1
) exact_name ON exact_name.name = TRIM(s.session_name)
GROUP BY NULLIF(TRIM(s.session_name), '')
ORDER BY student_count DESC, legacy_session_name;

SELECT s.id AS student_id, s.admission_id, s.session_name AS legacy_session_name, s.entry_session_id
FROM students s
LEFT JOIN academic_sessions by_id ON by_id.id = s.entry_session_id
WHERE (s.entry_session_id IS NOT NULL AND s.entry_session_id <> '')
  AND by_id.id IS NULL
ORDER BY s.id;

-- 4. Course-registration evidence. The legacy session column can populate
-- academic_session_id only when it is an exact canonical ID or a unique
-- canonical name. It cannot prove the student's immutable entry cohort.
SELECT
    COUNT(*) AS total_registrations,
    SUM(CASE WHEN cr.academic_session_id IS NULL OR cr.academic_session_id = '' THEN 1 ELSE 0 END) AS missing_academic_session_id,
    SUM(CASE WHEN cr.entry_session_id IS NULL OR cr.entry_session_id = '' THEN 1 ELSE 0 END) AS missing_entry_session_id,
    SUM(CASE WHEN by_id.id IS NOT NULL OR by_name.id IS NOT NULL THEN 1 ELSE 0 END) AS exact_legacy_session_match_count
FROM course_registrations cr
LEFT JOIN academic_sessions by_id ON by_id.id = cr.session_id
LEFT JOIN (
    SELECT name, MIN(id) AS id
    FROM academic_sessions
    GROUP BY name
    HAVING COUNT(*) = 1
) by_name ON by_name.name = TRIM(cr.session_id);

SELECT cr.id AS registration_id, cr.student_id, cr.session_id AS legacy_session_id, cr.academic_session_id, cr.entry_session_id
FROM course_registrations cr
LEFT JOIN academic_sessions academic_session ON academic_session.id = cr.academic_session_id
LEFT JOIN academic_sessions entry_session ON entry_session.id = cr.entry_session_id
WHERE (cr.academic_session_id IS NOT NULL AND cr.academic_session_id <> '' AND academic_session.id IS NULL)
   OR (cr.entry_session_id IS NOT NULL AND cr.entry_session_id <> '' AND entry_session.id IS NULL)
ORDER BY cr.id;

-- 5. Result-batch evidence. The legacy session can be evidence of the
-- teaching session, but it does not prove the target cohort. Review cohort
-- values manually with the registry/exams team.
SELECT
    COUNT(*) AS total_result_batches,
    SUM(CASE WHEN rb.academic_session_id IS NULL OR rb.academic_session_id = '' THEN 1 ELSE 0 END) AS missing_academic_session_id,
    SUM(CASE WHEN rb.cohort_session_id IS NULL OR rb.cohort_session_id = '' THEN 1 ELSE 0 END) AS missing_cohort_session_id,
    SUM(CASE WHEN by_id.id IS NOT NULL OR by_name.id IS NOT NULL THEN 1 ELSE 0 END) AS exact_legacy_session_match_count
FROM result_batches rb
LEFT JOIN academic_sessions by_id ON by_id.id = rb.session_id
LEFT JOIN (
    SELECT name, MIN(id) AS id
    FROM academic_sessions
    GROUP BY name
    HAVING COUNT(*) = 1
) by_name ON by_name.name = TRIM(rb.session_id);

SELECT rb.id AS result_batch_id, rb.session_id AS legacy_session_id, rb.academic_session_id, rb.cohort_session_id
FROM result_batches rb
LEFT JOIN academic_sessions academic_session ON academic_session.id = rb.academic_session_id
LEFT JOIN academic_sessions cohort_session ON cohort_session.id = rb.cohort_session_id
WHERE (rb.academic_session_id IS NOT NULL AND rb.academic_session_id <> '' AND academic_session.id IS NULL)
   OR (rb.cohort_session_id IS NOT NULL AND rb.cohort_session_id <> '' AND cohort_session.id IS NULL)
ORDER BY rb.id;

-- 6. Summary gate. Do not apply a data backfill while any value below is
-- non-zero, except missing values that have an approved manual mapping.
SELECT
    (SELECT COUNT(*) FROM academic_sessions WHERE is_active = 1) AS active_session_count,
    (SELECT COUNT(*) FROM (SELECT name FROM academic_sessions GROUP BY name HAVING COUNT(*) > 1) duplicate_names) AS duplicate_session_names,
    (SELECT COUNT(*) FROM students s LEFT JOIN academic_sessions a ON a.id = s.entry_session_id WHERE s.entry_session_id IS NOT NULL AND s.entry_session_id <> '' AND a.id IS NULL) AS orphaned_student_entry_sessions,
    (SELECT COUNT(*) FROM course_registrations cr LEFT JOIN academic_sessions a ON a.id = cr.academic_session_id WHERE cr.academic_session_id IS NOT NULL AND cr.academic_session_id <> '' AND a.id IS NULL) AS orphaned_registration_academic_sessions,
    (SELECT COUNT(*) FROM course_registrations cr LEFT JOIN academic_sessions a ON a.id = cr.entry_session_id WHERE cr.entry_session_id IS NOT NULL AND cr.entry_session_id <> '' AND a.id IS NULL) AS orphaned_registration_entry_sessions,
    (SELECT COUNT(*) FROM result_batches rb LEFT JOIN academic_sessions a ON a.id = rb.academic_session_id WHERE rb.academic_session_id IS NOT NULL AND rb.academic_session_id <> '' AND a.id IS NULL) AS orphaned_batch_academic_sessions,
    (SELECT COUNT(*) FROM result_batches rb LEFT JOIN academic_sessions a ON a.id = rb.cohort_session_id WHERE rb.cohort_session_id IS NOT NULL AND rb.cohort_session_id <> '' AND a.id IS NULL) AS orphaned_batch_cohort_sessions;

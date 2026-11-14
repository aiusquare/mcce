-- Academic-session release-readiness verification
--
-- READ ONLY. Run in phpMyAdmin after scripts 023 through 028 and after the
-- reconciliation audit has been reviewed. Save/export all result sets.
-- A PASS here is a release gate, not a substitute for a database backup.

SET @session_schema := DATABASE();

-- Schema gates. Every result should be PASS before deployment.
SELECT 'schema.students.entry_session_id' AS gate_name,
       IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @session_schema AND table_name = 'students' AND column_name = 'entry_session_id'), 'PASS', 'FAIL') AS result
UNION ALL SELECT 'schema.course_registrations.academic_session_id', IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @session_schema AND table_name = 'course_registrations' AND column_name = 'academic_session_id'), 'PASS', 'FAIL')
UNION ALL SELECT 'schema.course_registrations.entry_session_id', IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @session_schema AND table_name = 'course_registrations' AND column_name = 'entry_session_id'), 'PASS', 'FAIL')
UNION ALL SELECT 'schema.result_batches.academic_session_id', IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @session_schema AND table_name = 'result_batches' AND column_name = 'academic_session_id'), 'PASS', 'FAIL')
UNION ALL SELECT 'schema.result_batches.cohort_session_id', IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @session_schema AND table_name = 'result_batches' AND column_name = 'cohort_session_id'), 'PASS', 'FAIL')
UNION ALL SELECT 'schema.one_active_constraint', IF(EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = @session_schema AND table_name = 'academic_sessions' AND index_name = 'uq_academic_sessions_one_active'), 'PASS', 'FAIL')
UNION ALL SELECT 'schema.session_fee_settings', IF(EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = @session_schema AND table_name = 'session_fee_settings'), 'PASS', 'FAIL')
UNION ALL SELECT 'schema.session_archival', IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @session_schema AND table_name = 'academic_sessions' AND column_name = 'archived_at'), 'PASS', 'FAIL')
UNION ALL SELECT 'schema.session_audit_events', IF(EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = @session_schema AND table_name = 'academic_session_events'), 'PASS', 'FAIL');

-- Integrity gates. Every value must be zero before adding foreign keys or
-- retiring legacy reads. Missing envelope values are reported separately below
-- because they require reviewed historical reconciliation, not guesswork.
SELECT 'integrity.active_sessions_over_one' AS gate_name,
       GREATEST((SELECT COUNT(*) FROM academic_sessions WHERE is_active = 1) - 1, 0) AS failing_rows,
       IF((SELECT COUNT(*) FROM academic_sessions WHERE is_active = 1) <= 1, 'PASS', 'FAIL') AS result
UNION ALL SELECT
  'integrity.duplicate_session_names',
  (SELECT COUNT(*) FROM (SELECT name FROM academic_sessions GROUP BY name HAVING COUNT(*) > 1) AS duplicate_session_names),
  IF((SELECT COUNT(*) FROM (SELECT name FROM academic_sessions GROUP BY name HAVING COUNT(*) > 1) AS duplicate_session_names_check) = 0, 'PASS', 'FAIL')
UNION ALL SELECT 'integrity.orphaned_student_entry_sessions', COUNT(*), IF(COUNT(*) = 0, 'PASS', 'FAIL')
FROM students s LEFT JOIN academic_sessions a ON a.id = s.entry_session_id
WHERE s.entry_session_id IS NOT NULL AND s.entry_session_id <> '' AND a.id IS NULL
UNION ALL SELECT 'integrity.orphaned_registration_academic_sessions', COUNT(*), IF(COUNT(*) = 0, 'PASS', 'FAIL')
FROM course_registrations cr LEFT JOIN academic_sessions a ON a.id = cr.academic_session_id
WHERE cr.academic_session_id IS NOT NULL AND cr.academic_session_id <> '' AND a.id IS NULL
UNION ALL SELECT 'integrity.orphaned_registration_entry_sessions', COUNT(*), IF(COUNT(*) = 0, 'PASS', 'FAIL')
FROM course_registrations cr LEFT JOIN academic_sessions a ON a.id = cr.entry_session_id
WHERE cr.entry_session_id IS NOT NULL AND cr.entry_session_id <> '' AND a.id IS NULL
UNION ALL SELECT 'integrity.orphaned_batch_academic_sessions', COUNT(*), IF(COUNT(*) = 0, 'PASS', 'FAIL')
FROM result_batches rb LEFT JOIN academic_sessions a ON a.id = rb.academic_session_id
WHERE rb.academic_session_id IS NOT NULL AND rb.academic_session_id <> '' AND a.id IS NULL
UNION ALL SELECT 'integrity.orphaned_batch_cohort_sessions', COUNT(*), IF(COUNT(*) = 0, 'PASS', 'FAIL')
FROM result_batches rb LEFT JOIN academic_sessions a ON a.id = rb.cohort_session_id
WHERE rb.cohort_session_id IS NOT NULL AND rb.cohort_session_id <> '' AND a.id IS NULL
UNION ALL SELECT 'integrity.orphaned_fee_setting_sessions', COUNT(*), IF(COUNT(*) = 0, 'PASS', 'FAIL')
FROM session_fee_settings f LEFT JOIN academic_sessions a ON a.id = f.session_id
WHERE a.id IS NULL;

-- Reconciliation backlog. These counts are expected to reach zero before
-- adding FKs/NOT NULL constraints. Do not use this query to infer mappings.
SELECT
  (SELECT COUNT(*) FROM students WHERE entry_session_id IS NULL OR entry_session_id = '') AS students_missing_entry_session,
  (SELECT COUNT(*) FROM course_registrations WHERE academic_session_id IS NULL OR academic_session_id = '') AS registrations_missing_academic_session,
  (SELECT COUNT(*) FROM course_registrations WHERE entry_session_id IS NULL OR entry_session_id = '') AS registrations_missing_entry_session,
  (SELECT COUNT(*) FROM result_batches WHERE academic_session_id IS NULL OR academic_session_id = '') AS batches_missing_academic_session,
  (SELECT COUNT(*) FROM result_batches WHERE cohort_session_id IS NULL OR cohort_session_id = '') AS batches_missing_cohort_session;

-- Operational checks. Keep the results with the release evidence.
SELECT
  s.id AS active_session_id,
  s.name AS active_session_name,
  f.application_fee,
  f.acceptance_fee,
  f.status AS fee_setting_status
FROM academic_sessions s
LEFT JOIN session_fee_settings f ON f.session_id = s.id
WHERE s.is_active = 1;

SELECT session_id, event_type, actor_id, reason, created_at
FROM academic_session_events
ORDER BY created_at DESC
LIMIT 20;

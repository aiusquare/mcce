-- READ-ONLY broadsheet score-coverage audit
-- Run in phpMyAdmin after 030_normalize_contact_academic_sessions.sql.
-- It does not update or delete any data.
--
-- It identifies the precise reason a contact shows NR:
--   * no batch for a registered course;
--   * a batch exists but no active attempt for that student;
--   * an attempt exists but has no score/grade; or
--   * an attempt is attached to the wrong canonical teaching session.

-- 1. Coverage by teaching session, Contact, and entry route.
SELECT
    teaching.name AS academic_session,
    COALESCE(sem.name, cr.semester_id, cr.level) AS contact,
    CASE
        WHEN LOWER(COALESCE(s.entry_mode, '')) LIKE '%direct%'
          OR LOWER(COALESCE(s.entry_mode, '')) = 'de'
          OR COALESCE(ad.matric_number, '') REGEXP '[[:alpha:]]+2/[0-9]+'
            THEN 'Direct Entry'
        ELSE 'Fresh'
    END AS entry_route,
    COUNT(DISTINCT cr.student_id) AS registered_students,
    COUNT(DISTINCT cri.id) AS registered_course_items,
    COUNT(DISTINCT rb.id) AS matching_result_batches,
    COUNT(DISTINCT ra.id) AS active_result_attempts,
    SUM(CASE WHEN ra.total_score IS NOT NULL OR COALESCE(ra.grade, '') NOT IN ('', '-', 'NR') THEN 1 ELSE 0 END) AS scored_attempts,
    SUM(CASE WHEN ra.id IS NULL THEN 1 ELSE 0 END) AS registrations_without_attempt
FROM course_registrations cr
JOIN course_registration_items cri ON cri.registration_id = cr.id
JOIN students s ON s.id = cr.student_id
LEFT JOIN admissions ad ON ad.id = s.admission_id
LEFT JOIN academic_sessions teaching ON teaching.id = cr.academic_session_id
LEFT JOIN semesters sem ON (sem.id = cr.semester_id OR sem.name = cr.semester_id)
LEFT JOIN result_batches rb
  ON rb.course_id = cri.course_id
 AND rb.academic_session_id = cr.academic_session_id
 AND (rb.semester_id = cr.semester_id OR rb.level = cr.level)
LEFT JOIN result_attempts ra
  ON ra.batch_id = rb.id
 AND ra.student_id = cr.student_id
 AND ra.status = 'active'
WHERE cr.status IN ('approved', 'submitted')
  AND cri.status = 'active'
  AND LOWER(COALESCE(cri.registration_type, 'normal')) NOT IN ('carryover', 'repeat')
GROUP BY teaching.name, COALESCE(sem.name, cr.semester_id, cr.level), entry_route
ORDER BY teaching.name, contact, entry_route;

-- 2. First 500 registrations that cannot display a score. This is the action
-- list for result entry or result-batch correction.
SELECT
    teaching.name AS academic_session,
    COALESCE(sem.name, cr.semester_id, cr.level) AS contact,
    ad.matric_number,
    u.full_name AS student_name,
    c.code AS course_code,
    rb.id AS matching_batch_id,
    ra.id AS attempt_id,
    ra.total_score,
    ra.grade,
    CASE
        WHEN rb.id IS NULL THEN 'No result batch in this canonical session/contact'
        WHEN ra.id IS NULL THEN 'Batch exists, but student has no active attempt'
        WHEN ra.total_score IS NULL AND COALESCE(ra.grade, '') IN ('', '-', 'NR') THEN 'Attempt exists, but no score or grade entered'
        ELSE 'Review manually'
    END AS reason
FROM course_registrations cr
JOIN course_registration_items cri ON cri.registration_id = cr.id
JOIN students s ON s.id = cr.student_id
JOIN users u ON u.id = s.user_id
LEFT JOIN admissions ad ON ad.id = s.admission_id
JOIN courses c ON c.id = cri.course_id
LEFT JOIN academic_sessions teaching ON teaching.id = cr.academic_session_id
LEFT JOIN semesters sem ON (sem.id = cr.semester_id OR sem.name = cr.semester_id)
LEFT JOIN result_batches rb
  ON rb.course_id = cri.course_id
 AND rb.academic_session_id = cr.academic_session_id
 AND (rb.semester_id = cr.semester_id OR rb.level = cr.level)
LEFT JOIN result_attempts ra
  ON ra.batch_id = rb.id
 AND ra.student_id = cr.student_id
 AND ra.status = 'active'
WHERE cr.status IN ('approved', 'submitted')
  AND cri.status = 'active'
  AND LOWER(COALESCE(cri.registration_type, 'normal')) NOT IN ('carryover', 'repeat')
  AND (
      rb.id IS NULL
      OR ra.id IS NULL
      OR (ra.total_score IS NULL AND COALESCE(ra.grade, '') IN ('', '-', 'NR'))
  )
ORDER BY teaching.name, contact, c.code, ad.matric_number
LIMIT 500;

-- 3. Attempts that exist but are currently in a different canonical academic
-- session from the student's registration. These require batch review before
-- any further data update.
SELECT DISTINCT
    ad.matric_number,
    u.full_name AS student_name,
    c.code AS course_code,
    expected.name AS registration_academic_session,
    actual.name AS result_batch_academic_session,
    COALESCE(sem_cr.name, cr.semester_id, cr.level) AS registration_contact,
    COALESCE(sem_rb.name, rb.semester_id, rb.level) AS batch_contact,
    rb.id AS result_batch_id,
    ra.id AS result_attempt_id
FROM course_registrations cr
JOIN course_registration_items cri ON cri.registration_id = cr.id
JOIN students s ON s.id = cr.student_id
JOIN users u ON u.id = s.user_id
LEFT JOIN admissions ad ON ad.id = s.admission_id
JOIN courses c ON c.id = cri.course_id
JOIN result_attempts ra ON ra.student_id = cr.student_id AND ra.status = 'active'
JOIN result_batches rb ON rb.id = ra.batch_id AND rb.course_id = cri.course_id
LEFT JOIN academic_sessions expected ON expected.id = cr.academic_session_id
LEFT JOIN academic_sessions actual ON actual.id = rb.academic_session_id
LEFT JOIN semesters sem_cr ON (sem_cr.id = cr.semester_id OR sem_cr.name = cr.semester_id)
LEFT JOIN semesters sem_rb ON (sem_rb.id = rb.semester_id OR sem_rb.name = rb.semester_id)
WHERE cr.status IN ('approved', 'submitted')
  AND cri.status = 'active'
  AND cr.academic_session_id IS NOT NULL
  AND rb.academic_session_id IS NOT NULL
  AND cr.academic_session_id <> rb.academic_session_id
ORDER BY expected.name, actual.name, c.code, ad.matric_number;

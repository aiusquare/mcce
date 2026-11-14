-- READ-ONLY diagnostics for the 306 "unregistered_score" reconciliation issues
-- (PEAP, session 2021/2022, Contact 1). Nothing here modifies data.
-- Replace @prog / @sess with the real ids first:
--   SET @prog = (SELECT id FROM programmes WHERE name LIKE 'B. Ed Educational Administration%' LIMIT 1);
--   SET @sess = (SELECT id FROM academic_sessions WHERE name = '2021/2022' LIMIT 1);

-- Q1. Scored attempts in 2021/2022 batches with NO registration item for that course (any semester of that session).
--     Classifies each student: does he/she have ANY registration this session?
SELECT s.id AS student_id, u.full_name, ad.matric_number,
       s.admission_id IS NOT NULL AS has_admission,
       (SELECT COUNT(*) FROM course_registrations cr WHERE cr.student_id = s.id AND cr.session_id = @sess) AS regs_this_session,
       COUNT(DISTINCT rb.course_id) AS unregistered_courses_scored,
       ROUND(AVG(ra.total_score),1) AS avg_score,
       MAX(ra.total_score) AS max_score
FROM result_attempts ra
JOIN result_batches rb ON rb.id = ra.batch_id
JOIN students s ON s.id = ra.student_id
JOIN users u ON u.id = s.user_id
LEFT JOIN admissions ad ON ad.id = s.admission_id
WHERE rb.session_id = @sess AND s.programme_id = @prog AND ra.status = 'active'
  AND ra.total_score IS NOT NULL
  AND NOT EXISTS (
        SELECT 1 FROM course_registration_items cri
        JOIN course_registrations cr ON cr.id = cri.registration_id
        WHERE cr.student_id = s.id AND cri.course_id = rb.course_id AND cri.status = 'active')
GROUP BY s.id, u.full_name, ad.matric_number, s.admission_id
ORDER BY regs_this_session, max_score DESC;

-- Q2. How many DISTINCT students vs. the 32 real registered cohort?
SELECT COUNT(DISTINCT s.id) AS programme_students,
       COUNT(DISTINCT CASE WHEN EXISTS (SELECT 1 FROM course_registrations cr WHERE cr.student_id = s.id AND cr.session_id = @sess) THEN s.id END) AS students_with_registration
FROM students s WHERE s.programme_id = @prog;

-- Q3. ENG111 vs ENG131: who has scores / registrations under each code (real cohort passes ENG111 but is not registered for it)
SELECT c.code, c.title, c.credit_units,
       (SELECT COUNT(*) FROM course_registration_items cri JOIN course_registrations cr ON cr.id = cri.registration_id
         WHERE cri.course_id = c.id AND cr.session_id = @sess AND cri.status='active') AS registrations,
       (SELECT COUNT(*) FROM result_attempts ra JOIN result_batches rb ON rb.id = ra.batch_id
         WHERE rb.course_id = c.id AND rb.session_id = @sess AND ra.status='active' AND ra.total_score IS NOT NULL) AS scored_attempts,
       (SELECT COUNT(*) FROM result_attempts ra JOIN result_batches rb ON rb.id = ra.batch_id
         WHERE rb.course_id = c.id AND rb.session_id = @sess AND ra.status='active' AND ra.total_score >= 40) AS passes
FROM courses c WHERE c.code IN ('ENG111','ENG131','BIO111') ;

-- Q4. Possible duplicate student records (same normalised name, different ids; apostrophe variants)
SELECT REPLACE(REPLACE(REPLACE(LOWER(u.full_name), '''', ''), CHAR(0xE28099 USING utf8mb4), ''), ' ', '') AS norm_name,
       COUNT(*) AS n, GROUP_CONCAT(s.id) AS ids
FROM students s JOIN users u ON u.id = s.user_id
WHERE s.programme_id = @prog
GROUP BY norm_name HAVING n > 1;


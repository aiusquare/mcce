# Let's inspect what query would find the Contact 1 registration IDs for the 28 students
query = """
SELECT cr.id AS registration_id, s.id AS student_id, u.full_name, ad.matric_number,
       (SELECT c.id FROM courses c WHERE c.code = 'ENG111' AND c.programme_id = '8732138a-a35d-4551-947a-b01300810512' LIMIT 1) AS peap_eng111_course_id
FROM course_registrations cr
JOIN students s ON s.id = cr.student_id
JOIN users u ON u.id = s.user_id
LEFT JOIN admissions ad ON ad.id = s.admission_id
WHERE s.programme_id = '8732138a-a35d-4551-947a-b01300810512'
  AND (cr.semester_id IN (SELECT id FROM semesters WHERE name LIKE '%Contact 1%') OR cr.level = 'Contact 1')
  AND NOT EXISTS (
    SELECT 1 FROM course_registration_items cri
    JOIN courses c ON c.id = cri.course_id
    WHERE cri.registration_id = cr.id AND c.code = 'ENG111'
  )
  AND EXISTS (
    SELECT 1 FROM result_attempts ra
    JOIN result_batches rb ON rb.id = ra.batch_id
    JOIN courses c ON c.id = rb.course_id
    WHERE ra.student_id = s.id AND c.code = 'ENG111' AND ra.total_score IS NOT NULL
  );
"""
print(query)


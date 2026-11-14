import json

# Let's inspect the query to check IBRAHIM Mu'azu's score row in DB
query = """
SELECT ra.id AS attempt_id, ra.student_id, u.full_name, ra.status AS attempt_status,
       rb.id AS batch_id, rb.status AS batch_status, rb.session_id AS batch_session_id, rb.semester_id AS batch_semester_id,
       c.id AS course_id, c.code AS course_code, ra.total_score, ra.grade
FROM result_attempts ra
JOIN result_batches rb ON rb.id = ra.batch_id
JOIN courses c ON c.id = rb.course_id
JOIN students s ON s.id = ra.student_id
JOIN users u ON u.id = s.user_id
WHERE s.id = 'c200c2e5-e979-439c-9072-6fde5e8798a5'
  AND c.code = 'ENG111';
"""
print(query)


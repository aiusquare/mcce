<?php
$db = new PDO('mysql:host=127.0.0.1;dbname=mcceorgn_main', 'root', '');
$stmt = $db->query('
    SELECT s.admission_id, s.session_name, r.session_id as reg_session, ac.name as ac_session_name, 
           r.level as reg_level, r.semester_id, sm.name as semester_name, count(i.id) as items 
    FROM students s 
    JOIN course_registrations r ON s.id = r.student_id 
    LEFT JOIN academic_sessions ac ON r.session_id = ac.id 
    LEFT JOIN semesters sm ON r.semester_id = sm.id 
    LEFT JOIN course_registration_items i ON r.id = i.registration_id 
    GROUP BY s.id, r.id 
    ORDER BY r.created_at DESC 
    LIMIT 20;
');
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

$stmt2 = $db->query('SELECT id, code, title, level FROM courses LIMIT 5');
print_r($stmt2->fetchAll(PDO::FETCH_ASSOC));

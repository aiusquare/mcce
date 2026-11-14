<?php
$conn = new mysqli('127.0.0.1', 'aacasorg_main', 'Zb@+3C7]0Z;7RPcQ', 'aacasorg_main');
if ($conn->connect_error) die("Connection failed: " . $conn->connect_error);

$sql = "SELECT u.full_name, sess.name as sess_name, sem.name as sem_name, c.code, i.registration_type
        FROM course_registration_items i
        JOIN course_registrations r ON r.id = i.registration_id
        JOIN courses c ON c.id = i.course_id
        JOIN students s ON s.id = r.student_id
        JOIN users u ON u.id = s.user_id
        JOIN academic_sessions sess ON sess.id = r.session_id
        JOIN semesters sem ON sem.id = r.semester_id
        WHERE i.registration_type = 'CARRYOVER'
        ORDER BY i.created_at DESC LIMIT 10";

$res = $conn->query($sql);
if (!$res) die("Error: " . $conn->error);

while ($row = $res->fetch_assoc()) {
    echo "{$row['full_name']} | {$row['sess_name']} | {$row['sem_name']} | {$row['code']} | {$row['registration_type']}\n";
}
$conn->close();
?>


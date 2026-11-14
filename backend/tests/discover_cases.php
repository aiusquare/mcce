<?php
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['REQUEST_METHOD'] = 'GET';
chdir(__DIR__ . '/..');
ob_start();
require_once 'index.php';
ob_end_clean();

$CI = &get_instance();
$CI->load->database();

// Find sessions
$sessions = $CI->db->select('id, name')->get('academic_sessions')->result_array();
echo "Sessions:\n";
foreach ($sessions as $s) echo " - {$s['name']} ({$s['id']})\n";

// Find programmes with registrations / results
$sql = "
    SELECT p.id, p.name, cr.session_id, cr.level, cr.semester_id, count(distinct cr.student_id) as student_count
    FROM course_registrations cr
    JOIN students s ON s.id = cr.student_id
    JOIN programmes p ON p.id = s.programme_id
    GROUP BY p.id, p.name, cr.session_id, cr.level, cr.semester_id
    ORDER BY student_count DESC
    LIMIT 20
";
$rows = $CI->db->query($sql)->result_array();
echo "\nTop Programme / Session / Levels in course_registrations:\n";
foreach ($rows as $r) {
    echo " - Prog: {$r['name']} ({$r['id']}) | Sess: {$r['session_id']} | Level: {$r['level']} | Sem: {$r['semester_id']} | Students: {$r['student_count']}\n";
}

// Find result_batches
$sql2 = "
    SELECT p.id as prog_id, p.name as prog_name, rb.session_id, rb.semester_id, rb.level, count(distinct ra.student_id) as student_count, count(distinct rb.id) as batch_count
    FROM result_batches rb
    JOIN result_attempts ra ON ra.batch_id = rb.id
    LEFT JOIN programmes p ON p.id = rb.programme_id
    GROUP BY p.id, p.name, rb.session_id, rb.semester_id, rb.level
    ORDER BY student_count DESC
    LIMIT 15
";
$rows2 = $CI->db->query($sql2)->result_array();
echo "\nTop Batches in result_batches:\n";
foreach ($rows2 as $r) {
    echo " - Prog: {$r['prog_name']} ({$r['prog_id']}) | Sess: {$r['session_id']} | Level: {$r['level']} | Sem: {$r['semester_id']} | Batches: {$r['batch_count']} | Students: {$r['student_count']}\n";
}

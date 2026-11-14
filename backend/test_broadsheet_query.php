<?php
$conn = mysqli_connect('127.0.0.1', 'root', '', 'maslaha');
if (!$conn) {
    die("Connection failed: " . mysqli_connect_error());
}
echo "Connected successfully\n";

$target_session_ids = ['0fa36b4f-1e2d-4bab-be40-7f21c3a944f2', '2021/2022'];
$target_semester_ids = ['fced79f6-dacf-46a2-9756-897ecd090a29', 'Contact 1'];
$programme_id = '8732138a-a35d-4551-947a-b01300810512';

$start = microtime(true);

// Test query from Broadsheet_model line 235
$sess_ph = "'" . implode("','", $target_session_ids) . "'";
$sem_ph = "'" . implode("','", $target_semester_ids) . "'";

$sql = "
    SELECT DISTINCT c.id as course_id, c.code as course_code, c.title as course_title, c.credit_units
    FROM courses c
    WHERE c.id IN (
        -- Source 1: Registered CURRENT courses for this cohort
        SELECT cri.course_id
        FROM course_registrations cr
        JOIN course_registration_items cri ON cri.registration_id = cr.id
        JOIN students s ON s.id = cr.student_id
        WHERE (cr.session_id IN ($sess_ph) OR s.session_name IN ($sess_ph))
          AND (cr.semester_id IN ($sem_ph) OR cr.level IN ($sem_ph))
          AND s.programme_id = '$programme_id' 
          AND cri.status = 'active'
          AND cr.status IN ('approved', 'submitted')
          AND cri.registration_type NOT IN ('CARRYOVER', 'REPEAT')
    ) OR c.id IN (
        -- Source 2: Legacy fallback - any course present in result batches for this cohort
        SELECT rb.course_id 
        FROM result_batches rb
        JOIN result_attempts ra ON ra.batch_id = rb.id
        JOIN students s ON s.id = ra.student_id
        WHERE rb.session_id IN ($sess_ph) 
          AND (rb.semester_id IN ($sem_ph) OR rb.level IN ($sem_ph))
          AND s.programme_id = '$programme_id'
          AND NOT EXISTS (
                SELECT 1
                FROM course_registrations cr_co
                JOIN course_registration_items cri_co ON cri_co.registration_id = cr_co.id
                WHERE cr_co.student_id = s.id
                    AND (cr_co.session_id IN ($sess_ph) OR s.session_name IN ($sess_ph))
                    AND (cr_co.semester_id IN ($sem_ph) OR cr_co.level IN ($sem_ph))
                    AND cr_co.status IN ('approved', 'submitted')
                    AND cri_co.course_id = rb.course_id
                    AND cri_co.registration_type IN ('CARRYOVER', 'REPEAT')
                    AND cri_co.status = 'active'
          )
    )
    ORDER BY c.code ASC
";

$res = mysqli_query($conn, $sql);
if (!$res) {
    echo "Query error: " . mysqli_error($conn) . "\n";
} else {
    $rows = mysqli_fetch_all($res, MYSQLI_ASSOC);
    echo "Found " . count($rows) . " courses in " . round(microtime(true) - $start, 3) . "s\n";
    print_r($rows);
}
unlink(__FILE__);


<?php
// Seed the 3 real scenarios for golden testing
$m = new mysqli('localhost', 'aacasorg_main', 'Zb@+3C7]0Z;7RPcQ', 'aacasorg_main');
if ($m->connect_error) die("Connect failed: " . $m->connect_error . "\n");

$m->query("SET FOREIGN_KEY_CHECKS=0");

// 1. Academic Sessions
$m->query("INSERT IGNORE INTO academic_sessions (id, name, start_date, end_date, is_active) VALUES
    ('sess-2021', '2021/2022', '2021-09-01', '2022-08-31', 0),
    ('sess-2022', '2022/2023', '2022-09-01', '2023-08-31', 1)");

// 2. Semesters / Contacts
$m->query("INSERT IGNORE INTO semesters (id, name, is_active) VALUES
    ('sem-c1', 'Contact 1', 0),
    ('sem-c2', 'Contact 2', 1),
    ('sem-c3', 'Contact 3', 0)");

// 3. Departments & Programmes
$m->query("INSERT IGNORE INTO departments (id, name, code) VALUES
    ('dept-sci', 'Science Education', 'SED'),
    ('dept-arts', 'Educational Administration', 'EAP')");

$m->query("INSERT IGNORE INTO programmes (id, department_id, name, code, programme_structure) VALUES
    ('prog-cs', 'dept-sci', 'B.Sc (Ed) Computer Science', 'CSC', 'contact'),
    ('prog-eap', 'dept-arts', 'B.Ed Educational Administration and Planning', 'EAP', 'contact')");

// 4. Grading Scheme
$m->query("INSERT IGNORE INTO grading_schemes (id, name, is_active, created_at) VALUES
    ('scheme-5pt', 'Standard 5.0 Point System', 1, NOW())");

$m->query("INSERT IGNORE INTO grading_ranges (id, scheme_id, min_score, max_score, letter_grade, grade_point, is_pass, created_at) VALUES
    ('gr-a', 'scheme-5pt', 70, 100, 'A', 5.0, 1, NOW()),
    ('gr-b', 'scheme-5pt', 60, 69.99, 'B', 4.0, 1, NOW()),
    ('gr-c', 'scheme-5pt', 50, 59.99, 'C', 3.0, 1, NOW()),
    ('gr-d', 'scheme-5pt', 45, 49.99, 'D', 2.0, 1, NOW()),
    ('gr-e', 'scheme-5pt', 40, 44.99, 'E', 1.0, 1, NOW()),
    ('gr-f', 'scheme-5pt', 0, 39.99, 'F', 0.0, 0, NOW())");

// 5. Courses
$m->query("INSERT IGNORE INTO courses (id, programme_id, code, title, credit_units, level, contact_number) VALUES
    ('c-cs111', 'prog-cs', 'CSC111', 'Introduction to Computing', 3, 'Contact 1', 1),
    ('c-cs112', 'prog-cs', 'CSC112', 'Programming Fundamentals', 2, 'Contact 1', 1),
    ('c-mth111', 'prog-cs', 'MTH111', 'General Mathematics I', 3, 'Contact 1', 1),
    ('c-eap111', 'prog-eap', 'EAP111', 'Intro to Educational Planning', 2, 'Contact 1', 1),
    ('c-eap112', 'prog-eap', 'EAP112', 'History of Nigerian Education', 2, 'Contact 1', 1),
    ('c-eap211', 'prog-eap', 'EAP211', 'Educational Management', 2, 'Contact 2', 2),
    ('c-eap212', 'prog-eap', 'EAP212', 'School Plant Planning', 2, 'Contact 2', 2),
    ('c-edu211', 'prog-eap', 'EDU211', 'Educational Psychology', 2, 'Contact 2', 2),
    ('c-eap311', 'prog-eap', 'EAP311', 'Educational Administration', 3, 'Contact 3', 3),
    ('c-eap312', 'prog-eap', 'EAP312', 'Educational Supervision', 2, 'Contact 3', 3)");

// 6. Users & Students
$students_data = [
    // Case 1: Contact 1 Fresh
    ['u-c1-1', 's-c1-1', 'ad-c1-1', 'ADAMU Musa', 'CSC/21/001', 'prog-cs', 'fresh', '2021/2022', 'Contact 1'],
    ['u-c1-2', 's-c1-2', 'ad-c1-2', 'BELLO Aisha', 'CSC/21/002', 'prog-cs', 'fresh', '2021/2022', 'Contact 1'],
    ['u-c1-3', 's-c1-3', 'ad-c1-3', 'GARBA Usman', 'CSC/21/003', 'prog-cs', 'fresh', '2021/2022', 'Contact 1'],
    // Case 2: Contact 2 (Fresh and DE)
    ['u-c2-1', 's-c2-1', 'ad-c2-1', 'IBRAHIM Sani', 'EAP/21/101', 'prog-eap', 'fresh', '2021/2022', 'Contact 2'],
    ['u-c2-2', 's-c2-2', 'ad-c2-2', 'KABIR Zainab', 'EAP/21/102', 'prog-eap', 'fresh', '2021/2022', 'Contact 2'],
    ['u-c2-3', 's-c2-3', 'ad-c2-3', 'LAWAL Aliyu', 'EAP/21/103', 'prog-eap', 'fresh', '2021/2022', 'Contact 2'],
    ['u-c2-4', 's-c2-4', 'ad-c2-4', 'MUHAMMAD Fatima', 'EAP2/21/201', 'prog-eap', 'direct_entry', '2021/2022', 'Contact 2'],
    ['u-c2-5', 's-c2-5', 'ad-c2-5', 'NURA Abdurrahim', 'EAP2/21/202', 'prog-eap', 'direct_entry', '2021/2022', 'Contact 2'],
    // Case 3: Contact 3 (with carryovers from Contact 2)
    ['u-c3-1', 's-c3-1', 'ad-c3-1', 'SALISU Umar', 'EAP/20/301', 'prog-eap', 'fresh', '2020/2021', 'Contact 3'],
    ['u-c3-2', 's-c3-2', 'ad-c3-2', 'YUSUF Hadiza', 'EAP/20/302', 'prog-eap', 'fresh', '2020/2021', 'Contact 3'],
];

foreach ($students_data as $sd) {
    list($uid, $sid, $adid, $name, $matric, $prog, $em, $sess, $level) = $sd;
    $m->query("INSERT IGNORE INTO users (id, full_name, email, status) VALUES ('$uid', '$name', '$matric@mcce.test', 'active')");
    $m->query("INSERT IGNORE INTO admissions (id, matric_number, admission_number) VALUES ('$adid', '$matric', '$matric')");
    $m->query("INSERT IGNORE INTO students (id, user_id, admission_id, programme_id, entry_mode, session_name, current_level) VALUES
        ('$sid', '$uid', '$adid', '$prog', '$em', '$sess', '$level')");
}

// 7. Course Registrations & Items
// Case 1: Contact 1 registrations (session sess-2021, semester sem-c1)
foreach (['s-c1-1', 's-c1-2', 's-c1-3'] as $sid) {
    $reg_id = "cr-$sid";
    $m->query("INSERT IGNORE INTO course_registrations (id, student_id, session_id, semester_id, level, programme_id, status) VALUES
        ('$reg_id', '$sid', 'sess-2021', 'sem-c1', 'Contact 1', 'prog-cs', 'approved')");
    foreach (['c-cs111', 'c-cs112', 'c-mth111'] as $cid) {
        $m->query("INSERT IGNORE INTO course_registration_items (id, registration_id, course_id, registration_type, status) VALUES
            ('cri-$reg_id-$cid', '$reg_id', '$cid', 'core', 'active')");
    }
}

// Case 2: Contact 2 registrations (session sess-2021, semester sem-c2)
// Fresh students also had Contact 1 registrations
foreach (['s-c2-1', 's-c2-2', 's-c2-3'] as $sid) {
    $c1_reg = "cr-c1-$sid";
    $m->query("INSERT IGNORE INTO course_registrations (id, student_id, session_id, semester_id, level, programme_id, status) VALUES
        ('$c1_reg', '$sid', 'sess-2021', 'sem-c1', 'Contact 1', 'prog-eap', 'approved')");
    foreach (['c-eap111', 'c-eap112'] as $cid) {
        $m->query("INSERT IGNORE INTO course_registration_items (id, registration_id, course_id, registration_type, status) VALUES
            ('cri-$c1_reg-$cid', '$c1_reg', '$cid', 'core', 'active')");
    }
}
// All 5 students register Contact 2
foreach (['s-c2-1', 's-c2-2', 's-c2-3', 's-c2-4', 's-c2-5'] as $sid) {
    $reg_id = "cr-c2-$sid";
    $m->query("INSERT IGNORE INTO course_registrations (id, student_id, session_id, semester_id, level, programme_id, status) VALUES
        ('$reg_id', '$sid', 'sess-2021', 'sem-c2', 'Contact 2', 'prog-eap', 'approved')");
    foreach (['c-eap211', 'c-eap212', 'c-edu211'] as $cid) {
        $m->query("INSERT IGNORE INTO course_registration_items (id, registration_id, course_id, registration_type, status) VALUES
            ('cri-$reg_id-$cid', '$reg_id', '$cid', 'core', 'active')");
    }
}

// Case 3: Contact 3 registrations (session sess-2022, semester sem-c3)
// Students had Contact 2 history in sess-2021
foreach (['s-c3-1', 's-c3-2'] as $sid) {
    $c2_reg = "cr-c2-$sid";
    $m->query("INSERT IGNORE INTO course_registrations (id, student_id, session_id, semester_id, level, programme_id, status) VALUES
        ('$c2_reg', '$sid', 'sess-2021', 'sem-c2', 'Contact 2', 'prog-eap', 'approved')");
    foreach (['c-eap211', 'c-eap212'] as $cid) {
        $m->query("INSERT IGNORE INTO course_registration_items (id, registration_id, course_id, registration_type, status) VALUES
            ('cri-$c2_reg-$cid', '$c2_reg', '$cid', 'core', 'active')");
    }

    $c3_reg = "cr-c3-$sid";
    $m->query("INSERT IGNORE INTO course_registrations (id, student_id, session_id, semester_id, level, programme_id, status) VALUES
        ('$c3_reg', '$sid', 'sess-2022', 'sem-c3', 'Contact 3', 'prog-eap', 'approved')");
    foreach (['c-eap311', 'c-eap312'] as $cid) {
        $m->query("INSERT IGNORE INTO course_registration_items (id, registration_id, course_id, registration_type, status) VALUES
            ('cri-$c3_reg-$cid', '$c3_reg', '$cid', 'core', 'active')");
    }
    // Carryover registration for EAP212
    $m->query("INSERT IGNORE INTO course_registration_items (id, registration_id, course_id, registration_type, status) VALUES
        ('cri-$c3_reg-co-eap212', '$c3_reg', 'c-eap212', 'carryover', 'active')");
}

// 8. Result Batches & Attempts
function add_batch($m, $bid, $cid, $sess, $sem, $level, $prog, $status, $attempts) {
    $m->query("INSERT IGNORE INTO result_batches (id, session_id, semester_id, course_id, level, programme_id, status, created_at, approved_at, published_at)
        VALUES ('$bid', '$sess', '$sem', '$cid', '$level', '$prog', '$status', NOW(), NOW(), NOW())");
    foreach ($attempts as $att) {
        list($aid, $sid, $ca, $exam, $tot, $grd, $gp, $cu) = $att;
        $qp = $gp * $cu;
        $ca_sql = ($ca === null) ? "NULL" : $ca;
        $exam_sql = ($exam === null) ? "NULL" : $exam;
        $tot_sql = ($tot === null) ? "NULL" : $tot;
        $grd_sql = ($grd === null) ? "NULL" : "'$grd'";
        $m->query("INSERT IGNORE INTO result_attempts (id, batch_id, student_id, ca_score, exam_score, total_score, grade, grade_point, quality_point, status, is_locked)
            VALUES ('$aid', '$bid', '$sid', $ca_sql, $exam_sql, $tot_sql, $grd_sql, $gp, $qp, 'active', 1)");
    }
}

// Case 1 Batches (CSC Contact 1)
add_batch($m, 'rb-cs111', 'c-cs111', 'sess-2021', 'sem-c1', 'Contact 1', 'prog-cs', 'published', [
    ['ra-cs111-1', 's-c1-1', 25, 55, 80, 'A', 5.0, 3],
    ['ra-cs111-2', 's-c1-2', 20, 45, 65, 'B', 4.0, 3],
    ['ra-cs111-3', 's-c1-3', null, null, null, 'ABS', 0.0, 3],
]);
add_batch($m, 'rb-cs112', 'c-cs112', 'sess-2021', 'sem-c1', 'Contact 1', 'prog-cs', 'published', [
    ['ra-cs112-1', 's-c1-1', 22, 48, 70, 'A', 5.0, 2],
    ['ra-cs112-2', 's-c1-2', 15, 20, 35, 'F', 0.0, 2],
    ['ra-cs112-3', 's-c1-3', 18, 35, 53, 'C', 3.0, 2],
]);
add_batch($m, 'rb-mth111', 'c-mth111', 'sess-2021', 'sem-c1', 'Contact 1', 'prog-cs', 'published', [
    ['ra-mth111-1', 's-c1-1', 24, 46, 70, 'A', 5.0, 3],
    ['ra-mth111-2', 's-c1-2', 20, 40, 60, 'B', 4.0, 3],
    ['ra-mth111-3', 's-c1-3', 15, 30, 45, 'D', 2.0, 3],
]);

// Case 2 Batches (EAP Contact 1 prior history for Fresh students)
add_batch($m, 'rb-eap111', 'c-eap111', 'sess-2021', 'sem-c1', 'Contact 1', 'prog-eap', 'published', [
    ['ra-eap111-1', 's-c2-1', 22, 50, 72, 'A', 5.0, 2],
    ['ra-eap111-2', 's-c2-2', 18, 42, 60, 'B', 4.0, 2],
    ['ra-eap111-3', 's-c2-3', 15, 35, 50, 'C', 3.0, 2],
]);
add_batch($m, 'rb-eap112', 'c-eap112', 'sess-2021', 'sem-c1', 'Contact 1', 'prog-eap', 'published', [
    ['ra-eap112-1', 's-c2-1', 20, 45, 65, 'B', 4.0, 2],
    ['ra-eap112-2', 's-c2-2', 18, 44, 62, 'B', 4.0, 2],
    ['ra-eap112-3', 's-c2-3', 16, 40, 56, 'C', 3.0, 2],
]);

// Case 2 Batches (EAP Contact 2 for all 5 students)
add_batch($m, 'rb-eap211', 'c-eap211', 'sess-2021', 'sem-c2', 'Contact 2', 'prog-eap', 'published', [
    ['ra-eap211-1', 's-c2-1', 24, 52, 76, 'A', 5.0, 2],
    ['ra-eap211-2', 's-c2-2', 22, 45, 67, 'B', 4.0, 2],
    ['ra-eap211-3', 's-c2-3', 18, 42, 60, 'B', 4.0, 2],
    ['ra-eap211-4', 's-c2-4', 25, 55, 80, 'A', 5.0, 2], // DE
    ['ra-eap211-5', 's-c2-5', 20, 50, 70, 'A', 5.0, 2], // DE
]);
add_batch($m, 'rb-eap212', 'c-eap212', 'sess-2021', 'sem-c2', 'Contact 2', 'prog-eap', 'published', [
    ['ra-eap212-1', 's-c2-1', 20, 48, 68, 'B', 4.0, 2],
    ['ra-eap212-2', 's-c2-2', 18, 44, 62, 'B', 4.0, 2],
    ['ra-eap212-3', 's-c2-3', 14, 20, 34, 'F', 0.0, 2], // Fails EAP212
    ['ra-eap212-4', 's-c2-4', 22, 46, 68, 'B', 4.0, 2], // DE
    ['ra-eap212-5', 's-c2-5', 21, 47, 68, 'B', 4.0, 2], // DE
]);
add_batch($m, 'rb-edu211', 'c-edu211', 'sess-2021', 'sem-c2', 'Contact 2', 'prog-eap', 'published', [
    ['ra-edu211-1', 's-c2-1', 22, 45, 67, 'B', 4.0, 2],
    ['ra-edu211-2', 's-c2-2', 20, 40, 60, 'B', 4.0, 2],
    ['ra-edu211-3', 's-c2-3', 18, 40, 58, 'C', 3.0, 2],
    ['ra-edu211-4', 's-c2-4', 23, 47, 70, 'A', 5.0, 2], // DE
    ['ra-edu211-5', 's-c2-5', 18, 42, 60, 'B', 4.0, 2], // DE
]);

// Case 3 Batches: Contact 2 prior failures for s-c3-1 and s-c3-2
add_batch($m, 'rb-c2-hist-211', 'c-eap211', 'sess-2021', 'sem-c2', 'Contact 2', 'prog-eap', 'published', [
    ['ra-c2h-1', 's-c3-1', 20, 45, 65, 'B', 4.0, 2],
    ['ra-c2h-2', 's-c3-2', 18, 42, 60, 'B', 4.0, 2],
]);
add_batch($m, 'rb-c2-hist-212', 'c-eap212', 'sess-2021', 'sem-c2', 'Contact 2', 'prog-eap', 'published', [
    ['ra-c2h-fail-1', 's-c3-1', 12, 20, 32, 'F', 0.0, 2], // Failed in C2
    ['ra-c2h-fail-2', 's-c3-2', 14, 22, 36, 'F', 0.0, 2], // Failed in C2
]);

// Case 3 Batches: Contact 3 current results in sess-2022
add_batch($m, 'rb-c3-311', 'c-eap311', 'sess-2022', 'sem-c3', 'Contact 3', 'prog-eap', 'published', [
    ['ra-c3-311-1', 's-c3-1', 22, 48, 70, 'A', 5.0, 3],
    ['ra-c3-311-2', 's-c3-2', 20, 42, 62, 'B', 4.0, 3],
]);
add_batch($m, 'rb-c3-312', 'c-eap312', 'sess-2022', 'sem-c3', 'Contact 3', 'prog-eap', 'published', [
    ['ra-c3-312-1', 's-c3-1', 20, 40, 60, 'B', 4.0, 2],
    ['ra-c3-312-2', 's-c3-2', 18, 35, 53, 'C', 3.0, 2],
]);

// Carryover retake in Contact 3: s-c3-1 passed with 65 B, s-c3-2 did not retake or passed
$m->query("INSERT IGNORE INTO carryover_corrections (id, student_id, course_id, session_id, semester_id, source_result_attempt_id, result_attempt_id, ca_score, exam_score, total_score, grade, grade_point, quality_point, created_at) VALUES
    ('cc-1', 's-c3-1', 'c-eap212', 'sess-2022', 'sem-c3', 'ra-c2h-fail-1', 'ra-c3-co-1', 20, 45, 65, 'B', 4.0, 8.0, NOW())");

$m->query("SET FOREIGN_KEY_CHECKS=1");

echo "Seed data completed successfully for all 3 cases!\n";

<?php
/**
 * Test: Production Duplication & Contact Resolution Scenarios
 * Verifies fixes for:
 * 1. Contact 2 courses with 1xx codes (ENG112, GST112) when cr.semester_id is generic ('First Semester') and cr.level = 'Contact 2'.
 * 2. Polluted cr.level = 'Contact 6' on rows whose cr.semester_id is Contact 1..5.
 * 3. Duplicate courses rows with the same course_code (registered under UUID_1, scored under UUID_2).
 * 4. Duplicate result_batches where an unscored row in Batch 2 must not overwrite a real score in Batch 1 with ABS.
 */

$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['REQUEST_METHOD'] = 'GET';
chdir(__DIR__ . '/..');
ob_start();
require_once 'index.php';
ob_end_clean();

echo "=======================================================\n";
echo "TESTING PRODUCTION DUPLICATION & CONTACT SCENARIOS\n";
echo "=======================================================\n";

$CI =& get_instance();
$CI->load->model('Broadsheet_model');
$CI->load->model('Reconciliation_model');

// Setup isolated test data in transaction and roll back after assertions
$CI->db->trans_begin();
$CI->db->query('SET FOREIGN_KEY_CHECKS = 0');

try {
    $prog_id = 'prog-peng-test';
    $sess_cohort_id = 'sess-2021-2022-test';
    $sess_reg_id    = 'sess-0018092b-test';
    $sem_generic_id = 'sem-00647a36-test';
    $sem_c1_id      = 'sem-fced79f6-test';
    $sem_c2_id      = 'sem-cd622cf9-test';
    $sem_c6_id      = 'sem-22deebd3-test';

    $dept_row = $CI->db->select('id')->get('departments', 1)->row_array();
    $dept_id = $dept_row['id'] ?? 'dept-peng-test';
    if (!$dept_row) {
        $CI->db->insert('departments', ['id' => $dept_id, 'name' => 'English Dept Test', 'code' => 'ENG-T']);
    }

    $prog_gst_id = 'prog-gst-test';
    $CI->db->insert('programmes', ['id' => $prog_id, 'name' => 'B.A. Ed. English Test', 'code' => 'PENG-T', 'department_id' => $dept_id]);
    $CI->db->insert('programmes', ['id' => $prog_gst_id, 'name' => 'General Studies Test', 'code' => 'GST-T', 'department_id' => $dept_id]);
    $CI->db->insert('academic_sessions', ['id' => $sess_cohort_id, 'name' => '2021/2022-TEST']);
    $CI->db->insert('academic_sessions', ['id' => $sess_reg_id, 'name' => '2025/2026-TEST']);
    $CI->db->insert('semesters', ['id' => $sem_generic_id, 'name' => 'First Semester']);
    $CI->db->insert('semesters', ['id' => $sem_c1_id, 'name' => 'Contact 1']);
    $CI->db->insert('semesters', ['id' => $sem_c2_id, 'name' => 'Contact 2']);
    $CI->db->insert('semesters', ['id' => $sem_c6_id, 'name' => 'Contact 6']);

    // Duplicate courses for GST121 across programmes (UUID 1 for registration, UUID 2 for result batch)
    $c_gst121_reg = 'c-gst121-uuid1';
    $c_gst121_bat = 'c-gst121-uuid2';
    $c_eng141     = 'c-eng141-uuid';
    $c_bio111_unreg = 'c-bio111-unreg'; // Course with ZERO registrations anywhere!
    // Contact 2 has BOTH 1xx (ENG112) and 2xx (EDU211) courses
    $c_eng112     = 'c-eng112-uuid';
    $c_edu211     = 'c-edu211-uuid';
    $c_edu311     = 'c-edu311-uuid';
    $c_edu411     = 'c-edu411-uuid';

    $CI->db->insert('courses', ['id' => $c_gst121_reg,   'code' => 'GST121', 'title' => 'Nigerian People, Culture & Anti Cultism', 'credit_units' => 2, 'level' => '100', 'contact_number' => 1, 'programme_id' => $prog_id]);
    $CI->db->insert('courses', ['id' => $c_gst121_bat,   'code' => 'GST121', 'title' => 'Nigerian Peoples, Culture and Anti-Cultism', 'credit_units' => 2, 'level' => '100', 'contact_number' => 1, 'programme_id' => $prog_gst_id]);
    $CI->db->insert('courses', ['id' => $c_eng141,       'code' => 'ENG141', 'title' => 'Intro to Literature', 'credit_units' => 3, 'level' => '100', 'contact_number' => 1, 'programme_id' => $prog_id]);
    $CI->db->insert('courses', ['id' => $c_bio111_unreg, 'code' => 'BIO111', 'title' => 'General Biology I (Unregistered)', 'credit_units' => 3, 'level' => '100', 'contact_number' => 1, 'programme_id' => $prog_id]);
    $CI->db->insert('courses', ['id' => $c_eng112,       'code' => 'ENG112', 'title' => 'English Composition II', 'credit_units' => 2, 'level' => '100', 'contact_number' => 2, 'programme_id' => $prog_id]);
    $CI->db->insert('courses', ['id' => $c_edu211,       'code' => 'EDU211', 'title' => 'Educational Foundations', 'credit_units' => 2, 'level' => '200', 'contact_number' => 2, 'programme_id' => $prog_id]);
    $CI->db->insert('courses', ['id' => $c_edu311,       'code' => 'EDU311', 'title' => 'Curriculum Studies', 'credit_units' => 3, 'level' => '300', 'contact_number' => 3, 'programme_id' => $prog_id]);
    $CI->db->insert('courses', ['id' => $c_edu411,       'code' => 'EDU411', 'title' => 'Guidance and Counselling', 'credit_units' => 3, 'level' => '400', 'contact_number' => 4, 'programme_id' => $prog_id]);

    // Student 1 & Student 2
    $u1_id = 'u-peng-1'; $s1_id = 's-peng-1'; $adm1_id = 'adm-peng-1';
    $u2_id = 'u-peng-2'; $s2_id = 's-peng-2'; $adm2_id = 'adm-peng-2';
    $CI->db->insert('users', ['id' => $u1_id, 'full_name' => 'AHMAD Akibu', 'email' => 'akibu@test.local']);
    $CI->db->insert('admissions', ['id' => $adm1_id, 'matric_number' => 'PENG/21/001', 'admission_number' => 'ADM001']);
    $CI->db->insert('students', ['id' => $s1_id, 'user_id' => $u1_id, 'admission_id' => $adm1_id, 'programme_id' => $prog_id, 'session_name' => '2021/2022-TEST', 'current_level' => 'Contact 6', 'entry_mode' => 'UTME']);

    $CI->db->insert('users', ['id' => $u2_id, 'full_name' => 'LAWAL Misbahu', 'email' => 'misbahu@test.local']);
    $CI->db->insert('admissions', ['id' => $adm2_id, 'matric_number' => 'PENG/21/002', 'admission_number' => 'ADM002']);
    $CI->db->insert('students', ['id' => $s2_id, 'user_id' => $u2_id, 'admission_id' => $adm2_id, 'programme_id' => $prog_id, 'session_name' => '2021/2022-TEST', 'current_level' => 'Contact 6', 'entry_mode' => 'UTME']);

    // Contact 1 registration: polluted with cr.level = 'Contact 6' while cr.semester_id = sem_c1_id (like d67a1df4 in production!)
    // Registered under c_gst121_reg (UUID 1) + c_eng141 (total 5 credits)
    $cr1_id = 'cr-peng-c1';
    $CI->db->insert('course_registrations', [
        'id' => $cr1_id, 'student_id' => $s1_id, 'session_id' => $sess_reg_id,
        'semester_id' => $sem_c1_id, 'level' => 'Contact 6', 'status' => 'approved', 'total_credits' => 5
    ]);
    $CI->db->insert('course_registration_items', ['id' => 'cri-1', 'registration_id' => $cr1_id, 'course_id' => $c_gst121_reg, 'status' => 'active', 'registration_type' => 'normal']);
    $CI->db->insert('course_registration_items', ['id' => 'cri-2', 'registration_id' => $cr1_id, 'course_id' => $c_eng141,     'status' => 'active', 'registration_type' => 'normal']);
    // Simulate Carryover_sync_model dumping Contact 2/3/4 carryover items + wrong-contact course into a Contact 1 envelope for Regular student s1
    $CI->db->insert('course_registration_items', ['id' => 'cri-1-co3', 'registration_id' => $cr1_id, 'course_id' => $c_edu311, 'status' => 'active', 'registration_type' => 'carryover']);
    $CI->db->insert('course_registration_items', ['id' => 'cri-1-co4', 'registration_id' => $cr1_id, 'course_id' => $c_edu411, 'status' => 'active', 'registration_type' => 'carryover']);
    $CI->db->insert('course_registration_items', ['id' => 'cri-1-wrong-c', 'registration_id' => $cr1_id, 'course_id' => $c_edu411, 'status' => 'active', 'registration_type' => 'core']);

    // Contact 1 registration for s2: had c_gst121_reg marked as 'carryover' because s2 failed it!
    $cr1_s2_id = 'cr-peng-c1-s2';
    $CI->db->insert('course_registrations', [
        'id' => $cr1_s2_id, 'student_id' => $s2_id, 'session_id' => $sess_reg_id,
        'semester_id' => $sem_c1_id, 'level' => 'Contact 1', 'status' => 'approved', 'total_credits' => 2
    ]);
    $CI->db->insert('course_registration_items', ['id' => 'cri-s2-1', 'registration_id' => $cr1_s2_id, 'course_id' => $c_gst121_reg, 'status' => 'active', 'registration_type' => 'carryover']);

    // Contact 2 registration: cr.semester_id = sem_generic_id ('First Semester') and cr.level = 'Contact 2' (like 0018092b in production!)
    // Registered for ENG112 (1xx, 2 credits) and EDU211 (2xx, 2 credits) -> total 4 credits
    $cr2_id = 'cr-peng-c2';
    $CI->db->insert('course_registrations', [
        'id' => $cr2_id, 'student_id' => $s1_id, 'session_id' => $sess_reg_id,
        'semester_id' => $sem_generic_id, 'level' => 'Contact 2', 'status' => 'approved', 'total_credits' => 4
    ]);
    $CI->db->insert('course_registration_items', ['id' => 'cri-3', 'registration_id' => $cr2_id, 'course_id' => $c_eng112, 'status' => 'active', 'registration_type' => 'normal']);
    $CI->db->insert('course_registration_items', ['id' => 'cri-4', 'registration_id' => $cr2_id, 'course_id' => $c_edu211, 'status' => 'active', 'registration_type' => 'normal']);

    // s2 also registers in Contact 2
    $cr2_s2_id = 'cr-peng-c2-s2';
    $CI->db->insert('course_registrations', [
        'id' => $cr2_s2_id, 'student_id' => $s2_id, 'session_id' => $sess_reg_id,
        'semester_id' => $sem_generic_id, 'level' => 'Contact 2', 'status' => 'approved', 'total_credits' => 4
    ]);
    $CI->db->insert('course_registration_items', ['id' => 'cri-s2-3', 'registration_id' => $cr2_s2_id, 'course_id' => $c_eng112, 'status' => 'active', 'registration_type' => 'normal']);
    $CI->db->insert('course_registration_items', ['id' => 'cri-s2-4', 'registration_id' => $cr2_s2_id, 'course_id' => $c_edu211, 'status' => 'active', 'registration_type' => 'normal']);

    // Contact 1 Result Batches:
    // GST121 scored under c_gst121_bat (UUID 2 - duplicate course row!)
    $rb_gst121 = 'rb-gst121-c1';
    $CI->db->insert('result_batches', ['id' => $rb_gst121, 'course_id' => $c_gst121_bat, 'session_id' => $sess_cohort_id, 'semester_id' => $sem_c1_id, 'status' => 'published']);
    $CI->db->insert('result_attempts', ['id' => 'ra-1', 'batch_id' => $rb_gst121, 'student_id' => $s1_id, 'total_score' => 65, 'grade' => 'B', 'grade_point' => 4, 'quality_point' => 8, 'status' => 'active', 'created_at' => '2026-01-01 10:00:00']);

    // ENG141 has TWO duplicate batches in Contact 1:
    // Batch 1 has s1's real score (55 C)
    // Batch 2 (created later) has s2's score (60 B) and an unscored placeholder row for s1!
    $rb_eng141_1 = 'rb-eng141-c1-dup1';
    $rb_eng141_2 = 'rb-eng141-c1-dup2';
    $CI->db->insert('result_batches', ['id' => $rb_eng141_1, 'course_id' => $c_eng141, 'session_id' => $sess_cohort_id, 'semester_id' => $sem_c1_id, 'status' => 'draft']);
    $CI->db->insert('result_batches', ['id' => $rb_eng141_2, 'course_id' => $c_eng141, 'session_id' => $sess_cohort_id, 'semester_id' => $sem_c1_id, 'status' => 'draft']);
    $CI->db->insert('result_attempts', ['id' => 'ra-2a', 'batch_id' => $rb_eng141_1, 'student_id' => $s1_id, 'total_score' => 55, 'grade' => 'C', 'grade_point' => 3, 'quality_point' => 9, 'status' => 'active', 'created_at' => '2026-01-01 10:00:00']);
    $CI->db->insert('result_attempts', ['id' => 'ra-2b', 'batch_id' => $rb_eng141_2, 'student_id' => $s1_id, 'total_score' => null, 'grade' => null, 'grade_point' => null, 'quality_point' => null, 'status' => 'active', 'created_at' => '2026-01-02 10:00:00']);
    $CI->db->insert('result_attempts', ['id' => 'ra-2c', 'batch_id' => $rb_eng141_2, 'student_id' => $s2_id, 'total_score' => 60, 'grade' => 'B', 'grade_point' => 4, 'quality_point' => 12, 'status' => 'active', 'created_at' => '2026-01-02 10:00:00']);

    // Unregistered course BIO111 has a published result batch and a failing score (30 F) for s1_id in Contact 1!
    // Because BIO111 has ZERO course registrations, it MUST NOT appear in Contact 1 current_courses,
    // MUST NOT count in Contact 1 TCR/TCE/TQP/GPA or Remark (CO:), and MUST NOT count in Contact 2 Previous CCR or Carryovers!
    $rb_bio111 = 'rb-bio111-c1-unreg';
    $CI->db->insert('result_batches', ['id' => $rb_bio111, 'course_id' => $c_bio111_unreg, 'session_id' => $sess_cohort_id, 'semester_id' => $sem_c1_id, 'status' => 'published']);
    $CI->db->insert('result_attempts', ['id' => 'ra-bio-1', 'batch_id' => $rb_bio111, 'student_id' => $s1_id, 'total_score' => 30, 'grade' => 'F', 'grade_point' => 0, 'quality_point' => 0, 'status' => 'active', 'created_at' => '2026-01-01 10:00:00']);

    // Contact 2 Result Batches (ENG112 and EDU211):
    $rb_eng112 = 'rb-eng112-c2';
    $rb_edu211 = 'rb-edu211-c2';
    $CI->db->insert('result_batches', ['id' => $rb_eng112, 'course_id' => $c_eng112, 'session_id' => $sess_cohort_id, 'semester_id' => $sem_c2_id, 'status' => 'published']);
    $CI->db->insert('result_batches', ['id' => $rb_edu211, 'course_id' => $c_edu211, 'session_id' => $sess_cohort_id, 'semester_id' => $sem_c2_id, 'status' => 'published']);
    $CI->db->insert('result_attempts', ['id' => 'ra-3', 'batch_id' => $rb_eng112, 'student_id' => $s1_id, 'total_score' => 70, 'grade' => 'A', 'grade_point' => 5, 'quality_point' => 10, 'status' => 'active', 'created_at' => '2026-02-01 10:00:00']);
    $CI->db->insert('result_attempts', ['id' => 'ra-4', 'batch_id' => $rb_edu211, 'student_id' => $s1_id, 'total_score' => 50, 'grade' => 'C', 'grade_point' => 3, 'quality_point' => 6, 'status' => 'active', 'created_at' => '2026-02-01 10:00:00']);

    // Reset Period_resolver cache by re-instantiating or testing
    $CI->period_resolver = new Period_resolver();

    // 1. Test Contact 1 Broadsheet & Reconciliation
    $bs_c1 = $CI->Broadsheet_model->generate($sess_cohort_id, $sem_c1_id, $prog_id);
    $c1_codes = array_column($bs_c1['current_courses'], 'course_code');
    if (in_array('BIO111', $c1_codes, true)) {
        throw new Exception("Unregistered course BIO111 must NOT appear in Contact 1 current_courses!");
    }
    $st1_c1 = null;
    $st2_c1 = null;
    foreach ($bs_c1['students'] as $st) {
        if ($st['student_id'] === $s1_id) $st1_c1 = $st;
        if ($st['student_id'] === $s2_id) $st2_c1 = $st;
    }
    if (!$st1_c1) throw new Exception("Student s1 missing in Contact 1 broadsheet");
    if (!$st2_c1) throw new Exception("Student s2 missing in Contact 1 broadsheet");
    if ((int)$st1_c1['current']['registered_credits'] !== 5) {
        throw new Exception("Contact 1 TCR expected 5 (unregistered BIO111 must not be counted!), got " . $st1_c1['current']['registered_credits']);
    }
    if ((int)$st1_c1['current']['earned_credits'] !== 5) {
        throw new Exception("Contact 1 TCE expected 5 (duplicate unscored batch must not turn 55C into ABS!), got " . $st1_c1['current']['earned_credits']);
    }
    if (strpos((string)$st1_c1['remark'], 'BIO111') !== false) {
        throw new Exception("Unregistered failed course BIO111 must NOT appear in Contact 1 remark: " . $st1_c1['remark']);
    }
    // Student s2 had GST121 flipped to 'carryover' in Contact 1, but it is a normal cohort course, so TCR=2, Earned=2, QP=8
    if ((int)$st2_c1['current']['registered_credits'] !== 2) {
        throw new Exception("Contact 1 s2 TCR expected 2, got " . $st2_c1['current']['registered_credits']);
    }
    echo "  [OK] Contact 1 TCR=5/2 verified (zero-registration course BIO111 completely excluded & s2 flipped carryover accepted).\n";

    // Check Reconciliation on Contact 1 for s1
    $rec_c1 = $CI->Reconciliation_model->check($sess_cohort_id, $sem_c1_id, $prog_id);
    $s1_unreg = array_filter($rec_c1['issues'], function($iss) use ($s1_id) {
        return $iss['student_id'] === $s1_id && $iss['type'] === 'unregistered_score';
    });
    if (count($s1_unreg) !== 0) {
        throw new Exception("Expected 0 unregistered_score for s1 in Contact 1, got " . count($s1_unreg));
    }
    echo "  [OK] Reconciliation_model matched cross-session & duplicate course_id registrations with 0 false unregistered_score.\n";

    // 2. Test Contact 2 Broadsheet:
    // Previous CCR MUST be 5 (NOT 5 + 2 + 2 = 9!), Current TCR MUST be 4 (ENG112 + EDU211), Cumulative CCR MUST be 9!
    $bs_c2 = $CI->Broadsheet_model->generate($sess_cohort_id, $sem_c2_id, $prog_id);
    $c2_codes = array_column($bs_c2['current_courses'], 'course_code');
    if (!in_array('ENG112', $c2_codes) || !in_array('EDU211', $c2_codes)) {
        throw new Exception("Contact 2 current_courses missing ENG112 or EDU211: " . implode(',', $c2_codes));
    }
    $st1_c2 = null;
    $st2_c2 = null;
    foreach ($bs_c2['students'] as $st) {
        if ($st['student_id'] === $s1_id) $st1_c2 = $st;
        if ($st['student_id'] === $s2_id) $st2_c2 = $st;
    }
    if ((int)$st1_c2['previous']['registered_credits'] !== 5) {
        throw new Exception("Contact 2 Previous CCR expected 5, got " . $st1_c2['previous']['registered_credits']);
    }
    if ((int)$st1_c2['previous']['earned_credits'] !== (int)$st1_c1['cumulative']['earned_credits']
        || (int)$st1_c2['previous']['quality_points'] !== (int)$st1_c1['cumulative']['quality_points']
        || $st1_c2['previous']['cgpa'] !== $st1_c1['cumulative']['cgpa']) {
        throw new Exception("Contact 2 Previous metrics do not match Contact 1 Cumulative metrics!");
    }
    // Verify s2 who had GST121 marked as 'carryover' in Contact 1: Previous CCR in Contact 2 MUST match Contact 1 Cumulative CCR (2)!
    if ((int)$st2_c2['previous']['registered_credits'] !== 2) {
        throw new Exception("Contact 2 s2 Previous CCR expected 2, got " . $st2_c2['previous']['registered_credits']);
    }
    if ((int)$st2_c2['previous']['earned_credits'] !== (int)$st2_c1['cumulative']['earned_credits']
        || (int)$st2_c2['previous']['quality_points'] !== (int)$st2_c1['cumulative']['quality_points']
        || $st2_c2['previous']['cgpa'] !== $st2_c1['cumulative']['cgpa']) {
        throw new Exception("Contact 2 s2 Previous metrics do not match Contact 1 Cumulative metrics!");
    }
    if ((int)$st1_c2['current']['registered_credits'] !== 4) {
        throw new Exception("Contact 2 Current TCR expected 4, got " . $st1_c2['current']['registered_credits']);
    }
    if ((int)$st1_c2['cumulative']['registered_credits'] !== 9) {
        throw new Exception("Contact 2 Cumulative CCR expected 9, got " . $st1_c2['cumulative']['registered_credits']);
    }
    $c2_co_codes = array_column($bs_c2['carryover_courses'], 'course_code');
    if (in_array('BIO111', $c2_co_codes, true) || strpos((string)$st1_c2['remark'], 'BIO111') !== false) {
        throw new Exception("Unregistered failed course BIO111 must NOT appear in Contact 2 carryover_courses or remark!");
    }
    echo "  [OK] Contact 2 Previous CCR=5, Current TCR=4, Cumulative CCR=9 verified (zero 1xx leakage & zero unregistered BIO111 carryover!).\n";

    // 3. Test Contact 6 Broadsheet:
    // Polluted cr.level = 'Contact 6' on cr1_id (which has semester_id = sem_c1_id) MUST NOT leak GST121 or ENG141 into Contact 6!
    $bs_c6 = $CI->Broadsheet_model->generate($sess_cohort_id, $sem_c6_id, $prog_id);
    if (!empty($bs_c6['current_courses'])) {
        throw new Exception("Contact 6 current_courses should be empty, but got: " . json_encode($bs_c6['current_courses']));
    }
    echo "  [OK] Contact 6 ignored polluted cr.level='Contact 6' on Contact 1 semester_id rows.\n";

    $CI->db->trans_rollback();
    $CI->db->query('SET FOREIGN_KEY_CHECKS = 1');
    echo "=======================================================\n";
    echo "SUCCESS: ALL PRODUCTION DUPLICATION SCENARIOS VERIFIED!\n";
    echo "=======================================================\n";
} catch (Exception $e) {
    $CI->db->trans_rollback();
    $CI->db->query('SET FOREIGN_KEY_CHECKS = 1');
    echo "[FAILED] " . $e->getMessage() . "\n";
    exit(1);
}

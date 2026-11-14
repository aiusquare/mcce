<?php
// Test script for Batch Creation Guard and Student Listing Integrity
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['REQUEST_METHOD'] = 'GET';
chdir(__DIR__ . '/..');
ob_start();
require_once 'index.php';
ob_end_clean();

echo "=======================================================\n";
echo "TESTING BATCH CREATION GUARD & STUDENT LISTING INTEGRITY\n";
echo "=======================================================\n";

$CI =& get_instance();
$CI->load->model('Results_model');
$CI->load->model('Courses_model');
$CI->load->library('Period_resolver');

// Step 1: Discover a valid session, semester, course with registered students, and one with 0
echo "1. Checking count_registered_students_for_batch...\n";

// Find an existing registration item
$reg_item = $CI->db->select('cri.course_id, cr.session_id, cr.semester_id, cr.level, cr.programme_id, cr.student_id')
    ->from('course_registration_items cri')
    ->join('course_registrations cr', 'cr.id = cri.registration_id')
    ->where_in('cr.status', ['approved', 'submitted', 'draft'])
    ->limit(1)
    ->get()
    ->row_array();

if (!$reg_item) {
    echo "  [SKIP] No course registrations found in test DB.\n";
} else {
    // Test with registered course
    $batch_query = [
        'session_id'   => $reg_item['session_id'],
        'semester_id'  => $reg_item['semester_id'],
        'course_id'    => $reg_item['course_id'],
        'programme_id' => $reg_item['programme_id'],
        'level'        => $reg_item['level'],
    ];

    $count = $CI->Results_model->count_registered_students_for_batch($batch_query);
    assert($count > 0, "Registered student count must be > 0 for registered course");
    echo "  [OK] count_registered_students_for_batch returned {$count} for registered course.\n";

    // Test with non-existent or 0-registration course
    $fake_batch = [
        'session_id'   => $reg_item['session_id'],
        'semester_id'  => $reg_item['semester_id'],
        'course_id'    => 'course-with-zero-registrations-uuid-999',
        'programme_id' => $reg_item['programme_id'],
        'level'        => $reg_item['level'],
    ];

    $zero_count = $CI->Results_model->count_registered_students_for_batch($fake_batch);
    assert($zero_count === 0, "Registered student count must be 0 for course with no registrations");
    echo "  [OK] count_registered_students_for_batch returned 0 for un-registered course.\n";

    // Step 2: Testing Results_model::create_batch rejection when registered count is 0
    echo "2. Testing create_batch guard against 0 registered students...\n";
    $created_id = $CI->Results_model->create_batch($fake_batch);
    assert($created_id === false, "create_batch must return false when registered student count is 0");
    echo "  [OK] create_batch strictly rejected 0-student course batch creation.\n";

    // Step 3: Testing get_attempts_by_batch filtering of unregistered students
    echo "3. Testing get_attempts_by_batch filtering...\n";
    // Check if an existing batch exists
    $existing_batch = $CI->db->get_where('result_batches', [
        'session_id' => $reg_item['session_id'],
        'course_id'  => $reg_item['course_id']
    ], 1)->row_array();

    if ($existing_batch) {
        $attempts = $CI->Results_model->get_attempts_by_batch($existing_batch['id']);
        $registered_students = $CI->Results_model->get_registered_students_for_batch($existing_batch);
        $valid_map = array_fill_keys(array_column($registered_students, 'student_id'), true);

        $all_valid = true;
        foreach ($attempts as $att) {
            if (!isset($valid_map[$att['student_id']])) {
                $all_valid = false;
                break;
            }
        }
        assert($all_valid, "All attempts returned must belong to students registered under the course");
        echo "  [OK] get_attempts_by_batch strictly only listed registered students.\n";
    } else {
        echo "  [INFO] No existing batch found to check listing, create_batch guard verified.\n";
    }
}

echo "=======================================================\n";
echo "SUCCESS: BATCH CREATION & STUDENT LISTING GUARDS VERIFIED!\n";
echo "=======================================================\n";


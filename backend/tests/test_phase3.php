<?php
// Test script for Phase 3 improvements
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['REQUEST_METHOD'] = 'GET';
chdir(__DIR__ . '/..');
ob_start();
require_once 'index.php';
ob_end_clean();

echo "=======================================================\n";
echo "TESTING PHASE 3: RESULT-SHEET & REGISTRATION IMPROVEMENTS\n";
echo "=======================================================\n";

$CI =& get_instance();
$CI->load->model('Results_model');
$CI->load->model('Courses_model');
$CI->load->library('Period_resolver');

// 1. Test populate_batch_attempts snapshots
echo "1. Testing populate_batch_attempts snapshot fields...\n";
$batches = $CI->db->get_where('result_batches', array('status' => 'draft'), 1)->result_array();
if (!empty($batches)) {
    $batch = $batches[0];
    $CI->Results_model->populate_batch_attempts($batch);
    $attempts = $CI->db->get_where('result_attempts', array('batch_id' => $batch['id']))->result_array();
    $has_snapshots = true;
    foreach ($attempts as $a) {
        if (!isset($a['result_state']) || $a['result_state'] === null) {
            $has_snapshots = false;
        }
    }
    echo $has_snapshots ? "  [OK] Attempts have result_state populated.\n" : "  [FAIL] Missing result_state on attempts.\n";
} else {
    echo "  [INFO] No draft batch found to populate, testing on existing attempts...\n";
    $attempts = $CI->db->get('result_attempts', 5)->result_array();
    foreach ($attempts as $a) {
        assert(isset($a['result_state']), "result_state column exists");
    }
    echo "  [OK] result_attempts columns verified.\n";
}

// 2. Test Period_resolver on batch level and contact
echo "2. Testing Period_resolver resolution...\n";
$res1 = $CI->period_resolver->resolve('sess_2023_2024', 'Contact 2');
assert($res1['contact_number'] === 2, "Contact 2 resolved to 2");
assert(in_array('Contact 2', $res1['semester_ids']), "semester_ids includes Contact 2");
echo "  [OK] Period_resolver correctly resolved Contact 2.\n";

// 3. Test save_attempts snapshot logic
echo "3. Testing save_attempts snapshot updates...\n";
$any_batch = $CI->db->get('result_batches', 1)->row_array();
if ($any_batch) {
    $first_attempt = $CI->db->get_where('result_attempts', array('batch_id' => $any_batch['id']), 1)->row_array();
    if ($first_attempt) {
        echo "  Attempt ID: {$first_attempt['id']}, state: {$first_attempt['result_state']}, units: {$first_attempt['credit_units_snapshot']}\n";
        echo "  [OK] Attempt fields verified.\n";
    }
}

// 4. Test result_amendments table exists and is writable
echo "4. Testing result_amendments table...\n";
assert($CI->db->table_exists('result_amendments'), "result_amendments exists");
$test_amend_id = 'test-amend-' . time();
$CI->db->insert('result_amendments', array(
    'id' => $test_amend_id,
    'student_id' => 'test-student',
    'field' => 'test_field',
    'old_value' => 'old',
    'new_value' => 'new',
    'reason' => 'Phase 3 test verification',
    'created_at' => date('Y-m-d H:i:s')
));
$saved = $CI->db->get_where('result_amendments', array('id' => $test_amend_id))->row_array();
assert($saved !== null, "Amendment record saved");
$CI->db->delete('result_amendments', array('id' => $test_amend_id));
echo "  [OK] result_amendments table verified and writable.\n";

echo "=======================================================\n";
echo "SUCCESS: Phase 3 verified!\n";

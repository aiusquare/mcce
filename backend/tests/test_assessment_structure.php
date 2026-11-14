<?php
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['REQUEST_METHOD'] = 'GET';
chdir(__DIR__ . '/..');
ob_start();
require_once 'index.php';
ob_end_clean();

$CI = &get_instance();
$CI->load->model('Results_model');

echo "Testing Assessment Structure Model...\n";

$initial = $CI->Results_model->get_assessment_structure();
echo "Initial: CA=" . $initial['max_ca'] . ", Exam=" . $initial['max_exam'] . ", Total=" . $initial['max_total'] . "\n";

$saved = $CI->Results_model->save_assessment_structure(array(
    'max_ca' => 40,
    'max_exam' => 60,
    'max_total' => 100
), 'test-user-id');

assert($saved, "Failed to save assessment structure");

$updated = $CI->Results_model->get_assessment_structure();
echo "Updated: CA=" . $updated['max_ca'] . ", Exam=" . $updated['max_exam'] . ", Total=" . $updated['max_total'] . "\n";
assert($updated['max_ca'] == 40, "max_ca should be 40");
assert($updated['max_exam'] == 60, "max_exam should be 60");
assert($updated['max_total'] == 100, "max_total should be 100");

// Restore standard 30/70/100
$CI->Results_model->save_assessment_structure(array(
    'max_ca' => 30,
    'max_exam' => 70,
    'max_total' => 100
), 'test-user-id');

$restored = $CI->Results_model->get_assessment_structure();
echo "Restored: CA=" . $restored['max_ca'] . ", Exam=" . $restored['max_exam'] . ", Total=" . $restored['max_total'] . "\n";
assert($restored['max_ca'] == 30, "max_ca should be restored to 30");
assert($restored['max_exam'] == 70, "max_exam should be restored to 70");

echo "[PASSED] Assessment Structure Model verified successfully!\n";


<?php
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['REQUEST_METHOD'] = 'GET';
chdir(__DIR__ . '/..');
ob_start();
require_once 'index.php';
ob_end_clean();

$CI = &get_instance();
$CI->load->library('academic_policy');

echo "Testing Academic Policy defaults...\n";
$settings = $CI->academic_policy->get_all_settings();
assert(!empty($settings['withdrawal_below_cgpa']), "withdrawal_below_cgpa should exist");
assert(!empty($settings['probation_upper_cgpa']), "probation_upper_cgpa should exist");
assert($CI->academic_policy->is_passing_grade('A') === true, "A is passing");
assert($CI->academic_policy->is_passing_grade('F') === false, "F is not passing");
assert($CI->academic_policy->is_passing_grade('ABS') === false, "ABS is not passing");
assert($CI->academic_policy->standing(0.8, 12, true) === 'WITHDRAWAL', "0.8 is withdrawal");
assert($CI->academic_policy->standing(1.2, 12, true) === 'PROBATION', "1.2 is probation");
assert($CI->academic_policy->standing(3.5, 12, true) === 'GOOD_STANDING', "3.5 is good standing");
assert($CI->academic_policy->standing(0.8, 12, false) === 'INCOMPLETE', "incomplete is not withdrawal");

echo "Academic Policy assertions passed!\n";

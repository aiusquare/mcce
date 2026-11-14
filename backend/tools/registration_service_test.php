<?php
/**
 * Standalone Unit Test for Registration_service Pure Functions
 * Tests policy definitions and the drop-allowed matrix without database dependencies.
 */

define('BASEPATH', __DIR__ . '/../');
require_once __DIR__ . '/../application/libraries/Registration_service.php';

$service = new Registration_service();
$all_passed = true;
$test_count = 0;
$pass_count = 0;

function assert_test($label, $actual, $expected) {
    global $test_count, $pass_count, $all_passed;
    $test_count++;
    if ($actual === $expected) {
        $pass_count++;
        echo sprintf("[PASS] Row %02d: %s\n", $test_count, $label);
    } else {
        $all_passed = false;
        echo sprintf("[FAIL] Row %02d: %s (Expected: %s, Got: %s)\n", 
            $test_count, 
            $label, 
            json_encode($expected), 
            json_encode($actual)
        );
    }
}

echo "========================================================\n";
echo " REGISTRATION SERVICE PURE FUNCTIONS SPECIFICATION TESTS\n";
echo "========================================================\n\n";

// --- Section 1: Policy Definitions Table ---
echo "--- Testing Policy Definitions ---\n";
$p_student = $service->policy('student');
assert_test("Policy student: Registration window enforce", $p_student['enforce_window'], true);
assert_test("Policy student: Credit load block",           $p_student['credit_load'], 'block');
assert_test("Policy student: Fee clearance enforce",       $p_student['enforce_fees'], true);
assert_test("Policy student: Approval needed",             $p_student['require_approval'], true);
assert_test("Policy student: Drop core rule",              $p_student['drop_core'], 'blocked');
assert_test("Policy student: Drop elective rule",          $p_student['drop_elective'], 'window_only');
assert_test("Policy student: Drop carryover rule",         $p_student['drop_carryover'], 'blocked');
assert_test("Policy student: Drop with score rule",        $p_student['drop_with_score'], 'blocked');

$p_admin = $service->policy('admin');
assert_test("Policy admin: Registration window skip",      $p_admin['enforce_window'], false);
assert_test("Policy admin: Credit load warn only",         $p_admin['credit_load'], 'warn');
assert_test("Policy admin: Fee clearance skip",            $p_admin['enforce_fees'], false);
assert_test("Policy admin: Approval auto",                 $p_admin['require_approval'], false);
assert_test("Policy admin: Drop core rule",                $p_admin['drop_core'], 'warn');
assert_test("Policy admin: Drop elective rule",            $p_admin['drop_elective'], 'allowed');
assert_test("Policy admin: Drop carryover rule",           $p_admin['drop_carryover'], 'reason_required');
assert_test("Policy admin: Drop with score rule",          $p_admin['drop_with_score'], 'blocked_unless_forced');

$p_legacy = $service->policy('legacy');
assert_test("Policy legacy: Registration window skip",     $p_legacy['enforce_window'], false);
assert_test("Policy legacy: Credit load skip",             $p_legacy['credit_load'], 'skip');
assert_test("Policy legacy: Fee clearance skip",           $p_legacy['enforce_fees'], false);
assert_test("Policy legacy: Approval auto",                $p_legacy['require_approval'], false);
assert_test("Policy legacy: Drop core rule",               $p_legacy['drop_core'], 'warn');
assert_test("Policy legacy: Drop elective rule",           $p_legacy['drop_elective'], 'allowed');
assert_test("Policy legacy: Drop carryover rule",          $p_legacy['drop_carryover'], 'reason_required');
assert_test("Policy legacy: Drop with score rule",         $p_legacy['drop_with_score'], 'blocked_unless_forced');

echo "\n--- Testing Drop Allowed Table Matrix ---\n";

// Drop core
$core_item = array('registration_type' => 'core');
$res = $service->check_drop_allowed($core_item, 'student');
assert_test("Drop core [student]: expect blocked", $res['action'], 'blocked');

$res = $service->check_drop_allowed($core_item, 'admin');
assert_test("Drop core [admin]: expect warn", $res['action'], 'warn');

$res = $service->check_drop_allowed($core_item, 'legacy');
assert_test("Drop core [legacy]: expect warn", $res['action'], 'warn');

// Drop elective (in window)
$elec_item = array('registration_type' => 'elective');
$res = $service->check_drop_allowed($elec_item, 'student', array('in_window' => true));
assert_test("Drop elective in window [student]: expect allowed", $res['action'], 'allowed');

$res = $service->check_drop_allowed($elec_item, 'admin', array('in_window' => true));
assert_test("Drop elective in window [admin]: expect allowed", $res['action'], 'allowed');

$res = $service->check_drop_allowed($elec_item, 'legacy', array('in_window' => true));
assert_test("Drop elective in window [legacy]: expect allowed", $res['action'], 'allowed');

// Drop elective (outside window)
$res = $service->check_drop_allowed($elec_item, 'student', array('in_window' => false));
assert_test("Drop elective outside window [student]: expect blocked", $res['action'], 'blocked');

$res = $service->check_drop_allowed($elec_item, 'admin', array('in_window' => false));
assert_test("Drop elective outside window [admin]: expect allowed", $res['action'], 'allowed');

$res = $service->check_drop_allowed($elec_item, 'legacy', array('in_window' => false));
assert_test("Drop elective outside window [legacy]: expect allowed", $res['action'], 'allowed');

// Drop carryover without reason
$co_item = array('registration_type' => 'carryover');
$res = $service->check_drop_allowed($co_item, 'student');
assert_test("Drop carryover without reason [student]: expect blocked", $res['action'], 'blocked');

$res = $service->check_drop_allowed($co_item, 'admin');
assert_test("Drop carryover without reason [admin]: expect blocked (reason_required)", $res['action'], 'blocked');
assert_test("Drop carryover without reason [admin]: reason_required is true", $res['reason_required'], true);

$res = $service->check_drop_allowed($co_item, 'legacy');
assert_test("Drop carryover without reason [legacy]: expect blocked (reason_required)", $res['action'], 'blocked');
assert_test("Drop carryover without reason [legacy]: reason_required is true", $res['reason_required'], true);

// Drop carryover with reason
$res = $service->check_drop_allowed($co_item, 'student', array('reason' => 'Duplicate entry'));
assert_test("Drop carryover with reason [student]: expect blocked", $res['action'], 'blocked');

$res = $service->check_drop_allowed($co_item, 'admin', array('reason' => 'Approved Senate waiver'));
assert_test("Drop carryover with reason [admin]: expect allowed", $res['action'], 'allowed');

$res = $service->check_drop_allowed($co_item, 'legacy', array('reason' => 'Legacy cohort harmonization'));
assert_test("Drop carryover with reason [legacy]: expect allowed", $res['action'], 'allowed');

// Drop with recorded score (unforced)
$scored_item = array('registration_type' => 'elective', 'has_score' => true);
$res = $service->check_drop_allowed($scored_item, 'student');
assert_test("Drop with score unforced [student]: expect blocked", $res['action'], 'blocked');

$res = $service->check_drop_allowed($scored_item, 'admin');
assert_test("Drop with score unforced [admin]: expect blocked", $res['action'], 'blocked');

$res = $service->check_drop_allowed($scored_item, 'legacy');
assert_test("Drop with score unforced [legacy]: expect blocked", $res['action'], 'blocked');

// Drop with recorded score (forced)
$res = $service->check_drop_allowed($scored_item, 'student', array('force' => true));
assert_test("Drop with score forced [student]: expect blocked (students cannot force)", $res['action'], 'blocked');

$res = $service->check_drop_allowed($scored_item, 'admin', array('force' => true));
assert_test("Drop with score forced [admin]: expect allowed", $res['action'], 'allowed');

$res = $service->check_drop_allowed($scored_item, 'legacy', array('force' => true));
assert_test("Drop with score forced [legacy]: expect allowed", $res['action'], 'allowed');

echo "\n========================================================\n";
echo sprintf("RESULTS: %d / %d tests passed.\n", $pass_count, $test_count);
echo "========================================================\n";

if ($all_passed) {
    echo "STATUS: ALL TESTS PASSED!\n";
    exit(0);
} else {
    echo "STATUS: SOME TESTS FAILED!\n";
    exit(1);
}


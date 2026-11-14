<?php
// Test script for Phase 6: Reconciliation Engine
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['REQUEST_METHOD'] = 'GET';
chdir(__DIR__ . '/..');
ob_start();
require_once 'index.php';
ob_end_clean();

echo "=======================================================\n";
echo "TESTING PHASE 6: RECONCILIATION ENGINE & DISCREPANCY CHECKS\n";
echo "=======================================================\n";

$CI =& get_instance();
$CI->load->model('Reconciliation_model');
$CI->load->model('Broadsheet_model');

// 1. Run reconciliation check on Case 1
echo "1. Testing Reconciliation_model::check on Case 1...\n";
$report = $CI->Reconciliation_model->check('sess-2021', 'sem-c1', 'prog-cs', 'Contact 1');
assert(isset($report['summary']), "summary exists");
assert(isset($report['summary']['total_issues']), "total_issues exists");
assert(isset($report['summary']['by_type']), "by_type exists");
assert(isset($report['issues']), "issues exists");

echo "  Total issues detected: {$report['summary']['total_issues']}\n";
echo "  By type: unregistered_score={$report['summary']['by_type']['unregistered_score']}, unscored_registration={$report['summary']['by_type']['unscored_registration']}, collisions={$report['summary']['by_type']['multiple_attempt_collision']}\n";
echo "  [OK] Reconciliation report structure verified.\n";

// 2. Test Broadsheet summary integration
echo "2. Testing Broadsheet summary reconciliation integration...\n";
$broadsheet = $CI->Broadsheet_model->generate('sess-2021', 'sem-c1', 'prog-cs', 'Contact 1');
assert(isset($broadsheet['context']['summary']['reconciliation']), "Reconciliation block exists in broadsheet summary");
$rec = $broadsheet['context']['summary']['reconciliation'];
assert(isset($rec['total_issues']), "total_issues exists in broadsheet summary");
assert(isset($rec['by_type']), "by_type exists in broadsheet summary");
echo "  Broadsheet summary reconciliation block verified: total={$rec['total_issues']}, clean=" . ($rec['is_clean'] ? 'YES' : 'NO') . "\n";
echo "  [OK] Broadsheet summary reconciliation integration verified.\n";

echo "=======================================================\n";
echo "SUCCESS: Phase 6 verified!\n";

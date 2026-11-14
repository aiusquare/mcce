<?php
// Test script for Phase 4 improvements: Broadsheet Engine Rebuild
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['REQUEST_METHOD'] = 'GET';
chdir(__DIR__ . '/..');
ob_start();
require_once 'index.php';
ob_end_clean();

echo "=======================================================\n";
echo "TESTING PHASE 4: BROADSHEET ENGINE REBUILD & SUMMARY\n";
echo "=======================================================\n";

$CI =& get_instance();
$CI->load->model('Broadsheet_model');

// 1. Test standard generation and summary structure
echo "1. Testing summary block structure on case 1...\n";
$res = $CI->Broadsheet_model->generate('sess-2021', 'sem-c1', 'prog-cs', 'Contact 1');
assert(isset($res['context']['summary']), "Summary exists in context");
$summary = $res['context']['summary'];

// Check backward-compatible counters
assert(isset($summary['total_students']), "total_students exists");
assert(isset($summary['total_passed']), "total_passed exists");
assert(isset($summary['total_carryover']), "total_carryover exists");
assert(isset($summary['total_probation']), "total_probation exists");
assert(isset($summary['total_withdrawn']), "total_withdrawn exists");
assert(isset($summary['total_incomplete']), "total_incomplete exists");
assert(isset($summary['total_good_standing']), "total_good_standing exists");

echo "  Summary counters: total={$summary['total_students']}, passed={$summary['total_passed']}, co={$summary['total_carryover']}, probation={$summary['total_probation']}, incomplete={$summary['total_incomplete']}\n";
echo "  [OK] Backward-compatible counters verified.\n";

// Check rich summary blocks
echo "2. Testing course_statistics, gpa_distribution, and lists...\n";
assert(!empty($summary['course_statistics']), "course_statistics is populated");
$first_cs = $summary['course_statistics'][0];
assert(isset($first_cs['course_code']), "course_code exists");
assert(isset($first_cs['pass_percentage']), "pass_percentage exists");
assert(isset($first_cs['grade_distribution']), "grade_distribution exists");
echo "  Course {$first_cs['course_code']}: sat={$first_cs['sat_count']}, pass={$first_cs['pass_count']}, pass_pct={$first_cs['pass_percentage']}%\n";

assert(!empty($summary['gpa_distribution']), "gpa_distribution is populated");
echo "  GPA bands count: " . count($summary['gpa_distribution']) . "\n";

assert(isset($summary['lists']['probation_list']), "probation_list exists");
assert(isset($summary['lists']['withdrawal_list']), "withdrawal_list exists");
assert(isset($summary['lists']['pass_list']), "pass_list exists");
assert(isset($summary['lists']['incomplete_list']), "incomplete_list exists");
echo "  Pass list count: " . count($summary['lists']['pass_list']) . "\n";
echo "  [OK] Rich summary blocks verified.\n";

// 3. Test entry_mode filtering on case 2 (Contact 2 has both DE and regular students)
echo "3. Testing server-side options: entry_mode filter...\n";
$all_c2 = $CI->Broadsheet_model->generate('sess-2021', 'sem-c2', 'prog-eap', 'Contact 2', ['entry_mode' => 'all']);
$de_only = $CI->Broadsheet_model->generate('sess-2021', 'sem-c2', 'prog-eap', 'Contact 2', ['entry_mode' => 'direct_entry']);
$reg_only = $CI->Broadsheet_model->generate('sess-2021', 'sem-c2', 'prog-eap', 'Contact 2', ['entry_mode' => 'regular']);

echo "  Total C2 students: " . count($all_c2['students']) . ", DE count: " . count($de_only['students']) . ", Regular count: " . count($reg_only['students']) . "\n";
assert(count($de_only['students']) + count($reg_only['students']) === count($all_c2['students']), "DE + Regular equals All");
echo "  [OK] entry_mode filter verified.\n";

// 4. Test search filter
echo "4. Testing server-side options: search filter...\n";
if (!empty($all_c2['students'])) {
    $first_matric = $all_c2['students'][0]['matric_number'];
    $search_res = $CI->Broadsheet_model->generate('sess-2021', 'sem-c2', 'prog-eap', 'Contact 2', ['search' => $first_matric]);
    assert(count($search_res['students']) >= 1, "Search returns matching student");
    assert($search_res['students'][0]['matric_number'] === $first_matric, "First match matches matric");
    echo "  [OK] search filter verified for matric {$first_matric}.\n";
}

echo "=======================================================\n";
echo "SUCCESS: Phase 4 verified!\n";

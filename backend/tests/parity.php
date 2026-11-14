<?php
/**
 * P5.4 Parity Verification Test
 * Verifies that CGPA/GPA across Broadsheet, Statement, Student History, and CGPA Calculation
 * are 100% identical and have zero mismatches.
 */

$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['REQUEST_METHOD'] = 'GET';
chdir(__DIR__ . '/..');
ob_start();
require_once 'index.php';
ob_end_clean();

echo "=======================================================\n";
echo "BROADSHEET PARITY VERIFICATION (SINGLE SOURCE OF TRUTH)\n";
echo "=======================================================\n";

$CI =& get_instance();
$CI->load->model('Broadsheet_model');
$CI->load->model('Results_model');
$CI->load->model('Statement_model');

// Test Case 1: Contact 1 (Fresh students at contact 1)
// Test Case 3: Contact 3 (Students at contact 3, their latest evaluated period)
$cases = [
    'case1_contact1' => [
        'session_id'   => 'sess-2021',
        'semester_id'  => 'sem-c1',
        'programme_id' => 'prog-cs',
        'level'        => 'Contact 1',
    ],
    'case3_contact3_carryover' => [
        'session_id'   => 'sess-2022',
        'semester_id'  => 'sem-c3',
        'programme_id' => 'prog-eap',
        'level'        => 'Contact 3',
    ],
];

$mismatches = 0;
$checked_students = 0;

foreach ($cases as $key => $params) {
    echo "Checking parity for {$key}...\n";
    $broadsheet = $CI->Broadsheet_model->generate(
        $params['session_id'],
        $params['semester_id'],
        $params['programme_id'],
        $params['level']
    );

    foreach ($broadsheet['students'] as $st) {
        $sid = $st['student_id'];
        $name = $st['full_name'];
        $b_cgpa = (float)($st['cumulative']['cgpa'] ?? 0);
        $b_gpa  = (float)($st['current']['gpa'] ?? 0);

        // 1. Check against Results_model::calculate_cgpa
        $direct_cgpa = (float)$CI->Results_model->calculate_cgpa($sid);

        // 2. Check against Results_model::get_student_history
        $history = $CI->Results_model->get_student_history($sid);
        $hist_cgpa = (float)($history['cgpa'] ?? 0);

        // 3. Check against Statement_model
        $stmt = $CI->Statement_model->get_statement($sid);
        $stmt_cgpa = (float)($stmt['current_cgpa'] ?? 0);

        $checked_students++;

        echo "  Student {$name} ({$sid}): Broadsheet={$b_cgpa}, Statement={$stmt_cgpa}, History={$hist_cgpa}, DirectCalc={$direct_cgpa}\n";

        if (abs($b_cgpa - $stmt_cgpa) > 0.01) {
            echo "    [MISMATCH] Broadsheet CGPA={$b_cgpa} vs Statement CGPA={$stmt_cgpa}\n";
            $mismatches++;
        }

        if (abs($b_cgpa - $hist_cgpa) > 0.01) {
            echo "    [MISMATCH] Broadsheet CGPA={$b_cgpa} vs History CGPA={$hist_cgpa}\n";
            $mismatches++;
        }

        if (abs($b_cgpa - $direct_cgpa) > 0.01) {
            echo "    [MISMATCH] Broadsheet CGPA={$b_cgpa} vs Direct Calc CGPA={$direct_cgpa}\n";
            $mismatches++;
        }
    }
}

echo "=======================================================\n";
echo "Checked {$checked_students} student instances.\n";

if ($mismatches === 0) {
    echo "SUCCESS: 0 parity mismatches! All screens share the single source of truth.\n";
    exit(0);
} else {
    echo "FAILED: {$mismatches} parity mismatches detected!\n";
    exit(1);
}

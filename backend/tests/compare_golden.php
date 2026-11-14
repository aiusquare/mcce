<?php
/**
 * P0.3 Golden Comparator
 * Compares current Broadsheet_model output against stored golden files.
 * Exit code 0 if 0 unexpected diffs; Exit code 1 if differences found.
 */

$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['REQUEST_METHOD'] = 'GET';
chdir(__DIR__ . '/..');
ob_start();
require_once 'index.php';
ob_end_clean();

$CI = &get_instance();
$CI->load->database();
$CI->load->model('Broadsheet_model');

$golden_dir = __DIR__ . '/golden';
if (!is_dir($golden_dir)) {
    die("ERROR: golden directory does not exist: {$golden_dir}\n");
}

$cases = [
    'case1_contact1' => [
        'session_id'   => 'sess-2021',
        'semester_id'  => 'sem-c1',
        'programme_id' => 'prog-cs',
        'level'        => 'Contact 1',
    ],
    'case2_contact2_de' => [
        'session_id'   => 'sess-2021',
        'semester_id'  => 'sem-c2',
        'programme_id' => 'prog-eap',
        'level'        => 'Contact 2',
    ],
    'case3_contact3_carryover' => [
        'session_id'   => 'sess-2022',
        'semester_id'  => 'sem-c3',
        'programme_id' => 'prog-eap',
        'level'        => 'Contact 3',
    ],
];

$total_diffs = 0;

echo "=======================================================\n";
echo "BROADSHEET GOLDEN COMPARISON\n";
echo "=======================================================\n";

foreach ($cases as $key => $params) {
    $golden_path = "{$golden_dir}/{$key}.json";
    if (!file_exists($golden_path)) {
        echo "[ERROR] Missing golden file: {$golden_path}\n";
        $total_diffs++;
        continue;
    }

    $golden = json_decode(file_get_contents($golden_path), true);
    $fresh = $CI->Broadsheet_model->generate(
        $params['session_id'],
        $params['semester_id'],
        $params['programme_id'],
        $params['level']
    );

    // Normalize volatile fields
    if (isset($fresh['context']['generated_at'])) {
        $fresh['context']['generated_at'] = 'NORMALIZED_TIMESTAMP';
    }
    if (isset($fresh['context']['computed_at'])) {
        $fresh['context']['computed_at'] = 'NORMALIZED_TIMESTAMP';
    }

    echo "Testing {$key}...\n";
    $case_diffs = 0;

    // Check course counts
    if (count($golden['current_courses']) !== count($fresh['current_courses'])) {
        echo "  [DIFF] current_courses count: golden=" . count($golden['current_courses']) . ", fresh=" . count($fresh['current_courses']) . "\n";
        $case_diffs++;
    }
    if (count($golden['carryover_courses']) !== count($fresh['carryover_courses'])) {
        echo "  [DIFF] carryover_courses count: golden=" . count($golden['carryover_courses']) . ", fresh=" . count($fresh['carryover_courses']) . "\n";
        $case_diffs++;
    }

    // Check students map
    $golden_students = [];
    foreach ($golden['students'] as $s) {
        $golden_students[$s['student_id']] = $s;
    }
    $fresh_students = [];
    foreach ($fresh['students'] as $s) {
        $fresh_students[$s['student_id']] = $s;
    }

    if (count($golden_students) !== count($fresh_students)) {
        echo "  [DIFF] students count: golden=" . count($golden_students) . ", fresh=" . count($fresh_students) . "\n";
        $case_diffs++;
    }

    foreach ($golden_students as $sid => $gs) {
        if (!isset($fresh_students[$sid])) {
            echo "  [DIFF] student {$sid} ({$gs['full_name']}) missing in fresh output!\n";
            $case_diffs++;
            continue;
        }

        $fs = $fresh_students[$sid];
        // Compare metrics
        foreach (['current', 'previous', 'cumulative'] as $block) {
            foreach (['registered_credits', 'earned_credits', 'quality_points', 'gpa', 'cgpa'] as $field) {
                $gv = $gs[$block][$field] ?? null;
                $fv = $fs[$block][$field] ?? null;
                if ((string)$gv !== (string)$fv) {
                    echo "  [DIFF] {$gs['full_name']} ({$sid}) {$block}.{$field}: golden='{$gv}', fresh='{$fv}'\n";
                    $case_diffs++;
                }
            }
        }

        // Compare remark
        if ($gs['remark'] !== $fs['remark']) {
            echo "  [DIFF] {$gs['full_name']} ({$sid}) remark: golden='{$gs['remark']}', fresh='{$fs['remark']}'\n";
            $case_diffs++;
        }
    }

    if ($case_diffs === 0) {
        echo "  [OK] 0 differences in {$key}.\n";
    } else {
        echo "  [FAIL] {$case_diffs} differences in {$key}!\n";
    }

    $total_diffs += $case_diffs;
}

echo "=======================================================\n";
if ($total_diffs === 0) {
    echo "SUCCESS: 0 diffs found across all cases!\n";
    exit(0);
} else {
    echo "FAILURE: {$total_diffs} total diffs detected.\n";
    exit(1);
}

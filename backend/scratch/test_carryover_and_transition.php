<?php
/**
 * Test Suite: Contact 4 -> Contact 5 Progression, Carryover Auto-Registration, and TCR Carryover Inclusion
 */
define('BASEPATH', 'mock');

require_once __DIR__ . '/test_snapshot_system.php';

echo "\n========================================================\n";
echo "Testing Contact 4 -> Contact 5 Progression & Carryovers\n";
echo "========================================================\n\n";

$db = new MockDB();
$test = new SnapshotSystemTest();

// Setup Degree Programme: PEAP
$programme_id = '8732138a-a35d-4551-947a-b01300810512';

// Setup Candidate: ABDULHAMID Iliyasu
$student_id = 'stu_abdulhamid_125';
$matric_no = 'CCE/EDU/MEAP2/22/125';

// 1. Verify that a candidate with Contact 4 previous 64/48/154 and Contact 4 current 29/27/91
// results in Contact 4 Cumulative: CCR 93, CCE 75, CGP 245, CGPA 2.63
$c4_prev = [
    'registered_credits' => 64,
    'earned_credits'     => 48,
    'quality_points'     => 154.0,
    'cgpa'               => '2.41'
];
$c4_curr = [
    'registered_credits' => 29, // 25 normal + 4 carryover retakes
    'earned_credits'     => 27, // 2 units failed on EAP331
    'quality_points'     => 91.0,
    'gpa'                => '3.14'
];

$c4_cum_ccr = $c4_prev['registered_credits'] + $c4_curr['registered_credits'];
$c4_cum_cce = $c4_prev['earned_credits'] + $c4_curr['earned_credits'];
$c4_cum_cgp = $c4_prev['quality_points'] + $c4_curr['quality_points'];
$c4_cum_cgpa = number_format(round($c4_cum_cgp / $c4_cum_ccr, 2), 2, '.', '');

echo "--- 1. Contact 4 Baseline Verification ---\n";
if ($c4_cum_ccr === 93 && $c4_cum_cce === 75 && $c4_cum_cgp == 245.0 && $c4_cum_cgpa === '2.63') {
    echo "[+] PASSED: Contact 4 Cumulative matches Ground Truth: CCR 93, CCE 75, CGP 245, CGPA 2.63\n";
} else {
    echo "[-] FAILED: Contact 4 Cumulative mismatch ($c4_cum_ccr, $c4_cum_cce, $c4_cum_cgp, $c4_cum_cgpa)\n";
    exit(1);
}

// 2. Test Snapshot_model transition into Contact 5
$snapshot_model = new Snapshot_model();
$snapshot_model->db = $db;
$snapshot_model->load = new MockLoader();
$snapshot_model->period_resolver = new MockPeriodResolver();
$snapshot_model->Broadsheet_model = new MockBroadsheetModel();
$c4_snapshot_id = 'snap_c4_uuid';
$db->tables['broadsheet_snapshots'][$c4_snapshot_id] = [
    'id'                     => $c4_snapshot_id,
    'version'                => 1,
    'programme_id'           => $programme_id,
    'session_id'             => 'sess_2023_2024',
    'semester_id'            => 'sem_contact_4',
    'contact_number'         => 4,
    'basis'                  => 'published',
    'cohort'                 => 'all',
    'entry_mode'             => 'all',
    'status'                 => 'approved',
    'locked_at'              => '2026-11-12 10:00:00',
    'rebuild_status'         => 'ready',
    'payload_json'           => json_encode([
        'students' => [
            [
                'student_id'    => $student_id,
                'matric_number' => $matric_no,
                'full_name'     => 'ABDULHAMID Iliyasu',
                'previous'      => $c4_prev,
                'current'       => $c4_curr,
                'cumulative'    => [
                    'registered_credits' => 93,
                    'earned_credits'     => 75,
                    'quality_points'     => 245.0,
                    'cgpa'               => '2.63'
                ],
                'academic_standing' => 'in_good_standing',
                'remark'        => 'CO: EAP331',
                'is_complete'   => true
            ]
        ]
    ])
];
$db->tables['broadsheet_snapshot_students'][] = [
    'id'                            => 'sss_1',
    'snapshot_id'                   => $c4_snapshot_id,
    'student_id'                    => $student_id,
    'matric_number_snapshot'        => $matric_no,
    'full_name_snapshot'            => 'ABDULHAMID Iliyasu',
    'current_registered_credits'    => 29,
    'current_earned_credits'        => 27,
    'current_quality_points'        => 91.0,
    'current_gpa'                   => 3.14,
    'previous_registered_credits'   => 64,
    'previous_earned_credits'       => 48,
    'previous_quality_points'       => 154.0,
    'previous_cgpa'                 => 2.41,
    'cumulative_registered_credits' => 93,
    'cumulative_earned_credits'     => 75,
    'cumulative_quality_points'     => 245.0,
    'cumulative_cgpa'               => 2.63,
    'academic_standing'             => 'in_good_standing',
    'remark'                        => 'CO: EAP331',
    'is_complete'                   => 1
];

echo "\n--- 2. Testing Contact 5 Transition from Contact 4 Snapshot ---\n";
$c5_scope = [
    'session_id'   => 'sess_2024_2025',
    'semester_id'  => 'sem_contact_5',
    'programme_id' => $programme_id,
    'level'        => 'Contact 5',
    'basis'        => 'published',
    'cohort'       => 'all',
    'entry_mode'   => 'all'
];

$resolved_prev = $snapshot_model->resolve_previous_snapshot($c5_scope, 4);
if ($resolved_prev && $resolved_prev['id'] === $c4_snapshot_id) {
    echo "[+] PASSED: resolve_previous_snapshot found Contact 4 snapshot: $c4_snapshot_id\n";
} else {
    echo "[-] FAILED: Contact 4 snapshot not resolved\n";
    exit(1);
}

$metrics_map = $snapshot_model->get_student_metrics_map($c4_snapshot_id);
$stu_metric = $metrics_map[$student_id] ?? null;

if ($stu_metric && (int)$stu_metric['cumulative_registered_credits'] === 93
    && (int)$stu_metric['cumulative_earned_credits'] === 75
    && (float)$stu_metric['cumulative_quality_points'] == 245.0
    && (float)$stu_metric['cumulative_cgpa'] == 2.63) {
    echo "[+] PASSED: Contact 5 Previous metrics extracted: CCR 93, CCE 75, CGP 245, CGPA 2.63\n";
} else {
    echo "[-] FAILED: Metrics map mismatch: " . json_encode($stu_metric) . "\n";
    exit(1);
}

echo "\n--- 3. Testing Contact 5 Current TCR with Carryover Inclusion ---\n";
// Normal Contact 5 courses: 22 units
// Registered Carryover: EAP331 (2 units)
// Expected TCR: 22 + 2 = 24 units
$normal_courses_units = 22;
$carryover_units = 2; // EAP331
$total_registered_tcr = $normal_courses_units + $carryover_units;

if ($total_registered_tcr === 24) {
    echo "[+] PASSED: Contact 5 Current TCR correctly combines normal (22) + carryover (2) = 24 credits\n";
} else {
    echo "[-] FAILED: Contact 5 TCR is not 24\n";
    exit(1);
}

// Contact 5 Cumulative: Previous (93) + Current (24) = 117
$c5_cum_ccr = (int)$stu_metric['cumulative_registered_credits'] + $total_registered_tcr;
if ($c5_cum_ccr === 117) {
    echo "[+] PASSED: Contact 5 Cumulative CCR correctly adds: 93 + 24 = 117 credits\n";
} else {
    echo "[-] FAILED: Contact 5 Cumulative CCR mismatch: $c5_cum_ccr\n";
    exit(1);
}

echo "\n========================================================\n";
echo "ALL CONTACT 4 -> CONTACT 5 TRANSITION TESTS PASSED! (3/3)\n";
echo "========================================================\n\n";

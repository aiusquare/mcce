<?php
/**
 * P0.2 Golden Generator
 * Runs Broadsheet_model->generate() for the 3 real baseline test cases
 * and stores JSON in backend/tests/golden/*.json.
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

$golden_dir = __DIR__ . '/golden';
if (!is_dir($golden_dir)) {
    mkdir($golden_dir, 0777, true);
}

echo "Generating golden snapshots...\n";
foreach ($cases as $key => $params) {
    echo " - Generating {$key}... ";
    $data = $CI->Broadsheet_model->generate(
        $params['session_id'],
        $params['semester_id'],
        $params['programme_id'],
        $params['level']
    );

    // Normalize volatile timestamps so comparisons are stable
    if (isset($data['context']['generated_at'])) {
        $data['context']['generated_at'] = 'NORMALIZED_TIMESTAMP';
    }
    if (isset($data['context']['computed_at'])) {
        $data['context']['computed_at'] = 'NORMALIZED_TIMESTAMP';
    }

    $out_file = "{$golden_dir}/{$key}.json";
    file_put_contents($out_file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    echo "Saved (" . count($data['students']) . " students, " . count($data['current_courses']) . " courses)\n";
}

echo "All golden snapshots generated in backend/tests/golden/!\n";

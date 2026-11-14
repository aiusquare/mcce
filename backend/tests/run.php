<?php
/**
 * Master Test Runner for Backend Test Suites
 */

echo "=======================================================\n";
echo "RUNNING MASLAHA TEST SUITE\n";
echo "=======================================================\n";

$tests = [
    'test_policy_api.php' => __DIR__ . '/test_policy_api.php',
    'test_assessment_structure.php' => __DIR__ . '/test_assessment_structure.php',
    'test_phase3.php' => __DIR__ . '/test_phase3.php',
    'test_phase4.php' => __DIR__ . '/test_phase4.php',
    'test_phase6.php' => __DIR__ . '/test_phase6.php',
    'test_phase8.php' => __DIR__ . '/test_phase8.php',
    'test_batch_registration_guard.php' => __DIR__ . '/test_batch_registration_guard.php',
    'test_production_duplication_scenarios.php' => __DIR__ . '/test_production_duplication_scenarios.php',
    'parity.php' => __DIR__ . '/parity.php',
    'compare_golden.php' => __DIR__ . '/compare_golden.php',
];

$all_passed = true;
foreach ($tests as $name => $path) {
    echo "Running test: {$name}...\n";
    passthru("php " . escapeshellarg($path), $exit_code);
    if ($exit_code !== 0) {
        $all_passed = false;
        echo "[FAILED] {$name} exited with code {$exit_code}\n";
    } else {
        echo "[PASSED] {$name}\n";
    }
}

echo "=======================================================\n";
if ($all_passed) {
    echo "ALL TESTS PASSED!\n";
    exit(0);
} else {
    echo "SOME TESTS FAILED!\n";
    exit(1);
}

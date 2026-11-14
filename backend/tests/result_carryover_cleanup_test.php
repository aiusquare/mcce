<?php

/**
 * Regression coverage for correcting a failed result to a passing score.
 */

define('BASEPATH', __DIR__ . DIRECTORY_SEPARATOR);

class CI_Model {}

class CarryoverCleanupFakeDatabase
{
    public $tables;
    private $wheres = array();
    private $where_ins = array();

    public function __construct()
    {
        $this->tables = array(
            'result_attempts' => array(
                array('id' => 'failed-attempt', 'grade' => 'C', 'total_score' => 56),
                array('id' => 'later-attempt', 'grade' => 'B', 'total_score' => 66),
            ),
            'carryover_corrections' => array(
                array('id' => 'generated-link', 'source_result_attempt_id' => 'failed-attempt', 'result_attempt_id' => 'later-attempt'),
                array('id' => 'unrelated-link', 'source_result_attempt_id' => 'other-attempt', 'result_attempt_id' => 'other-later-attempt'),
            ),
            'course_registration_items' => array(
                array('id' => 'generated-registration', 'origin_result_attempt_id' => 'failed-attempt', 'registration_type' => 'CARRYOVER', 'source' => 'AUTO'),
                array('id' => 'manual-carryover', 'origin_result_attempt_id' => 'failed-attempt', 'registration_type' => 'CARRYOVER', 'source' => 'MANUAL'),
                array('id' => 'manual-repeat', 'origin_result_attempt_id' => 'failed-attempt', 'registration_type' => 'REPEAT', 'source' => 'MANUAL'),
                array('id' => 'regular-registration', 'origin_result_attempt_id' => 'failed-attempt', 'registration_type' => 'core', 'source' => 'MANUAL'),
                array('id' => 'unrelated-carryover', 'origin_result_attempt_id' => 'other-attempt', 'registration_type' => 'CARRYOVER', 'source' => 'AUTO'),
            ),
        );
    }

    public function table_exists($table)
    {
        return array_key_exists($table, $this->tables);
    }

    public function field_exists($field, $table)
    {
        return $table === 'course_registration_items'
            && in_array($field, array('origin_result_attempt_id', 'source'), true);
    }

    public function where($field, $value)
    {
        $this->wheres[$field] = $value;
        return $this;
    }

    public function where_in($field, $values)
    {
        $this->where_ins[$field] = $values;
        return $this;
    }

    public function delete($table)
    {
        $this->tables[$table] = array_values(array_filter(
            $this->tables[$table],
            function ($row) {
                foreach ($this->wheres as $field => $value) {
                    if (($row[$field] ?? null) !== $value) {
                        return true;
                    }
                }
                foreach ($this->where_ins as $field => $values) {
                    if (!in_array($row[$field] ?? null, $values, true)) {
                        return true;
                    }
                }
                return false;
            }
        ));
        $this->wheres = array();
        $this->where_ins = array();
        return true;
    }
}

require dirname(__DIR__) . DIRECTORY_SEPARATOR . 'application' . DIRECTORY_SEPARATOR . 'models' . DIRECTORY_SEPARATOR . 'Results_model.php';

$reflection = new ReflectionClass('Results_model');
$model = $reflection->newInstanceWithoutConstructor();
$model->db = new CarryoverCleanupFakeDatabase();

if (!$reflection->hasMethod('remove_generated_carryover_history')) {
    fail_test('Results_model is missing remove_generated_carryover_history().');
}

$cleanup = $reflection->getMethod('remove_generated_carryover_history');
$cleanup->setAccessible(true);
$cleanup->invoke($model, 'failed-attempt');

assert_ids(
    'carryover corrections',
    $model->db->tables['carryover_corrections'],
    array('unrelated-link')
);
assert_ids(
    'course registration items',
    $model->db->tables['course_registration_items'],
    array('manual-carryover', 'manual-repeat', 'regular-registration', 'unrelated-carryover')
);
assert_ids(
    'result attempts',
    $model->db->tables['result_attempts'],
    array('failed-attempt', 'later-attempt')
);

echo "Result carryover cleanup regression test passed.\n";

function assert_ids($label, $rows, $expected_ids)
{
    $actual_ids = array_column($rows, 'id');
    sort($actual_ids);
    sort($expected_ids);
    if ($actual_ids !== $expected_ids) {
        fail_test($label . ' expected [' . implode(', ', $expected_ids) . '] but received [' . implode(', ', $actual_ids) . '].');
    }
}

function fail_test($message)
{
    fwrite(STDERR, "FAIL: {$message}\n");
    exit(1);
}

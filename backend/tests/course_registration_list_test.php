<?php

/**
 * Regression coverage for the admin registration list's optional period filters.
 *
 * The child process runs the real controller method with small CodeIgniter
 * boundary fakes. The fake database returns a registration only when the
 * controller applies exactly the filters implied by the request.
 */

if (isset($argv[1]) && strpos($argv[1], '--child=') === 0) {
    run_controller_child(substr($argv[1], strlen('--child=')));
    exit(0);
}

run_test('lists every period when session and semester are all', array(
    'session_id' => 'all',
    'semester_id' => 'all',
));

run_test('lists every period when session and semester are omitted', array());

run_test('lists every period when period values are empty', array(
    'session_id' => '',
    'semester_id' => '',
));

run_test('keeps programme and status filters in all-period mode', array(
    'session_id' => 'all',
    'semester_id' => 'all',
    'programme_id' => 'programme-1',
    'status' => 'submitted',
));

run_test('keeps exact period filtering when concrete values are supplied', array(
    'session_id' => 'session-2025',
    'semester_id' => 'semester-first',
));

run_test('treats zero-like period values as concrete filters', array(
    'session_id' => '0',
    'semester_id' => '0',
));

run_test('lists large result sets without a bulk admission ID lookup', array(
    'session_id' => 'all',
    'semester_id' => 'all',
    '_fixture_size' => 2000,
), 2000, 'MAT-0001');

echo "Course registration list regression tests passed.\n";

function run_test($name, $params, $expected_count = 1, $expected_matric_number = null)
{
    $payload = base64_encode(json_encode($params));
    $command = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__FILE__) . ' ' . escapeshellarg('--child=' . $payload);
    $lines = array();
    $exit_code = 0;
    exec($command, $lines, $exit_code);

    $raw = implode("\n", $lines);
    $response = json_decode($raw, true);

    if ($exit_code !== 0 || !is_array($response)) {
        fail_test($name, 'controller did not return valid JSON: ' . $raw);
    }

    if (($response['status'] ?? null) !== 'success') {
        fail_test($name, 'expected success, received: ' . $raw);
    }

    if (count($response['data'] ?? array()) !== $expected_count) {
        fail_test($name, 'expected ' . $expected_count . ' matching registrations, received: ' . $raw);
    }

    if ($expected_matric_number !== null
        && (($response['data'][0]['matric_number'] ?? null) !== $expected_matric_number)) {
        fail_test($name, 'expected matric number from the primary registration query, received: ' . $raw);
    }

    echo "PASS: {$name}\n";
}

function fail_test($name, $message)
{
    fwrite(STDERR, "FAIL: {$name} - {$message}\n");
    exit(1);
}

function run_controller_child($encoded_params)
{
    $params = json_decode(base64_decode($encoded_params), true);
    if (!is_array($params)) {
        fwrite(STDERR, "Invalid child parameters\n");
        exit(2);
    }

    define('BASEPATH', __DIR__ . DIRECTORY_SEPARATOR);

    class CI_Controller {}

    class RegistrationListFakeInput
    {
        private $params;
        private $authorization;

        public function __construct($params, $authorization)
        {
            $this->params = $params;
            $this->authorization = $authorization;
        }

        public function get($key, $xss_clean = false)
        {
            return array_key_exists($key, $this->params) ? $this->params[$key] : null;
        }

        public function get_request_header($name, $xss_clean = false)
        {
            return strtolower($name) === 'authorization' ? $this->authorization : null;
        }
    }

    class RegistrationListFakeConfig
    {
        public function item($key)
        {
            return null;
        }
    }

    class RegistrationListFakeQuery
    {
        private $rows;

        public function __construct($rows)
        {
            $this->rows = $rows;
        }

        public function result_array()
        {
            return $this->rows;
        }
    }

    class RegistrationListFakeDatabase
    {
        private $request_params;
        private $where = array();
        private $joined_admissions = false;

        public function __construct($request_params)
        {
            $this->request_params = $request_params;
        }

        public function select($fields) { return $this; }
        public function from($table) { return $this; }
        public function join($table, $condition, $type = '')
        {
            if ($table === 'admissions a') {
                $this->joined_admissions = true;
            }
            return $this;
        }
        public function order_by($field, $direction = '') { return $this; }

        public function where($field, $value = null)
        {
            $this->where[$field] = $value;
            return $this;
        }

        public function get($table = null)
        {
            $matches = $this->period_filter_matches('session_id')
                && $this->period_filter_matches('semester_id')
                && $this->optional_filter_matches('programme_id', 's.programme_id')
                && $this->optional_filter_matches('status', 'r.status');

            $rows = array();
            if ($matches) {
                $fixture_size = isset($this->request_params['_fixture_size'])
                    ? (int) $this->request_params['_fixture_size']
                    : 1;

                for ($i = 1; $i <= $fixture_size; $i++) {
                    $rows[] = array(
                        'id' => 'registration-' . $i,
                        'student_id' => 'student-' . $i,
                        'admission_id' => 'admission-' . $i,
                        'full_name' => 'Test Student ' . $i,
                        'programme_name' => 'Test Programme',
                        'status' => 'submitted',
                        'matric_number' => $this->joined_admissions ? sprintf('MAT-%04d', $i) : null,
                        'admission_number' => $this->joined_admissions ? sprintf('ADM-%04d', $i) : null,
                    );
                }
            }

            return new RegistrationListFakeQuery($rows);
        }

        public function where_in($field, $values)
        {
            if (count($values) > 100) {
                throw new RuntimeException('Oversized admission ID lookup attempted');
            }
            return $this;
        }

        public function table_exists($table)
        {
            return $table === 'admissions' && !empty($this->request_params['_fixture_size']);
        }

        private function period_filter_matches($name)
        {
            $request_value = $this->request_params[$name] ?? null;
            $where_key = 'r.' . $name;

            if ($request_value === null || $request_value === '' || strtolower((string) $request_value) === 'all') {
                return !array_key_exists($where_key, $this->where);
            }

            return array_key_exists($where_key, $this->where)
                && $this->where[$where_key] === $request_value;
        }

        private function optional_filter_matches($request_name, $where_key)
        {
            $request_value = $this->request_params[$request_name] ?? null;

            if ($request_value === null || $request_value === '') {
                return !array_key_exists($where_key, $this->where);
            }

            return array_key_exists($where_key, $this->where)
                && $this->where[$where_key] === $request_value;
        }
    }

    class RegistrationListFakeOutput
    {
        private $body = '';

        public function set_status_header($code) { return $this; }
        public function set_content_type($type) { return $this; }

        public function set_output($body)
        {
            $this->body = $body;
            return $this;
        }

        public function _display()
        {
            echo $this->body;
        }
    }

    require dirname(__DIR__) . DIRECTORY_SEPARATOR . 'application' . DIRECTORY_SEPARATOR . 'controllers' . DIRECTORY_SEPARATOR . 'Admin_course_registration.php';

    $token_payload = rtrim(strtr(base64_encode(json_encode(array('id' => 'admin-1'))), '+/', '-_'), '=');
    $signature = hash_hmac('sha256', $token_payload, 'aacas-local-admin-token-secret');
    $authorization = 'Bearer ' . $token_payload . '.' . $signature;

    $reflection = new ReflectionClass('Admin_course_registration');
    $controller = $reflection->newInstanceWithoutConstructor();
    $controller->input = new RegistrationListFakeInput($params, $authorization);
    $controller->config = new RegistrationListFakeConfig();
    $controller->db = new RegistrationListFakeDatabase($params);
    $controller->output = new RegistrationListFakeOutput();

    $_SERVER['REQUEST_METHOD'] = 'GET';
    $controller->get_registrations();
}

<?php
if (!defined('BASEPATH')) exit('No direct script access allowed');

class Salary extends CI_Controller {
    private $required_columns = array(
        'grade',
        'basic_salary',
        'housing_allowance',
        'transport_allowance',
        'utility_allowance',
        'employer_pension',
        'leave_allowance',
        'teaching_allowance'
    );
    private $updatable_columns = array(
        'grade',
        'basic_salary',
        'housing_allowance',
        'transport_allowance',
        'utility_allowance',
        'employer_pension',
        'leave_allowance',
        'teaching_allowance',
        'effective_from'
    );

    public function __construct()
    {
        parent::__construct();
        $this->load->database();
        $this->load->model('Salary_model');
    }

    public function list()
    {
        $this->send_cors_headers();
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            return $this->json_response(200, array('status' => 'success', 'message' => 'Preflight OK'));
        }

        // Order by grade then created date (effective_from does not exist on salary table)
        $this->db->order_by('grade', 'ASC');
        $this->db->order_by('created_at', 'DESC');
        $query = $this->db->get('salary');
        $rows = $query->result_array();

        return $this->json_response(200, array(
            'status' => 'success',
            'data' => $rows
        ));
    }

    public function export_csv()
    {
        $this->send_cors_headers();

        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            return $this->json_response(200, array('status' => 'success', 'message' => 'Preflight OK'));
        }

        // Force download as CSV/Excel
        header('Content-Type: application/vnd.ms-excel; charset=utf-8');
        header('Content-Disposition: attachment; filename="salary_table.csv"');
        header('Pragma: no-cache');
        header('Expires: 0');

        // Emit BOM so Excel opens UTF-8 correctly
        echo "\xEF\xBB\xBF";

        $query = $this->db->get('salary');
        $rows = $query->result_array();

        $out = fopen('php://output', 'w');
        // Header row
        fputcsv($out, array(
            'id',
            'grade',
            'basic_salary',
            'housing_allowance',
            'transport_allowance',
            'utility_allowance',
            'employer_pension',
            'leave_allowance',
            'teaching_allowance',
            'created_at',
            'created_by',
            'updated_at',
            'updated_by',
            'deleted_at',
            'deleted_by'
        ));

        foreach ($rows as $row) {
            fputcsv($out, array(
                $row['id'],
                $row['grade'],
                $row['basic_salary'],
                $row['housing_allowance'],
                $row['transport_allowance'],
                $row['utility_allowance'],
                $row['employer_pension'],
                $row['leave_allowance'],
                $row['teaching_allowance'],
                $row['created_at'],
                $row['created_by'],
                $row['updated_at'],
                $row['updated_by'],
                $row['deleted_at'],
                $row['deleted_by']
            ));
        }

        fclose($out);
        exit;
    }

    public function upload_csv()
    {
        $this->send_cors_headers();
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            return $this->json_response(200, array('status' => 'success', 'message' => 'Preflight OK'));
        }

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array(
                'status' => 'error',
                'message' => 'Method not allowed'
            ));
        }

        if (!isset($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => 'CSV file is required (form field name: file).'
            ));
        }

        $handle = fopen($_FILES['file']['tmp_name'], 'r');
        if (!$handle) {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => 'Unable to read uploaded CSV file.'
            ));
        }

        $header = fgetcsv($handle);
        if ($header === false) {
            fclose($handle);
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => 'CSV file is empty.'
            ));
        }

        $header_map = $this->normalize_header_map($header);
        $missing = array();
        foreach ($this->required_columns as $col) {
            if (!isset($header_map[$col])) {
                $missing[] = $col;
            }
        }
        if (!empty($missing)) {
            fclose($handle);
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => 'Missing required columns: ' . implode(', ', $missing)
            ));
        }

        $rows = array();
        $now = date('Y-m-d H:i:s');
        while (($data = fgetcsv($handle)) !== false) {
            if ($this->is_row_empty($data)) {
                continue;
            }

            $rows[] = array(
                'grade' => $this->string_value($data, $header_map, 'grade', null),
                'basic_salary' => $this->decimal_value($data, $header_map, 'basic_salary'),
                'housing_allowance' => $this->decimal_value($data, $header_map, 'housing_allowance'),
                'transport_allowance' => $this->decimal_value($data, $header_map, 'transport_allowance'),
                'utility_allowance' => $this->decimal_value($data, $header_map, 'utility_allowance'),
                'employer_pension' => $this->decimal_value($data, $header_map, 'employer_pension'),
                'leave_allowance' => $this->decimal_value($data, $header_map, 'leave_allowance'),
                'teaching_allowance' => $this->decimal_value($data, $header_map, 'teaching_allowance'),
                'created_at' => $this->string_value($data, $header_map, 'created_at', $now),
                'created_by' => $this->string_value($data, $header_map, 'created_by', null),
                'updated_at' => $this->string_value($data, $header_map, 'updated_at', null),
                'updated_by' => $this->string_value($data, $header_map, 'updated_by', null),
                'deleted_at' => $this->string_value($data, $header_map, 'deleted_at', null),
                'deleted_by' => $this->string_value($data, $header_map, 'deleted_by', null)
            );
        }
        fclose($handle);

        if (empty($rows)) {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => 'No data rows found in CSV.'
            ));
        }

        $inserted = $this->Salary_model->insert_batch($rows);
        if ($inserted <= 0) {
            return $this->json_response(500, array(
                'status' => 'error',
                'message' => 'Failed to insert salary records.'
            ));
        }

        return $this->json_response(201, array(
            'status' => 'success',
            'message' => 'Salary records imported successfully.',
            'data' => array('inserted' => $inserted)
        ));
    }

    public function update()
    {
        $this->send_cors_headers();
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            return $this->json_response(200, array('status' => 'success', 'message' => 'Preflight OK'));
        }

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        $input = json_decode($this->input->raw_input_stream, true);
        if (!is_array($input)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid JSON payload.'));
        }
        $id = isset($input['id']) ? (int)$input['id'] : 0;
        if ($id <= 0) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'id is required.'));
        }

        $data = array();
        foreach ($this->updatable_columns as $col) {
            if (array_key_exists($col, $input)) {
                if ($col === 'effective_from') {
                    $value = trim((string)$input[$col]);
                    if ($value !== '' && !$this->is_valid_date($value)) {
                        return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid effective_from. Use YYYY-MM-DD.'));
                    }
                    $data[$col] = $value === '' ? null : $value;
                } else {
                    $data[$col] = (float)$input[$col];
                }
            }
        }

        if (empty($data)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'No fields to update.'));
        }

        $data['updated_at'] = date('Y-m-d H:i:s');

        $updated = $this->Salary_model->update_by_id($id, $data);
        if (!$updated) {
            return $this->json_response(404, array('status' => 'error', 'message' => 'Salary record not found or not updated.'));
        }

        return $this->json_response(200, array('status' => 'success', 'message' => 'Salary record updated.'));
    }

    public function by_grade()
    {
        $this->send_cors_headers();
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            return $this->json_response(200, array('status' => 'success', 'message' => 'Preflight OK'));
        }
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        $grade = $this->input->get('grade');
        if (!$grade) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'grade is required' ));
        }

        $row = $this->Salary_model->get_by_grade($grade);
        if (!$row) {
            return $this->json_response(404, array('status' => 'error', 'message' => 'Grade not found' ));
        }

        return $this->json_response(200, array('status' => 'success', 'data' => $row));
    }

    private function normalize_header_map($header)
    {
        $map = array();
        foreach ($header as $index => $name) {
            $normalized = strtolower(trim($name));
            $normalized = str_replace(array(' ', '-'), '_', $normalized);
            $normalized = preg_replace('/[^a-z0-9_]/', '', $normalized);
            if ($normalized !== '') {
                $map[$normalized] = $index;
            }
        }
        return $map;
    }

    private function is_row_empty($row)
    {
        foreach ($row as $value) {
            if (trim((string)$value) !== '') {
                return false;
            }
        }
        return true;
    }

    private function decimal_value($row, $map, $key)
    {
        if (isset($map[$key])) {
            $value = trim((string)$row[$map[$key]]);
            return $value === '' ? 0.00 : (float)$value;
        }
        return 0.00;
    }

    private function string_value($row, $map, $key, $default)
    {
        if (isset($map[$key])) {
            $value = trim((string)$row[$map[$key]]);
            return $value === '' ? $default : $value;
        }
        return $default;
    }

    private function is_valid_date($value)
    {
        if (!is_string($value)) {
            return false;
        }
        return (bool)preg_match('/^\d{4}-\d{2}-\d{2}$/', $value);
    }

    private function json_response($status, $payload)
    {
        $this->send_cors_headers();
        $this->output
            ->set_status_header($status)
            ->set_content_type('application/json')
            ->set_output(json_encode($payload));
        return;
    }

    private function send_cors_headers()
    {
        header('Vary: Origin');
    }
}

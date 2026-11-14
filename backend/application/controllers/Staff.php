<?php
if (!defined('BASEPATH')) exit('No direct script access allowed');

class Staff extends CI_Controller {
    private $required_columns = array('staff_name', 'staff_id', 'staff_group', 'grade', 'rank', 'designation', 'division');
    private $updatable_columns = array(
        'staff_name', 'staff_id', 'staff_group', 'grade', 'rank', 'designation', 'division',
        'basic_salary', 'housing_allowance', 'transport_allowance', 'utility_allowance', 'employer_pension',
        'leave_allowance', 'teaching_allowance', 'arrears', 'penalty', 'paye', 'standing_order',
        'loan_repayment', 'cooperative_deduction'
    );

    public function __construct()
    {
        parent::__construct();
        $this->load->database();
        $this->load->model('Staff_model');
    }

    public function list()
    {
        $this->send_cors_headers();
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            return $this->json_response(200, array('status' => 'success', 'message' => 'Preflight OK'));
        }

        $this->db->order_by('created_at', 'DESC');
        $query = $this->db->get('staff');
        $rows = $query->result_array();

        return $this->json_response(200, array(
            'status' => 'success',
            'data' => $rows
        ));
    }

    public function update_effective()
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

        $staff_id = isset($input['staff_id']) ? trim((string)$input['staff_id']) : '';
        $staff_name = isset($input['staff_name']) ? trim((string)$input['staff_name']) : '';
        $effective_from = isset($input['effective_from']) ? trim((string)$input['effective_from']) : '';

        if ($staff_id === '' || $staff_name === '' || !$this->is_valid_date($effective_from)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'staff_id, staff_name and effective_from (YYYY-MM-DD) are required.'));
        }

        $row = array(
            'staff_id' => $staff_id,
            'staff_name' => $staff_name,
            'effective_from' => $effective_from,
            'created_at' => date('Y-m-d H:i:s')
        );

        foreach ($this->updatable_columns as $col) {
            if (array_key_exists($col, $input)) {
                $value = $input[$col];
                if (in_array($col, array('basic_salary','housing_allowance','transport_allowance','utility_allowance','employer_pension','leave_allowance','teaching_allowance','arrears','penalty','paye','standing_order','loan_repayment','cooperative_deduction'), true)) {
                    $row[$col] = $value === '' || $value === null ? null : (float)$value;
                } else {
                    $row[$col] = $value === '' ? null : trim((string)$value);
                }
            }
        }

        $inserted = $this->Staff_model->insert_history($row);
        if (!$inserted) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Failed to record staff update.'));
        }

        // Optionally update latest snapshot for convenience
        $snapshot = array();
        foreach (array('staff_name','staff_group','grade','rank','designation','division') as $col) {
            if (isset($row[$col])) {
                $snapshot[$col] = $row[$col];
            }
        }
        if (!empty($snapshot)) {
            $snapshot['updated_at'] = date('Y-m-d H:i:s');
            $this->Staff_model->update_by_staff_id($staff_id, $snapshot);
        }

        return $this->json_response(201, array('status' => 'success', 'message' => 'Staff update recorded with effectation date.'));
    }

    public function history()
    {
        $this->send_cors_headers();
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            return $this->json_response(200, array('status' => 'success', 'message' => 'Preflight OK'));
        }

        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        $staff_id = $this->input->get('staff_id');
        $rows = $this->Staff_model->list_history($staff_id ? trim($staff_id) : null);

        return $this->json_response(200, array('status' => 'success', 'data' => $rows));
    }

    public function upload_csv()
    {
        $this->send_cors_headers();
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            return $this->json_response(200, array('status' => 'success', 'message' => 'Preflight OK'));
        }

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!isset($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'CSV file is required (form field name: file).'));
        }

        $handle = fopen($_FILES['file']['tmp_name'], 'r');
        if (!$handle) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Unable to read uploaded CSV file.' ));
        }

        $header = fgetcsv($handle);
        if ($header === false) {
            fclose($handle);
            return $this->json_response(400, array('status' => 'error', 'message' => 'CSV file is empty.'));
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
            return $this->json_response(400, array('status' => 'error', 'message' => 'Missing required columns: ' . implode(', ', $missing)));
        }

        $rows = array();
        $now = date('Y-m-d H:i:s');
        while (($data = fgetcsv($handle)) !== false) {
            if ($this->is_row_empty($data)) {
                continue;
            }

            $rows[] = array(
                'staff_name' => $this->string_value($data, $header_map, 'staff_name', ''),
                'staff_id' => $this->string_value($data, $header_map, 'staff_id', ''),
                'staff_group' => $this->string_value($data, $header_map, 'staff_group', ''),
                'grade' => $this->string_value($data, $header_map, 'grade', null),
                'rank' => $this->string_value($data, $header_map, 'rank', null),
                'designation' => $this->string_value($data, $header_map, 'designation', null),
                'division' => $this->string_value($data, $header_map, 'division', null),
                'created_at' => $this->string_value($data, $header_map, 'created_at', $now),
                'updated_at' => $this->string_value($data, $header_map, 'updated_at', null),
                'updated_by' => $this->string_value($data, $header_map, 'updated_by', null),
                'deleted_at' => $this->string_value($data, $header_map, 'deleted_at', null),
                'deleted_by' => $this->string_value($data, $header_map, 'deleted_by', null)
            );
        }
        fclose($handle);

        if (empty($rows)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'No data rows found in CSV.'));
        }

        $inserted = $this->Staff_model->insert_batch($rows);
        if ($inserted <= 0) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Failed to insert staff records.'));
        }

        return $this->json_response(201, array(
            'status' => 'success',
            'message' => 'Staff records imported successfully.',
            'data' => array('inserted' => $inserted)
        ));
    }

    public function export_csv()
    {
        $this->send_cors_headers();

        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            return $this->json_response(200, array('status' => 'success', 'message' => 'Preflight OK'));
        }

        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        header('Content-Type: application/vnd.ms-excel; charset=utf-8');
        header('Content-Disposition: attachment; filename="staff.csv"');
        header('Pragma: no-cache');
        header('Expires: 0');

        echo "\xEF\xBB\xBF";

        $query = $this->db->get('staff');
        $rows = $query->result_array();

        $out = fopen('php://output', 'w');
        fputcsv($out, array(
            'id',
            'staff_name',
            'staff_id',
            'staff_group',
            'grade',
            'rank',
            'designation',
            'division',
            'created_at',
            'updated_at',
            'updated_by',
            'deleted_at',
            'deleted_by'
        ));

        foreach ($rows as $row) {
            fputcsv($out, array(
                $row['id'],
                $row['staff_name'],
                $row['staff_id'],
                $row['staff_group'],
                $row['grade'],
                $row['rank'],
                $row['designation'],
                $row['division'],
                $row['created_at'],
                $row['updated_at'],
                $row['updated_by'],
                $row['deleted_at'],
                $row['deleted_by']
            ));
        }

        fclose($out);
        exit;
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

    private function string_value($row, $map, $key, $default)
    {
        if (isset($map[$key])) {
            $value = trim((string)$row[$map[$key]]);
            return $value === '' ? $default : $value;
        }
        return $default;
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

    private function is_valid_date($value)
    {
        if (!is_string($value)) {
            return false;
        }
        return (bool)preg_match('/^\d{4}-\d{2}-\d{2}$/', $value);
    }
}

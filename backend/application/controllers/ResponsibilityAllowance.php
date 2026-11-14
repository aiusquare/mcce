<?php
if (!defined('BASEPATH')) exit('No direct script access allowed');

class ResponsibilityAllowance extends CI_Controller {
    // Only three columns allowed in the CSV: staff_group, group_code, amount
    private $required_columns = array('staff_group', 'group_code', 'amount');

    public function __construct()
    {
        parent::__construct();
        $this->load->database();
        $this->load->model('ResponsibilityAllowance_model');
    }

    public function upload_csv()
    {
        $this->send_cors_headers();
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            return $this->json_response(200, array('status' => 'success', 'message' => 'Preflight OK'));
        }

        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
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
                'staff_group' => $this->string_value($data, $header_map, 'staff_group', ''),
                'group_code' => $this->string_value($data, $header_map, 'group_code', ''),
                'amount' => $this->decimal_value($data, $header_map, 'amount'),
                'created_at' => $now
            );
        }
        fclose($handle);

        if (empty($rows)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'No data rows found in CSV.'));
        }

        $inserted = $this->ResponsibilityAllowance_model->insert_batch($rows);
        if ($inserted <= 0) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Failed to insert responsibility allowance records.'));
        }

        return $this->json_response(201, array(
            'status' => 'success',
            'message' => 'Responsibility allowance records imported successfully.',
            'data' => array('inserted' => $inserted)
        ));
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

    private function json_response($status, $payload)
    {
        $this->send_cors_headers();
        $this->output
            ->set_status_header($status)
            ->set_content_type('application/json')
            ->set_output(json_encode($payload));
        return;
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
        header('Content-Disposition: attachment; filename="responsibility_allowance.csv"');
        header('Pragma: no-cache');
        header('Expires: 0');

        echo "\xEF\xBB\xBF";

        $query = $this->db->get('responsibility_allowance');
        $rows = $query->result_array();

        $out = fopen('php://output', 'w');
        fputcsv($out, array(
            'staff_group',
            'group_code',
            'amount'
        ));

        foreach ($rows as $row) {
            fputcsv($out, array(
                $row['staff_group'],
                isset($row['group_code']) ? $row['group_code'] : '',
                $row['amount']
            ));
        }

        fclose($out);
        exit;
    }

    private function send_cors_headers()
    {
        header('Vary: Origin');
    }
}

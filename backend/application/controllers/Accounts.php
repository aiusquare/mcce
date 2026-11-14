<?php
if (!defined('BASEPATH')) exit('No direct script access allowed');

class Accounts extends CI_Controller {
    public function __construct()
    {
        parent::__construct();
        $this->load->database();
        $this->load->model('AccountGroup_model');
        $this->load->model('ControlAccount_model');
        $this->load->model('Account_model');
    }

    public function groups()
    {
        $this->send_cors_headers();
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            return $this->json_response(200, array('status' => 'success', 'message' => 'Preflight OK'));
        }
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $rows = $this->AccountGroup_model->all();
        return $this->json_response(200, array('status' => 'success', 'data' => $rows));
    }

    public function controls()
    {
        $this->send_cors_headers();
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            return $this->json_response(200, array('status' => 'success', 'message' => 'Preflight OK'));
        }
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $groupId = (int)$this->input->get('group_id');
        if ($groupId <= 0) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'group_id is required'));
        }
        $rows = $this->ControlAccount_model->by_group($groupId);
        return $this->json_response(200, array('status' => 'success', 'data' => $rows));
    }

    public function list()
    {
        $this->send_cors_headers();
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            return $this->json_response(200, array('status' => 'success', 'message' => 'Preflight OK'));
        }
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $rows = $this->Account_model->list_all();
        return $this->json_response(200, array('status' => 'success', 'data' => $rows));
    }

    public function find()
    {
        $this->send_cors_headers();
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            return $this->json_response(200, array('status' => 'success', 'message' => 'Preflight OK'));
        }
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        $acct = trim((string)$this->input->get('account_number'));
        if ($acct === '') {
            return $this->json_response(400, array('status' => 'error', 'message' => 'account_number is required'));
        }

        $row = $this->Account_model->find_by_number($acct);
        if (!$row) {
            return $this->json_response(404, array('status' => 'error', 'message' => 'Account not found'));
        }

        return $this->json_response(200, array('status' => 'success', 'data' => $row));
    }

    public function create_control()
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
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid JSON payload'));
        }

        $groupId = isset($input['account_group_id']) ? (int)$input['account_group_id'] : 0;
        $code = isset($input['code']) ? trim((string)$input['code']) : '';
        $name = isset($input['name']) ? trim((string)$input['name']) : '';

        if ($groupId <= 0 || $name === '') {
            return $this->json_response(400, array('status' => 'error', 'message' => 'account_group_id and name are required'));
        }

        $result = $this->ControlAccount_model->create($groupId, $code, $name);
        if (isset($result['error'])) {
            return $this->json_response(400, array('status' => 'error', 'message' => $result['error']));
        }

        return $this->json_response(201, array('status' => 'success', 'data' => $result));
    }

    public function create()
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
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid JSON payload'));
        }

        $groupId = isset($input['account_group_id']) ? (int)$input['account_group_id'] : 0;
        $controlId = isset($input['control_account_id']) ? (int)$input['control_account_id'] : 0;
        $name = isset($input['name']) ? trim((string)$input['name']) : '';
        $accountType = isset($input['account_type']) ? trim((string)$input['account_type']) : '';

        if ($groupId <= 0 || $controlId <= 0 || $name === '' || $accountType === '') {
            return $this->json_response(400, array('status' => 'error', 'message' => 'account_group_id, control_account_id, name, account_type are required'));
        }

        $result = $this->Account_model->create($groupId, $controlId, $name, $accountType);
        if (isset($result['error'])) {
            return $this->json_response(400, array('status' => 'error', 'message' => $result['error']));
        }

        return $this->json_response(201, array('status' => 'success', 'data' => $result));
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

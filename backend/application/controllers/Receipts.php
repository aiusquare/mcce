<?php
if (!defined('BASEPATH')) exit('No direct script access allowed');

class Receipts extends CI_Controller {
    public function __construct()
    {
        parent::__construct();
        $this->load->database();
        $this->load->model('Receipt_model');
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

        $rows = $this->Receipt_model->list_all();
        return $this->json_response(200, array('status' => 'success', 'data' => $rows));
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

        $result = $this->Receipt_model->create($input);
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

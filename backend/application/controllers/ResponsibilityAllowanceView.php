<?php
if (!defined('BASEPATH')) exit('No direct script access allowed');

class ResponsibilityAllowanceView extends CI_Controller {
    public function __construct()
    {
        parent::__construct();
        $this->load->database();
    }

    public function list()
    {
        $this->send_cors_headers();
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            return $this->json_response(200, array('status' => 'success', 'message' => 'Preflight OK'));
        }

        $query = $this->db->get('responsibility_allowance');
        $rows = $query->result_array();

        // Limit exposed fields to the three user-facing columns
        $trimmed = array();
        foreach ($rows as $row) {
            $trimmed[] = array(
                'staff_group' => isset($row['staff_group']) ? $row['staff_group'] : null,
                'group_code' => isset($row['group_code']) ? $row['group_code'] : null,
                'amount' => isset($row['amount']) ? $row['amount'] : null,
            );
        }

        return $this->json_response(200, array(
            'status' => 'success',
            'data' => $trimmed
        ));
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

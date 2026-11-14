<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Public_fees extends CI_Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->load->database();
        $this->load->model('Fee_model');
    }

    public function session_fee_settings()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->respond(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        $reference = $this->input->get('session_id', true);
        if (!$reference) {
            $reference = $this->input->get('session', true);
        }
        $setting = $this->Fee_model->get_public_session_fee_setting($reference);
        if (!$setting) {
            return $this->respond(404, array('status' => 'error', 'message' => 'No active fee setting is configured for this academic session.'));
        }

        return $this->respond(200, array('status' => 'success', 'data' => $setting));
    }

    private function respond($status, $payload)
    {
        return $this->output
            ->set_status_header($status)
            ->set_content_type('application/json')
            ->set_output(json_encode($payload));
    }
}

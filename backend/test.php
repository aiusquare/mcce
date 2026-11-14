<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Admin_carryover_sync extends CI_Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->load->database();
        $this->load->model('Outstanding_course_model');
        $this->load->model('Carryover_sync_model');
    }

    private function token_secret()
    {
        $key = $this->config->item('encryption_key');
        return $key ? $key : 'aacas-local-admin-token-secret';
    }

    private function require_login()
    {
        $authorization = $this->input->get_request_header('Authorization', true);
        if (!$authorization && isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $authorization = $_SERVER['HTTP_AUTHORIZATION'];
        }
        if (!$authorization && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $authorization = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        }
        if (!$authorization || stripos($authorization, 'Bearer ') !== 0) {
            $this->json_response(401, array('status' => 'error', 'message' => 'Unauthorized'));
        }

        $token = trim(substr($authorization, 7));
        $parts = explode('.', $token);
        if (count($parts) !== 2) {
            $this->json_response(401, array('status' => 'error', 'message' => 'Invalid token format'));
        }

        $payloadPart = $parts[0];
        $signature = $parts[1];
        $expectedSignature = hash_hmac('sha256', $payloadPart, $this->token_secret());
        if (!hash_equals($expectedSignature, $signature)) {
            $this->json_response(401, array('status' => 'error', 'message' => 'Invalid token signature'));
        }

        $payloadJson = base64_decode(strtr($payloadPart, '-_', '+/'));
        $user = json_decode($payloadJson, true);
        
        if (!$user) {
            $this->json_response(401, array('status' => 'error', 'message' => 'Invalid or expired token'));
        }
        return $user;
    }

    private function json_response($code, $data)
    {
        $this->output
            ->set_status_header($code)
            ->set_content_type('application/json')
            ->set_output(json_encode($data))
            ->_display();
        exit;
    }

    public function preview()
    {
        $payload = json_decode(file_get_contents('php://input'), true);
        if (isset($payload['session_id'])) $payload['session_id'] = $this->resolve_session_id($payload['session_id']);
        if (isset($payload['semester_id'])) $payload['semester_id'] = $this->resolve_semester_id($payload['semester_id']);

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();
        $payload = json_decode(file_get_contents('php://input'), true);

        $student_id = $payload['student_id'] ?? null;
        $session_id = $payload['session_id'] ?? null;
        $semester_id = $payload['semester_id'] ?? null;

        if (!$student_id || !$session_id || !$semester_id) {
            return $this->json_response(400, array('status' => 'error', 'error' => 'student_id, session_id, and semester_id are required'));
        }

        try {
            $preview = $this->Carryover_sync_model->preview_sync($student_id, $session_id, $semester_id);
            return $this->json_response(200, array('status' => 'success', 'data' => $preview));
        } catch (Exception $e) {
            return $this->json_response(500, array('status' => 'error', 'error' => $e->getMessage()));
        }
    }

    public function commit()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();
        $payload = json_decode(file_get_contents('php://input'), true);

        $student_id = $payload['student_id'] ?? null;
        $session_id = $payload['session_id'] ?? null;
        $semester_id = $payload['semester_id'] ?? null;

        if (!$student_id || !$session_id || !$semester_id) {
            return $this->json_response(400, array('status' => 'error', 'error' => 'student_id, session_id, and semester_id are required'));
        }

        try {
            $result = $this->Carryover_sync_model->commit_sync($student_id, $session_id, $semester_id);
            return $this->json_response(200, array('status' => 'success', 'data' => $result));
        } catch (Exception $e) {
            return $this->json_response(500, array('status' => 'error', 'error' => $e->getMessage()));
        }
    }

    public function bulk_preview()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();
        $payload = json_decode(file_get_contents('php://input'), true);

        $programme_id = $payload['programme_id'] ?? null;
        $entry_session = $payload['entry_session'] ?? null;
        $session_id = $payload['session_id'] ?? null;
        $semester_id = $payload['semester_id'] ?? null;

        if (!$programme_id || !$session_id || !$semester_id) {
            return $this->json_response(400, array('status' => 'error', 'error' => 'programme_id, session_id, and semester_id are required'));
        }

        try {
            $prog = $this->db->get_where('programmes', ['id' => $programme_id])->row_array();
            $department_id = $prog ? $prog['department_id'] : null;

            $this->db->select('s.id, u.full_name, ad.matric_number, ad.admission_number');
            $this->db->from('students s');
            $this->db->join('users u', 'u.id = s.user_id', 'left');
            $this->db->join('admissions ad', 'ad.id = s.admission_id', 'left');
            
            if ($entry_session && $entry_session !== 'all') {
                $this->db->where('s.session_name', $entry_session);
            }
            if ($department_id) {
                $this->db->where('s.department_id', $department_id);
            } else {
                $this->db->where('s.programme_id', $programme_id);
            }
            
            $students = $this->db->get()->result_array();

            $bulk_preview = [
                'students_affected' => count($students),
                'to_add' => [],
                'to_remove' => [],
                'conflicts' => [],
                'to_keep' => []
            ];

            foreach ($students as $st) {
                $preview = $this->Carryover_sync_model->preview_sync($st['id'], $session_id, $semester_id);
                
                foreach ($preview['to_add'] as $item) {
                    $item['student_id'] = $st['matric_number'] ?: $st['admission_number'];
                    $bulk_preview['to_add'][] = $item;
                }
                foreach ($preview['to_remove'] as $item) {
                    $item['student_id'] = $st['matric_number'] ?: $st['admission_number'];
                    $bulk_preview['to_remove'][] = $item;
                }
                foreach ($preview['conflicts'] as $item) {
                    $item['student_id'] = $st['matric_number'] ?: $st['admission_number'];
                    $bulk_preview['conflicts'][] = $item;
                }
                foreach ($preview['to_keep'] as $item) {
                    $item['student_id'] = $st['matric_number'] ?: $st['admission_number'];
                    $bulk_preview['to_keep'][] = $item;
                }
            }

            return $this->json_response(200, array('status' => 'success', 'data' => $bulk_preview));
        } catch (Exception $e) {
            return $this->json_response(500, array('status' => 'error', 'error' => $e->getMessage()));
        }
    }

    public function bulk_commit()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();
        $payload = json_decode(file_get_contents('php://input'), true);

        $programme_id = $payload['programme_id'] ?? null;
        $entry_session = $payload['entry_session'] ?? null;
        $session_id = $payload['session_id'] ?? null;
        $semester_id = $payload['semester_id'] ?? null;

        if (!$programme_id || !$session_id || !$semester_id) {
            return $this->json_response(400, array('status' => 'error', 'error' => 'programme_id, session_id, and semester_id are required'));
        }

        try {
            $prog = $this->db->get_where('programmes', ['id' => $programme_id])->row_array();
            $department_id = $prog ? $prog['department_id'] : null;

            $this->db->select('id');
            $this->db->from('students');
            
            if ($entry_session && $entry_session !== 'all') {
                $this->db->where('session_name', $entry_session);
            }
            if ($department_id) {
                $this->db->where('department_id', $department_id);
            } else {
                $this->db->where('programme_id', $programme_id);
            }
            
            $students = $this->db->get()->result_array();

            $processed = 0;
            $errors = 0;

            foreach ($students as $st) {
                try {
                    $this->Carryover_sync_model->commit_sync($st['id'], $session_id, $semester_id);
                    $processed++;
                } catch (Exception $e) {
                    $errors++;
                }
            }

            return $this->json_response(200, array(
                'status' => 'success', 
                'message' => "Bulk sync completed. Processed: $processed, Errors: $errors",
                'data' => ['processed' => $processed, 'errors' => $errors]
            ));
        } catch (Exception $e) {
            return $this->json_response(500, array('status' => 'error', 'error' => $e->getMessage()));
        }
    }
}


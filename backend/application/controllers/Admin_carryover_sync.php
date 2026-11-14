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
        if (empty($user['id']) && !empty($user['sub'])) {
            $user['id'] = $user['sub'];
        }
        return $user;
    }

    private function require_admin()
    {
        $user = $this->require_login();
        $user_id = isset($user['id']) ? $user['id'] : (isset($user['sub']) ? $user['sub'] : null);
        if (!$user_id) {
            $this->json_response(401, array('status' => 'error', 'message' => 'Invalid user identity'));
        }

        // 1. Verify token expiry if exp claim exists
        if (isset($user['exp']) && time() > (int)$user['exp']) {
            $this->json_response(401, array('status' => 'error', 'message' => 'Token expired. Please login again.'));
        }

        // 2. Reject if this user is a student (has a student record and no admin roles)
        $is_student = $this->db->get_where('students', array('user_id' => $user_id), 1)->row_array();
        if ($is_student) {
            $has_admin_role = false;
            if ($this->db->table_exists('user_roles') && $this->db->table_exists('roles')) {
                $this->db->select('r.slug, r.name');
                $this->db->from('user_roles ur');
                $this->db->join('roles r', 'r.id = ur.role_id');
                $this->db->where('ur.user_id', $user_id);
                $this->db->where('r.is_active', 1);
                $roles = $this->db->get()->result_array();
                foreach ($roles as $r) {
                    $slug = strtolower($r['slug'] ?? $r['name'] ?? '');
                    if (strpos($slug, 'exam') !== false || in_array($slug, array('super_admin', 'administrator', 'admin', 'registry', 'exam', 'exams_officer', 'exam_officer', 'finance', 'staff', 'lecturer'))) {
                        $has_admin_role = true;
                        break;
                    }
                }
            }
            if (!$has_admin_role) {
                $this->json_response(403, array('status' => 'error', 'message' => 'Access denied: Administrative privileges required.'));
            }
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

    private function resolve_session_id($session_val)
    {
        if (!$session_val) return null;
        $sess_row = $this->db->get_where('academic_sessions', array('id' => $session_val), 1)->row_array();
        if ($sess_row) return $sess_row['id'];
        $sess_row = $this->db->get_where('academic_sessions', array('name' => $session_val), 1)->row_array();
        return $sess_row ? $sess_row['id'] : $session_val;
    }

    private function resolve_semester_id($semester_val)
    {
        if (!$semester_val) return null;
        $sem_row = $this->db->get_where('semesters', array('id' => $semester_val), 1)->row_array();
        if ($sem_row) return $sem_row['id'];
        
        $lookup_name = $semester_val;
        if (strtolower($lookup_name) === 'first') $lookup_name = 'First Semester';
        if (strtolower($lookup_name) === 'second') $lookup_name = 'Second Semester';
        
        $sem_row = $this->db->get_where('semesters', array('name' => $lookup_name), 1)->row_array();
        return $sem_row ? $sem_row['id'] : $semester_val;
    }

    public function preview()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_admin();
        $payload = json_decode(file_get_contents('php://input'), true);

        $student_id = $payload['student_id'] ?? null;
        $session_id = $this->resolve_session_id($payload['session_id'] ?? null);
        $semester_id = $this->resolve_semester_id($payload['semester_id'] ?? null);

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
        $user = $this->require_admin();
        $payload = json_decode(file_get_contents('php://input'), true);

        $student_id = $payload['student_id'] ?? null;
        $session_id = $this->resolve_session_id($payload['session_id'] ?? null);
        $semester_id = $this->resolve_semester_id($payload['semester_id'] ?? null);

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
        $user = $this->require_admin();
        $payload = json_decode(file_get_contents('php://input'), true);

        $programme_id = $payload['programme_id'] ?? null;
        $entry_session = $payload['entry_session'] ?? null;
        $level = $payload['level'] ?? null;
        $session_id = $this->resolve_session_id($payload['session_id'] ?? null);
        $semester_id = $this->resolve_semester_id($payload['semester_id'] ?? null);

        if (!$programme_id || !$session_id || !$semester_id) {
            return $this->json_response(400, array('status' => 'error', 'error' => 'programme_id, session_id, and semester_id are required'));
        }

        try {
            $prog = $this->db->get_where('programmes', ['id' => $programme_id])->row_array();
            $department_id = $prog ? $prog['department_id'] : null;

            $has_st_entry = $this->db->field_exists('entry_mode', 'students');
            $has_adm_entry = $this->db->table_exists('admissions') && $this->db->field_exists('entry_mode', 'admissions');
            $has_adm_mode = $this->db->table_exists('admissions') && $this->db->field_exists('mode_of_entry', 'admissions');
            $has_st_level = $this->db->field_exists('level', 'students');

            $select_fields = 'DISTINCT s.id, s.current_level, u.full_name, ad.matric_number, ad.admission_number';
            if ($has_st_entry) {
                $select_fields .= ', s.entry_mode';
            } elseif ($has_adm_entry) {
                $select_fields .= ', ad.entry_mode';
            } elseif ($has_adm_mode) {
                $select_fields .= ', ad.mode_of_entry as entry_mode';
            }
            if ($has_st_level) {
                $select_fields .= ', s.level';
            }

            $this->db->select($select_fields, false);
            $this->db->from('students s');
            $this->db->join('users u', 'u.id = s.user_id', 'left');
            $this->db->join('admissions ad', 'ad.id = s.admission_id', 'left');

            $has_acad_sess = $this->db->field_exists('academic_session_id', 'course_registrations');
            $sess_cond_cr = $has_acad_sess
                ? "(cr.academic_session_id = " . $this->db->escape($session_id) . " OR cr.session_id = " . $this->db->escape($session_id) . ")"
                : "cr.session_id = " . $this->db->escape($session_id);

            $this->db->join('course_registrations cr', "cr.student_id = s.id AND {$sess_cond_cr}", 'left');

            $has_rb_acad = $this->db->table_exists('result_batches') && $this->db->field_exists('academic_session_id', 'result_batches');
            $sess_cond_rb = $has_rb_acad
                ? "(rb.academic_session_id = " . $this->db->escape($session_id) . " OR rb.session_id = " . $this->db->escape($session_id) . ")"
                : "rb.session_id = " . $this->db->escape($session_id);

            $this->db->join('result_attempts ra', "ra.student_id = s.id AND ra.status = 'active'", 'left');
            $this->db->join('result_batches rb', "rb.id = ra.batch_id AND {$sess_cond_rb}", 'left');

            $this->db->where('s.programme_id', $programme_id);
            
            if ($entry_session && $entry_session !== 'all') {
                $this->db->group_start();
                if ($this->db->field_exists('session_name', 'students')) {
                    $this->db->where('s.session_name', $entry_session);
                    $this->db->or_like('s.session_name', $entry_session);
                }
                if ($this->db->field_exists('entry_session_id', 'students')) {
                    $this->db->or_where('s.entry_session_id', $entry_session);
                }
                $this->db->group_end();
            }
            if (!empty($level) && $level !== 'all') {
                $this->db->group_start();
                $this->db->where('s.current_level', $level);
                $this->db->or_where('cr.level', $level);
                $this->db->or_where('cr.semester_id', $semester_id);
                $this->db->or_where('rb.level', $level);
                $this->db->or_where('rb.semester_id', $semester_id);
                if ($has_st_level) {
                    $this->db->or_where('s.level', $level);
                }
                $this->db->group_end();
            }
            $this->db->where('s.programme_id', $programme_id);
            
            $students = $this->db->get()->result_array();

            $bulk_preview = [
                'students_affected' => count($students),
                'to_add' => [],
                'to_remove' => [],
                'conflicts' => [],
                'to_keep' => [],
                'debug' => null
            ];

            foreach ($students as $index => $st) {
                // DEBUG LOGIC FOR THE FIRST STUDENT
                if ($index === 0) {
                    $debug_info = [
                        'student_id' => $st['id'],
                        'matric' => $st['matric_number'],
                        'target_session' => $session_id,
                        'target_semester' => $semester_id,
                    ];
                    
                    // Fetch all historical results directly to see what exists
                    $sql_debug = "
                        SELECT a.grade, a.status as attempt_status, b.status as batch_status, 
                               sess.name as session_name, sem.name as semester_name, c.code
                        FROM result_attempts a
                        JOIN result_batches b ON b.id = a.batch_id
                        JOIN courses c ON c.id = b.course_id
                        LEFT JOIN academic_sessions sess ON sess.id = COALESCE(NULLIF(b.academic_session_id, ''), b.session_id)
                        LEFT JOIN semesters sem ON sem.id = b.semester_id
                        WHERE a.student_id = ?
                    ";
                    $debug_info['raw_history'] = $this->db->query($sql_debug, [$st['id']])->result_array();
                    
                    // Fetch what the model thinks is outstanding
                    $debug_info['model_outstanding'] = $this->Outstanding_course_model->get_outstanding_courses_before($st['id'], $session_id, $semester_id);
                    
                    $debug_info['schema'] = $this->db->list_fields('course_registration_items');

                    $bulk_preview['debug'] = $debug_info;
                }

                $preview = $this->Carryover_sync_model->preview_sync($st['id'], $session_id, $semester_id);
                
                $meta = [
                    'student_db_id' => $st['id'],
                    'student_id' => $st['matric_number'] ?: $st['admission_number'],
                    'matric_number' => $st['matric_number'] ?: $st['admission_number'],
                    'student_name' => $st['full_name'] ?: 'Unknown Student',
                    'entry_mode' => $st['entry_mode'] ?? 'fresh',
                    'current_level' => $st['current_level'] ?? ($st['level'] ?? '')
                ];

                foreach ($preview['to_add'] as $item) {
                    $bulk_preview['to_add'][] = array_merge($item, $meta);
                }
                foreach ($preview['to_remove'] as $item) {
                    $bulk_preview['to_remove'][] = array_merge($item, $meta);
                }
                foreach ($preview['conflicts'] as $item) {
                    $bulk_preview['conflicts'][] = array_merge($item, $meta);
                }
                foreach ($preview['to_keep'] as $item) {
                    $bulk_preview['to_keep'][] = array_merge($item, $meta);
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
        $user = $this->require_admin();
        $payload = json_decode(file_get_contents('php://input'), true);

        $programme_id = $payload['programme_id'] ?? null;
        $entry_session = $payload['entry_session'] ?? null;
        $level = $payload['level'] ?? null;
        $session_id = $this->resolve_session_id($payload['session_id'] ?? null);
        $semester_id = $this->resolve_semester_id($payload['semester_id'] ?? null);

        if (!$programme_id || !$session_id || !$semester_id) {
            return $this->json_response(400, array('status' => 'error', 'error' => 'programme_id, session_id, and semester_id are required'));
        }

        try {
            $has_st_level = $this->db->field_exists('level', 'students');

            $this->db->select('DISTINCT s.id', false);
            $this->db->from('students s');

            $has_acad_sess = $this->db->field_exists('academic_session_id', 'course_registrations');
            $sess_cond_cr = $has_acad_sess
                ? "(cr.academic_session_id = " . $this->db->escape($session_id) . " OR cr.session_id = " . $this->db->escape($session_id) . ")"
                : "cr.session_id = " . $this->db->escape($session_id);

            $this->db->join('course_registrations cr', "cr.student_id = s.id AND {$sess_cond_cr}", 'left');

            $has_rb_acad = $this->db->table_exists('result_batches') && $this->db->field_exists('academic_session_id', 'result_batches');
            $sess_cond_rb = $has_rb_acad
                ? "(rb.academic_session_id = " . $this->db->escape($session_id) . " OR rb.session_id = " . $this->db->escape($session_id) . ")"
                : "rb.session_id = " . $this->db->escape($session_id);

            $this->db->join('result_attempts ra', "ra.student_id = s.id AND ra.status = 'active'", 'left');
            $this->db->join('result_batches rb', "rb.id = ra.batch_id AND {$sess_cond_rb}", 'left');
            
            if ($entry_session && $entry_session !== 'all') {
                $this->db->group_start();
                if ($this->db->field_exists('session_name', 'students')) {
                    $this->db->where('s.session_name', $entry_session);
                    $this->db->or_like('s.session_name', $entry_session);
                }
                if ($this->db->field_exists('entry_session_id', 'students')) {
                    $this->db->or_where('s.entry_session_id', $entry_session);
                }
                $this->db->group_end();
            }
            if (!empty($level) && $level !== 'all') {
                $this->db->group_start();
                $this->db->where('s.current_level', $level);
                $this->db->or_where('cr.level', $level);
                $this->db->or_where('cr.semester_id', $semester_id);
                $this->db->or_where('rb.level', $level);
                $this->db->or_where('rb.semester_id', $semester_id);
                if ($has_st_level) {
                    $this->db->or_where('s.level', $level);
                }
                $this->db->group_end();
            }
            $this->db->where('s.programme_id', $programme_id);
            
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
                'data' => ['students_processed' => $processed, 'errors' => $errors]
            ));
        } catch (Exception $e) {
            return $this->json_response(500, array('status' => 'error', 'error' => $e->getMessage()));
        }
    }
}

<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Admin_results extends CI_Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->load->model('Results_model');
        // Require auth
        $this->load->library('session');
        // We assume an authentication helper/library exists. For now, we simulate the `json_response` and auth.
        // Assuming require_login() or similar exists in a core controller, but CI3 doesn't have BaseController by default.
        // We will mimic how Admin.php does it.
    }

    private function token_secret()
    {
        $key = $this->config->item('encryption_key');
        return $key ? $key : 'aacas-local-admin-token-secret';
    }

    private function user_from_bearer_token()
    {
        $authorization = $this->input->get_request_header('Authorization', true);
        if (!$authorization && isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $authorization = $_SERVER['HTTP_AUTHORIZATION'];
        }
        if (!$authorization && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $authorization = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        }
        if (!$authorization || stripos($authorization, 'Bearer ') !== 0) {
            return null;
        }

        $token = trim(substr($authorization, 7));
        $parts = explode('.', $token);
        if (count($parts) !== 2) {
            return null;
        }

        $payloadPart = $parts[0];
        $signature = $parts[1];
        $expectedSignature = hash_hmac('sha256', $payloadPart, $this->token_secret());
        if (!hash_equals($expectedSignature, $signature)) {
            return null;
        }

        $payloadJson = base64_decode(strtr($payloadPart, '-_', '+/'));
        $payload = json_decode($payloadJson, true);
        if (!is_array($payload) || empty($payload['sub']) || empty($payload['exp']) || time() > (int) $payload['exp']) {
            return null;
        }

        $this->load->model('User_model');
        $user = $this->User_model->find_by_id($payload['sub']);
        if (!$user || !empty($user['deleted_at']) || (isset($user['status']) && $user['status'] !== 'active')) {
            return null;
        }

        return $user;
    }

    private function require_login()
    {
        if ($this->session->userdata('user_id') && $this->session->userdata('logged_in')) {
            return array(
                'id' => $this->session->userdata('user_id'),
                'email' => $this->session->userdata('email')
            );
        }

        $user = $this->user_from_bearer_token();
        if ($user) {
            return $user;
        }

        $this->json_response(401, array(
            'status' => 'error',
            'message' => 'Authentication required.'
        ));
        exit;
    }

    private function is_exam_or_super_admin($user)
    {
        if (!empty($user['is_super_admin'])) {
            return true;
        }
        $email = isset($user['email']) ? strtolower(trim((string) $user['email'])) : '';
        if (in_array($email, array('superadmin@mcce.edu.ng', 'superadmin@aacas.edu.ng'), true)) {
            return true;
        }
        if (!empty($user['id']) && $this->db->table_exists('user_roles') && $this->db->table_exists('roles')) {
            $this->db->select('r.name, r.description');
            if ($this->db->field_exists('slug', 'roles')) {
                $this->db->select('r.slug');
            }
            $this->db->from('user_roles ur');
            $this->db->join('roles r', 'r.id = ur.role_id');
            $this->db->where('ur.user_id', $user['id']);
            $this->db->where('r.is_active', 1);
            $roles = $this->db->get()->result_array();
            foreach ($roles as $r) {
                $name = strtolower($r['name'] ?? '');
                $slug = strtolower($r['slug'] ?? '');
                if (strpos($name, 'exam') !== false || strpos($slug, 'exam') !== false || strpos($name, 'admin') !== false || strpos($slug, 'admin') !== false) {
                    return true;
                }
            }
        }
        return false;
    }

    private function json_response($status, $payload)
    {
        $json = json_encode($payload);
        if ($json !== false) {
            $json = str_replace(array("\xEF\xBF\xBD", "\u{FFFD}", "\\ufffd", "\\uFFFD", "\xE2\x80\x99", "\xE2\x80\x98", 'â€™', 'â€˜', '`', 'Â´'), "'", $json);
        }
        $this->output
            ->set_status_header($status)
            ->set_content_type('application/json')
            ->set_output($json);
    }

    public function get_batches()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();
        
        $filters = array(
            'session_id' => $this->input->get('session_id', true),
            'semester_id' => $this->input->get('semester_id', true),
            'programme_id' => $this->input->get('programme_id', true),
            'level' => $this->input->get('level', true),
            'status' => $this->input->get('status', true),
        );
        
        $batches = $this->Results_model->get_batches($filters);
        
        return $this->json_response(200, array('status' => 'success', 'data' => $batches));
    }

    public function create_batch()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();
        
        $payload = json_decode($this->input->raw_input_stream, true);
        
        $this->load->model('Courses_model');
        $semester_input = $payload['semester_id'] ?? null;
        $resolved_semester_id = $semester_input ? $this->Courses_model->resolve_semester($semester_input) : null;

        $dept_id = !empty($payload['department_id']) && $payload['department_id'] !== 'all' ? trim($payload['department_id']) : null;
        $prog_id = !empty($payload['programme_id']) && $payload['programme_id'] !== 'all' ? trim($payload['programme_id']) : null;
        $lect_id = !empty($payload['lecturer_id']) && $payload['lecturer_id'] !== 'all' ? trim($payload['lecturer_id']) : null;
        $level   = !empty($payload['level']) && $payload['level'] !== 'all' ? trim($payload['level']) : null;

        // If department_id not supplied, resolve from programme
        if (!$dept_id && $prog_id) {
            $prog = $this->db->get_where('programmes', array('id' => $prog_id))->row_array();
            if ($prog && !empty($prog['department_id'])) {
                $dept_id = $prog['department_id'];
            }
        }

        // Validate foreign keys against their parent tables so empty strings or invalid IDs never violate FK constraints
        if ($dept_id) {
            $dept_row = $this->db->get_where('departments', array('id' => $dept_id))->row_array();
            if (!$dept_row) {
                $dept_id = null;
            }
        } else {
            $dept_id = null;
        }

        if ($prog_id) {
            $prog_row = $this->db->get_where('programmes', array('id' => $prog_id))->row_array();
            if (!$prog_row) {
                $prog_id = null;
            }
        } else {
            $prog_id = null;
        }

        if ($lect_id && $this->db->table_exists('users')) {
            $lect_row = $this->db->get_where('users', array('id' => $lect_id))->row_array();
            if (!$lect_row) {
                $lect_id = null;
            }
        } else {
            $lect_id = null;
        }

        // If level not set, resolve from semester if it has Contact
        if (!$level && $resolved_semester_id) {
            $sem = $this->db->get_where('semesters', array('id' => $resolved_semester_id))->row_array();
            if ($sem && stripos($sem['name'], 'Contact') !== false) {
                $level = $sem['name'];
            }
        }
        if (!$level && !empty($semester_input) && stripos($semester_input, 'Contact') !== false) {
            $level = $semester_input;
        }

        $data = array(
            'session_id'    => $payload['session_id'] ?? null,
            'semester_id'   => $resolved_semester_id,
            'department_id' => $dept_id,
            'programme_id'  => $prog_id,
            'level'         => $level,
            'course_id'     => $payload['course_id'] ?? null,
            'lecturer_id'   => $lect_id,
            'created_by'    => $user['id']
        );
        
        if (!$data['session_id'] || !$data['semester_id'] || !$data['course_id']) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Missing required fields'));
        }

        // Result batches use an academic-session ID, never a free-form year
        // label. This validation also protects databases that do not yet have
        // foreign keys on result_batches.
        $session = $this->db->get_where('academic_sessions', array('id' => $data['session_id']), 1)->row_array();
        if (!$session) {
            return $this->json_response(422, array('status' => 'error', 'message' => 'Selected academic session does not exist.'));
        }
        if ($this->db->field_exists('academic_session_id', 'result_batches')) {
            $data['academic_session_id'] = $session['id'];
        }

        // Rule 1: No course result batch can be created if it has 0 registered students
        $reg_count = $this->Results_model->count_registered_students_for_batch($data);
        if ($reg_count <= 0) {
            return $this->json_response(400, array(
                'status'  => 'error',
                'message' => 'Cannot create result batch: No registered students found for this course in the selected session and semester/contact. Only courses with registered students can have result batches created.'
            ));
        }
        
        // Check for duplicates to prevent multiple batches for the same configuration
        if ($this->db->field_exists('academic_session_id', 'result_batches')) {
            $this->db->group_start();
            $this->db->where('academic_session_id', $session['id']);
            $this->db->or_group_start();
            $this->db->group_start();
            $this->db->where('academic_session_id IS NULL', null, false);
            $this->db->or_where('academic_session_id', '');
            $this->db->group_end();
            $this->db->where('session_id', $data['session_id']);
            $this->db->group_end();
            $this->db->group_end();
        } else {
            $this->db->where('session_id', $data['session_id']);
        }
        $this->db->where('semester_id', $data['semester_id']);
        $this->db->where('course_id', $data['course_id']);

        if (!empty($data['programme_id'])) {
            $this->db->where('programme_id', $data['programme_id']);
        } else {
            $this->db->group_start();
            $this->db->where('programme_id IS NULL', null, false);
            $this->db->or_where('programme_id', '');
            $this->db->group_end();
        }

        if (!empty($data['department_id'])) {
            $this->db->where('department_id', $data['department_id']);
        } else {
            $this->db->group_start();
            $this->db->where('department_id IS NULL', null, false);
            $this->db->or_where('department_id', '');
            $this->db->group_end();
        }

        if (!empty($data['level'])) {
            $this->db->where('level', $data['level']);
        } else {
            $this->db->group_start();
            $this->db->where('level IS NULL', null, false);
            $this->db->or_where('level', '');
            $this->db->group_end();
        }

        $existing = $this->db->get('result_batches')->row_array();

        if ($existing) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'A result batch for this course and configuration already exists.'));
        }

        $batch_id = $this->Results_model->create_batch($data);
        if (!$batch_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Failed to create result batch. Ensure registered students exist.'));
        }
        return $this->json_response(200, array('status' => 'success', 'message' => 'Batch created', 'data' => array('id' => $batch_id)));
    }

    public function update_batch_status()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();
        
        $payload = json_decode($this->input->raw_input_stream, true);
        $batch_id = $payload['batch_id'] ?? null;
        $batch_ids = $payload['batch_ids'] ?? ($batch_id ? array($batch_id) : array());
        $status = $payload['status'] ?? null;
        
        if (empty($batch_ids) || !$status) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Missing batch_id(s) or status'));
        }
        
        $valid_statuses = ['draft', 'submitted', 'approved', 'published', 'withheld'];
        if (!in_array($status, $valid_statuses)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid status'));
        }
        
        $count = 0;
        foreach ($batch_ids as $bid) {
            if ($this->Results_model->update_batch_status($bid, $status, $user['id'])) {
                $count++;
            }
        }
        return $this->json_response(200, array('status' => 'success', 'message' => "Updated status of {$count} batch(es) to {$status}"));
    }

    public function delete_batch()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();
        
        $batch_id = $this->input->get('batch_id', true);
        if (!$batch_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Missing batch_id'));
        }

        $batch = $this->Results_model->get_batch_by_id($batch_id);
        if (!$batch) {
            return $this->json_response(404, array('status' => 'error', 'message' => 'Batch not found'));
        }

        // Safety: Only allow deleting batches that are in draft mode
        if ($batch['status'] !== 'draft' && $batch['status'] !== 'returned') {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Only draft or returned batches can be deleted'));
        }

        $success = $this->Results_model->delete_batch($batch_id);
        if ($success) {
            return $this->json_response(200, array('status' => 'success', 'message' => 'Batch deleted successfully'));
        } else {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Failed to delete batch'));
        }
    }

    public function get_attempts()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();
        
        $batch_id = $this->input->get('batch_id', true);
        if (!$batch_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Missing batch_id'));
        }
        
        $attempts = $this->Results_model->get_attempts_by_batch($batch_id);
        
        return $this->json_response(200, array('status' => 'success', 'data' => $attempts));
    }

    public function save_attempts()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();
        
        $payload = json_decode($this->input->raw_input_stream, true);
        $batch_id = $payload['batch_id'] ?? null;
        $attempts = $payload['attempts'] ?? null; // array of { student_id, ca_score, exam_score }
        
        if (!$batch_id || !is_array($attempts)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Missing batch_id or attempts payload'));
        }
        
        // Ensure batch is in draft or submitted state for editing. (If approved, need special permission).
        $batch = $this->Results_model->get_batch_by_id($batch_id);
        if (!$batch) {
            return $this->json_response(404, array('status' => 'error', 'message' => 'Batch not found'));
        }
        
        if (in_array($batch['status'], ['approved', 'published'])) {
            // Check for special correction permission (super admin or exams officer)
            if (!$user['is_super_admin'] && !$this->is_exam_or_super_admin($user)) {
                return $this->json_response(403, array('status' => 'error', 'message' => 'Cannot edit approved or published results without special authorization.'));
            }
        }
        
        $success = $this->Results_model->save_attempts($batch_id, $attempts, $user['id']);
        
        if ($success) {
            return $this->json_response(200, array('status' => 'success', 'message' => 'Results saved successfully'));
        } else {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Failed to save results'));
        }
    }

    public function get_gpa()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();
        
        $student_id = $this->input->get('student_id', true);
        $session_id = $this->input->get('session_id', true);
        $semester_id = $this->input->get('semester_id', true);
        
        if (!$student_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'student_id required'));
        }
        
        $gpa = 0.0;
        if ($session_id && $semester_id) {
            $gpa = $this->Results_model->calculate_gpa($student_id, $session_id, $semester_id);
        }
        
        $cgpa = $this->Results_model->calculate_cgpa($student_id);
        
        return $this->json_response(200, array('status' => 'success', 'data' => array(
            'gpa' => $gpa,
            'cgpa' => $cgpa
        )));
    }
    
    public function get_grading_scheme()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();
        
        $scheme = $this->Results_model->get_active_grading_scheme();
        return $this->json_response(200, array('status' => 'success', 'data' => $scheme));
    }
    
    public function save_grading_scheme()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();
        $payload = json_decode($this->input->raw_input_stream, true);
        
        $name = isset($payload['name']) ? $payload['name'] : 'Standard Grading Scheme';
        $ranges = isset($payload['ranges']) ? $payload['ranges'] : array();
        
        if (empty($ranges)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Grading ranges are required'));
        }
        
        $success = $this->Results_model->save_grading_scheme($name, $ranges, $user['id']);
        
        if ($success) {
            return $this->json_response(200, array('status' => 'success', 'message' => 'Grading scheme updated successfully'));
        } else {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Failed to update grading scheme'));
        }
    }

    public function recalculate_all_grades() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();
        $this->Results_model->recalculate_all_grades();
        return $this->json_response(200, array('status' => 'success', 'message' => 'All institutional grades recalculated successfully'));
    }
    
    public function policy()
    {
        $this->load->library('academic_policy');
        $user = $this->require_login();

        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $settings = $this->academic_policy->get_all_settings();
            $scale = $this->academic_policy->grade_scale();
            return $this->json_response(200, array(
                'status' => 'success',
                'data' => array(
                    'settings' => $settings,
                    'grading_scale' => $scale,
                )
            ));
        }

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $payload = json_decode($this->input->raw_input_stream, true);
            if (!is_array($payload)) {
                $payload = $this->input->post();
            }
            if (empty($payload)) {
                return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid or empty settings payload'));
            }

            // Validation: probation_upper > withdrawal_below
            $with_below = isset($payload['withdrawal_below_cgpa']) ? (float)$payload['withdrawal_below_cgpa'] : (float)$this->academic_policy->get_setting('withdrawal_below_cgpa');
            $prob_upper = isset($payload['probation_upper_cgpa']) ? (float)$payload['probation_upper_cgpa'] : (float)$this->academic_policy->get_setting('probation_upper_cgpa');

            if ($prob_upper <= $with_below) {
                return $this->json_response(400, array('status' => 'error', 'message' => 'probation_upper_cgpa must be strictly greater than withdrawal_below_cgpa'));
            }

            if (isset($payload['classification_bands'])) {
                $bands = is_string($payload['classification_bands']) ? json_decode($payload['classification_bands'], true) : $payload['classification_bands'];
                if (!is_array($bands) || empty($bands)) {
                    return $this->json_response(400, array('status' => 'error', 'message' => 'classification_bands must be a valid array'));
                }
            }

            $saved = $this->academic_policy->set_settings($payload, $user['id'] ?? null);
            if ($saved) {
                return $this->json_response(200, array('status' => 'success', 'message' => 'Academic policy settings updated successfully', 'data' => $this->academic_policy->get_all_settings()));
            } else {
                return $this->json_response(500, array('status' => 'error', 'message' => 'Failed to save settings'));
            }
        }

        return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
    }

    public function get_assessment_structure()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();
        
        $structure = $this->Results_model->get_assessment_structure();
        return $this->json_response(200, array('status' => 'success', 'data' => $structure));
    }

    public function save_assessment_structure()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();
        $payload = json_decode($this->input->raw_input_stream, true);

        if (!isset($payload['max_ca']) || !isset($payload['max_exam'])) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Max CA and Max Exam scores are required'));
        }

        $max_ca = (float)$payload['max_ca'];
        $max_exam = (float)$payload['max_exam'];
        $max_total = isset($payload['max_total']) ? (float)$payload['max_total'] : ($max_ca + $max_exam);

        if ($max_ca < 0 || $max_exam < 0 || $max_total <= 0) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Scores must be positive numbers'));
        }

        if (round($max_ca + $max_exam, 2) !== round($max_total, 2)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Max CA + Max Exam must equal Total Limit'));
        }

        $data = array(
            'max_ca' => $max_ca,
            'max_exam' => $max_exam,
            'max_total' => $max_total
        );

        $saved = $this->Results_model->save_assessment_structure($data, $user['id'] ?? null);

        if ($saved) {
            return $this->json_response(200, array(
                'status' => 'success',
                'message' => 'Assessment structure saved successfully',
                'data' => $data
            ));
        } else {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Failed to save assessment structure'));
        }
    }
    public function get_broadsheet()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();
        
        $session_id = $this->input->get('session_id', true);
        $semester_input = $this->input->get('semester_id', true);
        $this->load->model('Courses_model');
        $semester_id = $semester_input ? $this->Courses_model->resolve_semester($semester_input) : null;
        $programme_id = $this->input->get('programme_id', true);
        $level = $this->input->get('level', true);
        
        if (!$session_id || !$semester_id || !$programme_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Missing required fields (session, semester, programme)'));
        }

        if (!$this->load->is_loaded('period_resolver')) {
            $this->load->library('period_resolver');
        }
        $contact_eligibility = $this->period_resolver->resolve_contact_entry_eligibility($session_id, $semester_id, $level);
        if (!empty($contact_eligibility['applies']) && empty($contact_eligibility['is_valid'])) {
            return $this->json_response(422, array(
                'status' => 'error',
                'message' => 'This contact is not available in the selected academic session. Select Contact '
                    . $contact_eligibility['fresh_contact'] . ' for fresh entrants or Contact '
                    . $contact_eligibility['direct_entry_contact'] . ' for Direct Entry students.'
            ));
        }
        
        $options = array(
            'basis'      => $this->input->get('basis', true) ?: 'published',
            'entry_mode' => $this->input->get('entry_mode', true) ?: 'all',
            'standing'   => $this->input->get('standing', true) ?: 'all',
            'search'     => $this->input->get('search', true) ?: '',
            'cohort'     => $this->input->get('cohort', true) ?: 'all',
            'required_entry_mode' => $contact_eligibility['entry_mode'] ?? null,
            'contact_eligibility' => $contact_eligibility,
            'force_refresh' => ($this->input->get('force_refresh', true) == '1' || $this->input->get('refresh', true) == '1'),
            'created_by' => $user['id'] ?? null,
        );

        $scope = array(
            'session_id'   => $session_id,
            'semester_id'  => $semester_id,
            'programme_id' => $programme_id,
            'level'        => $level ? (string)$level : null,
            'basis'        => $options['basis'],
            'cohort'       => $options['cohort'],
            'entry_mode'   => $options['entry_mode'],
        );

        $this->load->model('Snapshot_model');
        $result = $this->Snapshot_model->resolve_or_create($scope, $options);
        if (!$result) {
            $this->load->model('Broadsheet_model');
            $data = $this->Broadsheet_model->generate($session_id, $semester_id, $programme_id, $level, $options);
            return $this->json_response(200, array('status' => 'success', 'data' => $data));
        }

        $data = $result['broadsheet'];
        $data['source'] = $result['source'];
        $data['snapshot'] = $result['snapshot'];
        if (isset($data['context'])) {
            $data['context']['snapshot'] = $result['snapshot'];
        }

        // Apply presentation-only filters (search, standing) if present in request options
        if (!empty($options['search']) || ($options['standing'] !== 'all' && !empty($options['standing']))) {
            $search_q = strtolower(trim((string)$options['search']));
            $standing_q = strtolower(trim((string)$options['standing']));

            if (!empty($data['students'])) {
                $data['students'] = array_values(array_filter($data['students'], function($st) use ($search_q, $standing_q) {
                    if ($standing_q !== '' && $standing_q !== 'all') {
                        $st_std = strtolower((string)($st['academic_standing'] ?? ''));
                        if ($standing_q === 'in_good_standing' && strpos($st_std, 'good') === false) return false;
                        if ($standing_q === 'probation' && strpos($st_std, 'probation') === false) return false;
                        if ($standing_q === 'withdrawn' && strpos($st_std, 'withdraw') === false) return false;
                    }
                    if ($search_q !== '') {
                        $name = strtolower((string)($st['full_name'] ?? ''));
                        $mat = strtolower((string)($st['matric_number'] ?? $st['matric_no'] ?? ''));
                        if (strpos($name, $search_q) === false && strpos($mat, $search_q) === false) {
                            return false;
                        }
                    }
                    return true;
                }));
            }
        }

        return $this->json_response(200, array('status' => 'success', 'data' => $data));
    }

    public function student_history()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();
        
        $student_id = $this->input->get('student_id', true);
        if (!$student_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'student_id is required'));
        }
        
        $history = $this->Results_model->get_student_history($student_id);
        
        return $this->json_response(200, array('status' => 'success', 'data' => $history));
    }

    public function statement()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();
        
        $student_id = $this->input->get('student_id', true);
        if (!$student_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'student_id is required'));
        }

        $scope = $this->input->get('scope', true) ?: 'full';
        $session_id = $this->input->get('session_id', true);
        $semester_id = $this->input->get('semester_id', true);

        // Extract policy from RBAC - default to admin since this is admin controller
        $viewer_context = 'admin';

        $this->load->model('Statement_model');
        $statement = $this->Statement_model->get_statement($student_id, $scope, $session_id, $semester_id, $viewer_context);
        
        if (!$statement) {
            return $this->json_response(404, array('status' => 'error', 'message' => 'Student not found'));
        }

        return $this->json_response(200, array('status' => 'success', 'data' => $statement));
    }

    public function cgpa_list()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();
        
        $programme_id = $this->input->get('programme_id', true);
        
        $list = $this->Results_model->get_cgpa_list($programme_id);
        
        return $this->json_response(200, array('status' => 'success', 'data' => $list));
    }

    public function debug_data() {
        $scheme = $this->Results_model->get_active_grading_scheme();
        $test_grade = $this->Results_model->determine_grade(58.00, $scheme ? $scheme['ranges'] : []);
        
        $data = [
            'scheme' => $scheme,
            'test_grade_58' => $test_grade,
            'schemes' => $this->db->get('grading_schemes')->result_array(),
            'ranges' => $this->db->get('grading_ranges')->result_array()
        ];
        return $this->json_response(200, $data);
    }

    public function reconciliation()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();

        $session_id = $this->input->get('session_id', true);
        $semester_input = $this->input->get('semester_id', true);
        $this->load->model('Courses_model');
        $semester_id = $semester_input ? $this->Courses_model->resolve_semester($semester_input) : null;
        $programme_id = $this->input->get('programme_id', true);
        $level = $this->input->get('level', true);

        if (!$session_id || !$semester_id || !$programme_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Missing required fields (session, semester, programme)'));
        }

        $this->load->model('Reconciliation_model');
        $report = $this->Reconciliation_model->check($session_id, $semester_id, $programme_id, $level);
        return $this->json_response(200, array('status' => 'success', 'data' => $report));
    }

    public function export_reconciliation_csv()
    {
        $user = $this->require_login();
        $session_id = $this->input->get('session_id', true);
        $semester_input = $this->input->get('semester_id', true);
        $this->load->model('Courses_model');
        $semester_id = $semester_input ? $this->Courses_model->resolve_semester($semester_input) : null;
        $programme_id = $this->input->get('programme_id', true);
        $level = $this->input->get('level', true);

        if (!$session_id || !$semester_id || !$programme_id) {
            show_error('Missing required parameters', 400);
            return;
        }

        $this->load->model('Reconciliation_model');
        $report = $this->Reconciliation_model->check($session_id, $semester_id, $programme_id, $level);

        header('Content-Type: text/csv');
        header('Content-Disposition: attachment; filename="reconciliation_report_' . date('Ymd_His') . '.csv"');

        $output = fopen('php://output', 'w');
        fputcsv($output, array('Check Type', 'Severity', 'Matric Number', 'Student Name', 'Course Code', 'Description', 'Suggested Action'));

        foreach ($report['issues'] as $issue) {
            fputcsv($output, array(
                $issue['type'],
                $issue['severity'],
                $issue['matric_number'],
                $issue['student_name'],
                $issue['course_code'],
                $issue['message'],
                $issue['suggested_action']
            ));
        }
        fclose($output);
        exit;
    }

    public function reconciliation_action()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();
        $payload = json_decode($this->input->raw_input_stream, true) ?: $this->input->post();

        $action = $payload['action'] ?? null;
        if (!$action) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Missing action'));
        }

        $this->load->model('Reconciliation_model');
        $res = $this->Reconciliation_model->resolve_action($action, $payload);
        $status_code = ($res['status'] ?? 'success') === 'success' ? 200 : 400;
        return $this->json_response($status_code, $res);
    }

    public function create_snapshot()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();
        $payload = json_decode($this->input->raw_input_stream, true);

        $session_id   = $payload['session_id'] ?? null;
        $semester_id  = $payload['semester_id'] ?? null;
        $programme_id = $payload['programme_id'] ?? null;
        $level        = $payload['level'] ?? null;
        $basis        = $payload['basis'] ?? 'published';

        if (!$session_id || !$semester_id || !$programme_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Missing required fields'));
        }

        $this->load->model('Snapshot_model');
        $res = $this->Snapshot_model->create_snapshot($session_id, $semester_id, $programme_id, $level, $user['id'], $basis);
        if (!$res) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Failed to generate snapshot'));
        }

        return $this->json_response(201, array('status' => 'success', 'data' => $res));
    }

    public function list_snapshots()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();

        $session_id   = $this->input->get('session_id', true);
        $semester_id  = $this->input->get('semester_id', true);
        $programme_id = $this->input->get('programme_id', true);
        $level        = $this->input->get('level', true);

        if (!$session_id || !$semester_id || !$programme_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Missing required fields'));
        }

        $this->load->model('Snapshot_model');
        $snapshots = $this->Snapshot_model->list_snapshots($session_id, $semester_id, $programme_id, $level);
        return $this->json_response(200, array('status' => 'success', 'data' => $snapshots));
    }

    public function get_snapshot()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();

        $snapshot_id = $this->input->get('id', true);
        if (!$snapshot_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Missing snapshot id'));
        }

        $this->load->model('Snapshot_model');
        $snapshot = $this->Snapshot_model->get_snapshot_by_id($snapshot_id);
        if (!$snapshot) {
            return $this->json_response(404, array('status' => 'error', 'message' => 'Snapshot not found'));
        }

        return $this->json_response(200, array('status' => 'success', 'data' => $snapshot));
    }

    public function sign_off_snapshot()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();
        $payload = json_decode($this->input->raw_input_stream, true);

        $snapshot_id = $payload['snapshot_id'] ?? null;
        $role_key    = $payload['role_key'] ?? ($payload['role'] ?? 'hod');
        $action      = $payload['action'] ?? ($payload['status'] ?? 'approve');
        $comment     = $payload['comment'] ?? ($payload['notes'] ?? null);

        if (!$snapshot_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Missing snapshot_id'));
        }

        if (!in_array($action, ['approve', 'reject'], true)) {
            return $this->json_response(400, array('status' => 'error', 'message' => "Invalid action '{$action}'. Must be 'approve' or 'reject'."));
        }

        $this->load->model('Snapshot_model');
        $res = $this->Snapshot_model->sign_off($snapshot_id, $role_key, $user['id'], $action, $comment);
        if (!$res || (is_array($res) && empty($res['status']))) {
            $msg = is_array($res) && !empty($res['message']) ? $res['message'] : 'Failed to record sign-off. The snapshot may be stale, already locked, or superseded.';
            return $this->json_response(400, array('status' => 'error', 'message' => $msg));
        }

        return $this->json_response(200, array('status' => 'success', 'message' => $res['message'] ?? "Sign-off recorded ({$action})"));
    }

    public function refresh_snapshot()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();
        $payload = json_decode($this->input->raw_input_stream, true);

        $session_id     = $payload['session_id'] ?? null;
        $semester_input = $payload['semester_id'] ?? null;
        $this->load->model('Courses_model');
        $semester_id    = $semester_input ? $this->Courses_model->resolve_semester($semester_input) : null;
        $programme_id   = $payload['programme_id'] ?? null;
        $level          = $payload['level'] ?? null;
        $basis          = $payload['basis'] ?? 'published';
        $cohort         = $payload['cohort'] ?? 'all';
        $entry_mode     = $payload['entry_mode'] ?? 'all';
        $reason         = $payload['reason'] ?? 'Manual refresh requested';

        if (!$session_id || !$semester_id || !$programme_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Missing required fields (session, semester, programme)'));
        }

        $this->load->model('Snapshot_model');
        $scope = array(
            'session_id'   => $session_id,
            'semester_id'  => $semester_id,
            'programme_id' => $programme_id,
            'level'        => $level ? (string)$level : null,
            'basis'        => $basis,
            'cohort'       => $cohort,
            'entry_mode'   => $entry_mode,
        );

        $result = $this->Snapshot_model->resolve_or_create($scope, array(
            'force_refresh'   => true,
            'revision_reason' => $reason,
            'created_by'      => $user['id'] ?? null,
        ));

        if (!$result) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Failed to refresh snapshot'));
        }

        $data = $result['broadsheet'];
        $data['source'] = $result['source'];
        $data['snapshot'] = $result['snapshot'];
        if (isset($data['context'])) {
            $data['context']['snapshot'] = $result['snapshot'];
        }

        return $this->json_response(200, array('status' => 'success', 'data' => $data));
    }

    public function verify_broadsheet($verification_code = null)
    {
        if (!$verification_code) {
            $verification_code = $this->input->get('code', true);
        }
        if (!$verification_code) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Verification code required'));
        }

        $this->load->model('Snapshot_model');
        $snapshot = $this->Snapshot_model->get_snapshot_by_verification_code($verification_code);
        if (!$snapshot) {
            return $this->json_response(404, array(
                'status'  => 'invalid',
                'message' => 'Invalid or unverified broadsheet code.'
            ));
        }

        // Return verified public details (summary and authenticity, without private student PII)
        $ctx = $snapshot['payload']['context'] ?? [];
        return $this->json_response(200, array(
            'status'            => 'valid',
            'verification_code' => $snapshot['verification_code'],
            'payload_hash'      => $snapshot['payload_hash'],
            'version'           => $snapshot['version'],
            'approval_status'   => $snapshot['status'],
            'generated_at'      => $snapshot['generated_at'],
            'approved_at'       => $snapshot['approved_at'],
            'locked_at'         => $snapshot['locked_at'],
            'institution'       => $ctx['institution'] ?? 'Maslaha Community College of Education',
            'programme'         => $ctx['programme']['name'] ?? 'N/A',
            'session'           => $ctx['session']['name'] ?? 'N/A',
            'semester'          => $ctx['semester']['name'] ?? 'N/A',
            'level'             => $ctx['level'] ?? 'N/A',
            'summary'           => $ctx['summary'] ?? []
        ));
    }
}

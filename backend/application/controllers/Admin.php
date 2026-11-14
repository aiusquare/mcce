<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Admin extends CI_Controller {
    public function __construct()
    {
        parent::__construct();
        $this->load->database();
        $this->load->library('session');
        $this->load->model('RBAC_model');
        $this->load->model('Courses_model');
        $this->load->model('User_model');
        $this->load->model('Student_model');
        $this->load->model('Fee_model');
        $this->require_login();
    }

    private function require_login()
    {
        if ($this->session->userdata('user_id') && $this->session->userdata('logged_in')) {
            return;
        }

        $user = $this->user_from_bearer_token();
        if ($user) {
            $this->session->set_userdata(array(
                'user_id' => $user['id'],
                'email' => $user['email'],
                'full_name' => $user['full_name'],
                'logged_in' => true,
                'login_at' => date('Y-m-d H:i:s')
            ));
            return;
        }

        $this->json_response(401, array(
            'status' => 'error',
            'message' => 'Authentication required.'
        ));
        exit;
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

        $user = $this->User_model->find_by_id($payload['sub']);
        if (!$user || !empty($user['deleted_at']) || (isset($user['status']) && $user['status'] !== 'active')) {
            return null;
        }

        return $user;
    }

    private function token_secret()
    {
        $key = $this->config->item('encryption_key');
        return $key ? $key : 'aacas-local-admin-token-secret';
    }

    /**
     * Session configuration changes affect admissions and academic records.
     * Keep the check on the server: access to an admin page is not authority
     * to create, activate, rename, or delete an academic session.
     */
    private function require_session_management_permission()
    {
        $token_user = $this->user_from_bearer_token();
        $user_id = $token_user && !empty($token_user['id'])
            ? $token_user['id']
            : $this->session->userdata('user_id');

        if (!$user_id) {
            $this->json_response(401, array('status' => 'error', 'message' => 'Authentication required.'));
            return false;
        }

        $user = $token_user ?: $this->User_model->find_by_id($user_id);
        if ($user) {
            $email = isset($user['email']) ? strtolower(trim((string) $user['email'])) : '';
            if (in_array($email, array('superadmin@mcce.edu.ng', 'superadmin@aacas.edu.ng'), true)) {
                return true;
            }
            if (!empty($user['is_super_admin']) && (int) $user['is_super_admin'] === 1) {
                return true;
            }
            foreach (array('role', 'role_slug', 'user_type') as $field) {
                if (!empty($user[$field])) {
                    $norm = strtolower(preg_replace('/[^a-z0-9]+/', '', (string) $user[$field]));
                    if (in_array($norm, array('admin', 'administrator', 'superadmin', 'superadministrator'), true)) {
                        return true;
                    }
                }
            }
        }

        if (!$this->db->table_exists('roles') || !$this->db->table_exists('user_roles')) {
            $this->json_response(403, array('status' => 'error', 'message' => 'Academic-session management is not configured.'));
            return false;
        }

        $roles = $this->RBAC_model->get_user_roles($user_id);
        foreach ($roles as $role) {
            $name = isset($role['name']) ? strtolower(preg_replace('/[^a-z0-9]+/', '', $role['name'])) : '';
            if (in_array($name, array('admin', 'administrator', 'superadmin', 'superadministrator'), true)) {
                return true;
            }
        }

        $permission_tables_ready = $this->db->table_exists('permissions')
            && $this->db->table_exists('resources')
            && $this->db->table_exists('role_permissions');
        if ($permission_tables_ready) {
            foreach (array('manage', 'create', 'edit', 'delete') as $permission) {
                if ($this->RBAC_model->has_permission($user_id, $permission, 'programmes')) {
                    return true;
                }
            }
        }

        $this->json_response(403, array(
            'status' => 'error',
            'message' => 'You do not have permission to manage academic sessions.',
        ));
        return false;
    }

    // Get all users with roles
    public function get_users()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        $users = $this->RBAC_model->get_users_with_roles();
        return $this->json_response(200, array('status' => 'success', 'data' => $users));
    }

    // Create user
    public function create_user()
    {
        $this->ensure_admin_password_policy_schema();

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        $raw = $this->input->raw_input_stream;
        $payload = json_decode($raw, true);

        if (!is_array($payload)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid JSON payload'));
        }

        $full_name = isset($payload['full_name']) ? trim((string) $payload['full_name']) : '';
        if ($full_name === '') {
            $first = isset($payload['first_name']) ? trim((string) $payload['first_name']) : '';
            $last = isset($payload['last_name']) ? trim((string) $payload['last_name']) : '';
            $full_name = trim($first . ' ' . $last);
        }

        $email = isset($payload['email']) ? strtolower(trim((string) $payload['email'])) : '';
        $password = '000000';

        if ($full_name === '' || $email === '') {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Missing required fields'));
        }

        if (strlen($password) < 6) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Password must be at least 6 characters'));
        }

        $existing_user = $this->User_model->find_by_email($email);
        if ($existing_user) {
            $updates = array(
                'full_name' => $full_name,
                'status' => 'active',
                'is_active' => isset($payload['is_active']) ? $payload['is_active'] : 1,
                'updated_at' => date('Y-m-d H:i:s'),
            );
            foreach (array_keys($updates) as $key) {
                if (!$this->db->field_exists($key, 'users')) {
                    unset($updates[$key]);
                }
            }

            if (!empty($updates)) {
                $this->db->where('id', $existing_user['id']);
                $this->db->update('users', $updates);
            }

            if (isset($payload['roles']) && is_array($payload['roles'])) {
                foreach ($payload['roles'] as $role_id) {
                    $this->RBAC_model->assign_role_to_user($existing_user['id'], $role_id);
                }
            }

            return $this->json_response(200, array(
                'status' => 'success',
                'message' => 'User already existed; details and role were updated',
                'data' => array('id' => $existing_user['id'], 'default_password' => null, 'must_change_password' => false),
            ));
        }

        $user_id = $this->RBAC_model->generate_uuid();
        $data = array(
            'id' => $user_id,
            'full_name' => $full_name,
            'email' => $email,
            'password_hash' => password_hash($password, PASSWORD_BCRYPT),
            'phone' => isset($payload['phone']) ? $payload['phone'] : null,
            'status' => 'active',
            'is_active' => isset($payload['is_active']) ? $payload['is_active'] : 1,
            'must_change_password' => 1,
            'created_at' => date('Y-m-d H:i:s'),
        );

        if ($this->db->field_exists('password', 'users')) {
            $data['password'] = $data['password_hash'];
        }
        foreach (array_keys($data) as $key) {
            if (!$this->db->field_exists($key, 'users')) {
                unset($data[$key]);
            }
        }

        $this->db->insert('users', $data);

        if (isset($payload['roles']) && is_array($payload['roles'])) {
            foreach ($payload['roles'] as $role_id) {
                $this->RBAC_model->assign_role_to_user($user_id, $role_id);
            }
        }

        return $this->json_response(201, array(
            'status' => 'success',
            'message' => 'User created successfully. Temporary password is 000000.',
            'data' => array('id' => $user_id, 'default_password' => '000000', 'must_change_password' => true),
        ));
    }

    private function ensure_admin_password_policy_schema()
    {
        if ($this->db->table_exists('users') && !$this->db->field_exists('must_change_password', 'users')) {
            $this->db->query("ALTER TABLE `users` ADD COLUMN `must_change_password` TINYINT(1) NOT NULL DEFAULT 0 AFTER `password_hash`");
        }
    }

    // Assign role to user
    public function assign_role()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        $raw = $this->input->raw_input_stream;
        $payload = json_decode($raw, true);

        if (!isset($payload['user_id']) || !isset($payload['role_id'])) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Missing required fields'));
        }

        $this->RBAC_model->assign_role_to_user($payload['user_id'], $payload['role_id']);

        return $this->json_response(200, array(
            'status' => 'success',
            'message' => 'Role assigned successfully',
        ));
    }

    // Remove role from user
    public function remove_role()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        $raw = $this->input->raw_input_stream;
        $payload = json_decode($raw, true);

        if (!isset($payload['user_id']) || !isset($payload['role_id'])) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Missing required fields'));
        }

        $this->RBAC_model->remove_role_from_user($payload['user_id'], $payload['role_id']);

        return $this->json_response(200, array(
            'status' => 'success',
            'message' => 'Role removed successfully',
        ));
    }

    // Delete user and cascade related records
    public function delete_user()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        $payload = json_decode($this->input->raw_input_stream, true);
        if (!is_array($payload) || !isset($payload['user_id'])) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'User id is required'));
        }

        $result = $this->RBAC_model->delete_user_cascade($payload['user_id']);
        if (!$result['success']) {
            $code = isset($result['code']) ? (int) $result['code'] : 400;
            return $this->json_response($code, array(
                'status' => 'error',
                'message' => isset($result['message']) ? $result['message'] : 'Failed to delete user',
            ));
        }

        return $this->json_response(200, array(
            'status' => 'success',
            'message' => $result['message'],
        ));
    }

    // Get all roles
    public function get_roles()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        $roles = $this->RBAC_model->get_roles();
        return $this->json_response(200, array('status' => 'success', 'data' => $roles));
    }

    // Create role
    public function create_role()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        $raw = $this->input->raw_input_stream;
        $payload = json_decode($raw, true);

        if (!isset($payload['name'])) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Missing role name'));
        }

        $role_id = $this->RBAC_model->create_role($payload['name'], $payload['description'] ?? null);

        return $this->json_response(201, array(
            'status' => 'success',
            'message' => 'Role created successfully',
            'data' => array('id' => $role_id),
        ));
    }

    // Get all resources
    public function get_resources()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        $resources = $this->RBAC_model->get_resources();
        return $this->json_response(200, array('status' => 'success', 'data' => $resources));
    }

    // Get all permissions
    public function get_permissions()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        $permissions = $this->RBAC_model->get_permissions();
        return $this->json_response(200, array('status' => 'success', 'data' => $permissions));
    }

    // Assign permission to role
    public function assign_permission()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        $raw = $this->input->raw_input_stream;
        $payload = json_decode($raw, true);

        if (!isset($payload['role_id']) || !isset($payload['permission_id'])) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Missing required fields'));
        }

        $this->RBAC_model->assign_permission_to_role(
            $payload['role_id'],
            $payload['permission_id'],
            $payload['resource_id'] ?? null
        );

        return $this->json_response(200, array(
            'status' => 'success',
            'message' => 'Permission assigned successfully',
        ));
    }

    // Get all courses
    public function get_courses()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!$this->Courses_model->tables_ready()) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Course tables not found'));
        }

        $courses = $this->Courses_model->get_courses();
        return $this->json_response(200, array('status' => 'success', 'data' => $courses));
    }

    // Get course details by id
    public function get_course()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!$this->Courses_model->tables_ready()) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Course tables not found'));
        }

        $course_id = $this->input->get('course_id', true);
        if (!$course_id) {
            $course_id = $this->input->get('id', true);
        }

        if (!$course_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Course id is required'));
        }

        $course = $this->Courses_model->get_course_by_id($course_id);
        if (!$course) {
            return $this->json_response(404, array('status' => 'error', 'message' => 'Course not found'));
        }

        return $this->json_response(200, array('status' => 'success', 'data' => $course));
    }

    // Create course
    public function create_course()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!$this->Courses_model->tables_ready()) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Course tables not found'));
        }

        $raw = $this->input->raw_input_stream;
        $payload = json_decode($raw, true);

        if (!is_array($payload)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid JSON payload'));
        }

        $department_id = isset($payload['department_id']) ? $payload['department_id'] : null;
        $programme_id = isset($payload['programme_id']) ? $payload['programme_id'] : null;

        $department_name = isset($payload['department']) ? $payload['department'] : null;
        $department_code = isset($payload['department_code']) ? $payload['department_code'] : null;
        $programme_name = isset($payload['programme']) ? $payload['programme'] : null;
        $programme_code = isset($payload['programme_code']) ? $payload['programme_code'] : null;
        $course_code = isset($payload['course_code']) ? $payload['course_code'] : null;
        $course_title = isset($payload['course_title']) ? $payload['course_title'] : null;
        $unit = isset($payload['unit']) ? $payload['unit'] : null;
        $level = isset($payload['level']) ? $payload['level'] : null;
        $type = isset($payload['type']) ? $payload['type'] : 'core';

        if (!$department_id && !$department_name) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Department is required'));
        }

        if (!$programme_id && (!$programme_name || !$programme_code)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Programme and programme code are required'));
        }

        if (!$course_code || !$course_title || $unit === null || $unit === '') {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Course code, title, and unit are required'));
        }

        $placement = $this->course_placement_from_payload($payload);
        if (!$placement['success']) {
            return $this->json_response(400, array('status' => 'error', 'message' => $placement['message']));
        }

        if (!$department_id) {
            $department_id = $this->Courses_model->resolve_department($department_name, $department_code);
        }

        $programme_id = $programme_id ?: $this->Courses_model->resolve_programme($department_id, $programme_name, $programme_code);

        if (!$department_id || !$programme_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Unable to resolve department or programme'));
        }

        $course_id = $this->Courses_model->create_course(
            $programme_id,
            $course_code,
            $course_title,
            $unit,
            $level ?: $placement['level'],
            $type,
            $placement['data']
        );
        if (!$course_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Unable to create course'));
        }

        return $this->json_response(201, array(
            'status' => 'success',
            'message' => 'Course created successfully',
            'data' => array(
                'course_id' => $course_id,
                'offering_id' => null,
            ),
        ));
    }

    public function bulk_upload_courses()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!$this->Courses_model->tables_ready()) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Course tables not found'));
        }

        $payload = $this->json_payload();
        $csv = isset($payload['csv']) ? $payload['csv'] : null;
        if (!is_string($csv) || trim($csv) === '') {
            return $this->json_response(400, array('status' => 'error', 'message' => 'CSV content is required'));
        }

        $parsed = $this->parse_csv_rows($csv);
        if (!isset($parsed['rows']) || !is_array($parsed['rows'])) {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => isset($parsed['message']) ? $parsed['message'] : 'Unable to parse CSV',
            ));
        }

        if (count($parsed['rows']) > 500) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'A maximum of 500 courses can be uploaded at once'));
        }

        $result = $this->Courses_model->bulk_import_courses($parsed['rows']);
        if (isset($result['error'])) {
            return $this->json_response(isset($result['code']) ? (int) $result['code'] : 400, array(
                'status' => 'error',
                'message' => $result['error'],
                'errors' => isset($result['errors']) ? $result['errors'] : array(),
            ));
        }

        $created = isset($result['created']) ? (int) $result['created'] : 0;
        $skipped = isset($result['skipped']) ? (int) $result['skipped'] : 0;

        return $this->json_response(200, array(
            'status' => 'success',
            'message' => 'Bulk upload completed: ' . $created . ' created, ' . $skipped . ' existing courses skipped.',
            'data' => array(
                'created' => $created,
                'skipped' => $skipped,
            ),
        ));
    }

    public function update_course()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!$this->Courses_model->tables_ready()) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Course tables not found'));
        }

        $payload = json_decode($this->input->raw_input_stream, true);
        if (!is_array($payload)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid JSON payload'));
        }

        $course_id = isset($payload['course_id']) ? $payload['course_id'] : (isset($payload['id']) ? $payload['id'] : null);
        $department_id = isset($payload['department_id']) ? $payload['department_id'] : null;
        $programme_id = isset($payload['programme_id']) ? $payload['programme_id'] : null;

        $department_name = isset($payload['department']) ? $payload['department'] : null;
        $department_code = isset($payload['department_code']) ? $payload['department_code'] : null;
        $programme_name = isset($payload['programme']) ? $payload['programme'] : null;
        $programme_code = isset($payload['programme_code']) ? $payload['programme_code'] : null;
        $course_code = isset($payload['course_code']) ? $payload['course_code'] : null;
        $course_title = isset($payload['course_title']) ? $payload['course_title'] : null;
        $unit = isset($payload['unit']) ? $payload['unit'] : null;
        $level = isset($payload['level']) ? $payload['level'] : null;
        $type = isset($payload['type']) ? $payload['type'] : 'core';

        if (!$course_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Course id is required'));
        }

        if (!$department_id && !$department_name) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Department is required'));
        }

        if (!$programme_id && (!$programme_name || !$programme_code)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Programme and programme code are required'));
        }

        if (!$course_code || !$course_title || $unit === null || $unit === '') {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Course code, title, and unit are required'));
        }

        $placement = $this->course_placement_from_payload($payload);
        if (!$placement['success']) {
            return $this->json_response(400, array('status' => 'error', 'message' => $placement['message']));
        }

        if (!$department_id) {
            $department_id = $this->Courses_model->resolve_department($department_name, $department_code);
        }

        $programme_id = $programme_id ?: $this->Courses_model->resolve_programme($department_id, $programme_name, $programme_code);

        if (!$department_id || !$programme_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Unable to resolve department or programme'));
        }

        $result = $this->Courses_model->update_course(
            $course_id,
            $programme_id,
            $course_code,
            $course_title,
            $unit,
            $level ?: $placement['level'],
            $type,
            $placement['data']
        );

        if (!isset($result['success']) || !$result['success']) {
            $code = isset($result['code']) ? (int) $result['code'] : 400;
            return $this->json_response($code, array(
                'status' => 'error',
                'message' => isset($result['message']) ? $result['message'] : 'Unable to update course',
            ));
        }

        return $this->json_response(200, array(
            'status' => 'success',
            'message' => isset($result['message']) ? $result['message'] : 'Course updated successfully',
            'data' => array(
                'course_id' => $course_id,
                'offering_id' => isset($result['offering_id']) ? $result['offering_id'] : null,
            ),
        ));
    }

    private function course_placement_from_payload($payload)
    {
        $structure = isset($payload['programme_structure'])
            ? strtolower(trim((string) $payload['programme_structure']))
            : null;

        if ($structure === 'contact_based') {
            $structure = 'contact';
        }

        if (!$structure) {
            $structure = isset($payload['contact_number']) && $payload['contact_number'] !== null
                ? 'contact'
                : 'semester';
        }

        if ($structure !== 'contact' && $structure !== 'semester') {
            return array('success' => false, 'message' => 'Programme type must be contact or semester');
        }

        if ($structure === 'contact') {
            $contact_number = isset($payload['contact_number']) ? (int) $payload['contact_number'] : 0;
            if ($contact_number < 1 || $contact_number > 6) {
                return array('success' => false, 'message' => 'Contact must be between 1 and 6');
            }

            return array(
                'success' => true,
                'level' => 'Contact ' . $contact_number,
                'data' => array(
                    'programme_structure' => 'contact',
                    'contact_number' => $contact_number,
                    'year_number' => null,
                    'semester_name' => null,
                ),
            );
        }

        $year_number = isset($payload['year_number']) ? (int) $payload['year_number'] : 0;
        $semester_name = isset($payload['semester_name'])
            ? trim((string) $payload['semester_name'])
            : (isset($payload['semester']) ? trim((string) $payload['semester']) : 'First Semester');
        $valid_semesters = array('First Semester', 'Second Semester');

        if ($year_number < 1 || $year_number > 5) {
            return array('success' => false, 'message' => 'Year must be between 1 and 5');
        }

        if (!in_array($semester_name, $valid_semesters, true)) {
            return array('success' => false, 'message' => 'Semester must be First Semester or Second Semester');
        }

        return array(
            'success' => true,
            'level' => 'Year ' . $year_number,
            'data' => array(
                'programme_structure' => 'semester',
                'contact_number' => null,
                'year_number' => $year_number,
                'semester_name' => $semester_name,
            ),
        );
    }

    public function delete_course()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!$this->Courses_model->tables_ready()) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Course tables not found'));
        }

        $payload = json_decode($this->input->raw_input_stream, true);
        if (!is_array($payload)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid JSON payload'));
        }

        $course_id = isset($payload['course_id']) ? $payload['course_id'] : (isset($payload['id']) ? $payload['id'] : null);
        if (!$course_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Course id is required'));
        }

        $result = $this->Courses_model->delete_course($course_id);
        if (!isset($result['success']) || !$result['success']) {
            $code = isset($result['code']) ? (int) $result['code'] : 400;
            return $this->json_response($code, array(
                'status' => 'error',
                'message' => isset($result['message']) ? $result['message'] : 'Unable to delete course',
                'has_dependencies' => isset($result['has_dependencies']) ? (bool) $result['has_dependencies'] : false,
            ));
        }

        return $this->json_response(200, array(
            'status' => 'success',
            'message' => isset($result['message']) ? $result['message'] : 'Course deleted successfully',
        ));
    }

    public function get_departments()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!$this->Courses_model->tables_ready()) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Course tables not found'));
        }

        $this->Courses_model->ensure_default_degree_catalogue();
        $departments = $this->Courses_model->get_departments();
        return $this->json_response(200, array('status' => 'success', 'data' => $departments));
    }

    public function delete_department()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!$this->Courses_model->programme_tables_ready()) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Programme tables not found'));
        }

        $payload = json_decode($this->input->raw_input_stream, true);
        if (!is_array($payload)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid JSON payload'));
        }

        $department_id = isset($payload['department_id']) ? $payload['department_id'] : null;
        if (!$department_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Department id is required'));
        }

        $result = $this->Courses_model->delete_department($department_id);

        if (!$result['success']) {
            $status_code = isset($result['has_dependencies']) ? 409 : (isset($result['code']) ? (int) $result['code'] : 400);
            return $this->json_response($status_code, array(
                'status' => 'error',
                'message' => isset($result['message']) ? $result['message'] : 'Unable to delete department',
                'has_dependencies' => isset($result['has_dependencies']) ? $result['has_dependencies'] : false,
            ));
        }

        return $this->json_response(200, array('status' => 'success', 'message' => $result['message']));
    }

    public function create_department()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!$this->Courses_model->programme_tables_ready()) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Programme tables not found'));
        }

        $payload = json_decode($this->input->raw_input_stream, true);
        if (!is_array($payload)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid JSON payload'));
        }

        $name = isset($payload['name']) ? trim($payload['name']) : '';
        $code = isset($payload['code']) ? trim($payload['code']) : null;

        if ($name === '') {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Department name is required'));
        }

        $department_id = $this->Courses_model->resolve_department($name, $code);
        if (!$department_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Unable to create department'));
        }

        return $this->json_response(201, array(
            'status' => 'success',
            'message' => 'Department saved',
            'data' => array('id' => $department_id),
        ));
    }

    public function update_department()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!$this->Courses_model->programme_tables_ready()) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Programme tables not found'));
        }

        $payload = json_decode($this->input->raw_input_stream, true);
        if (!is_array($payload)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid JSON payload'));
        }

        $department_id = isset($payload['department_id']) ? $payload['department_id'] : null;
        $name = isset($payload['name']) ? trim($payload['name']) : '';
        $code = isset($payload['code']) ? trim($payload['code']) : null;

        $result = $this->Courses_model->update_department($department_id, $name, $code);
        if (!$result['success']) {
            $status_code = isset($result['code']) ? (int) $result['code'] : 400;
            return $this->json_response($status_code, array(
                'status' => 'error',
                'message' => isset($result['message']) ? $result['message'] : 'Unable to update department',
            ));
        }

        return $this->json_response(200, array(
            'status' => 'success',
            'message' => $result['message'],
        ));
    }

    public function get_programmes()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!$this->Courses_model->programme_tables_ready()) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Programme tables not found'));
        }

        $this->Courses_model->ensure_default_degree_catalogue();
        $department_id = $this->input->get('department_id', true);
        $programmes = $this->Courses_model->get_programmes($department_id);
        return $this->json_response(200, array('status' => 'success', 'data' => $programmes));
    }

    public function create_programme()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!$this->Courses_model->programme_tables_ready()) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Programme tables not found'));
        }

        $payload = json_decode($this->input->raw_input_stream, true);
        if (!is_array($payload)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid JSON payload'));
        }

        $department_id = isset($payload['department_id']) ? $payload['department_id'] : null;
        $department_name = isset($payload['department_name']) ? $payload['department_name'] : null;
        $department_code = isset($payload['department_code']) ? $payload['department_code'] : null;
        $programme_name = isset($payload['programme_name']) ? $payload['programme_name'] : null;
        $programme_code = isset($payload['programme_code']) ? $payload['programme_code'] : null;
        $duration_years = isset($payload['duration_years']) ? $payload['duration_years'] : null;
        $programme_structure = isset($payload['programme_structure']) ? strtolower(trim((string) $payload['programme_structure'])) : 'semester';
        if ($programme_structure === 'contact_based') {
            $programme_structure = 'contact';
        }

        if (!$department_id && !$department_name) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Department is required'));
        }

        if (!$programme_name || !$programme_code) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Programme name and code are required'));
        }

        if (!$duration_years) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Programme duration is required'));
        }

        if ($programme_structure !== 'semester' && $programme_structure !== 'contact') {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Programme type must be semester or contact based'));
        }

        if (!$department_id) {
            $department_id = $this->Courses_model->resolve_department($department_name, $department_code);
        }

        if (!$department_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Unable to resolve department'));
        }

        $programme_id = $this->Courses_model->create_programme($department_id, $programme_name, $programme_code, $duration_years, $programme_structure);
        if (!$programme_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Unable to create programme'));
        }

        return $this->json_response(201, array(
            'status' => 'success',
            'message' => 'Programme created successfully',
            'data' => array('id' => $programme_id),
        ));
    }

    public function update_programme()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!$this->Courses_model->programme_tables_ready()) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Programme tables not found'));
        }

        $payload = json_decode($this->input->raw_input_stream, true);
        if (!is_array($payload)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid JSON payload'));
        }

        $programme_id = isset($payload['programme_id']) ? $payload['programme_id'] : null;
        $department_id = isset($payload['department_id']) ? $payload['department_id'] : null;
        $programme_name = isset($payload['programme_name']) ? trim($payload['programme_name']) : '';
        $programme_code = isset($payload['programme_code']) ? trim($payload['programme_code']) : '';
        $duration_years = isset($payload['duration_years']) ? $payload['duration_years'] : null;
        $programme_structure = isset($payload['programme_structure']) ? strtolower(trim((string) $payload['programme_structure'])) : 'semester';
        if ($programme_structure === 'contact_based') {
            $programme_structure = 'contact';
        }

        if ($programme_structure !== 'semester' && $programme_structure !== 'contact') {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Programme type must be semester or contact based'));
        }

        $result = $this->Courses_model->update_programme(
            $programme_id,
            $department_id,
            $programme_name,
            $programme_code,
            $duration_years,
            $programme_structure
        );

        if (!$result['success']) {
            $status_code = isset($result['code']) ? (int) $result['code'] : 400;
            return $this->json_response($status_code, array(
                'status' => 'error',
                'message' => isset($result['message']) ? $result['message'] : 'Unable to update programme',
            ));
        }

        return $this->json_response(200, array(
            'status' => 'success',
            'message' => $result['message'],
        ));
    }

    public function update_programme_status()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!$this->Courses_model->programme_tables_ready()) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Programme tables not found'));
        }

        $payload = json_decode($this->input->raw_input_stream, true);
        if (!is_array($payload)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid JSON payload'));
        }

        $programme_id = isset($payload['programme_id']) ? $payload['programme_id'] : null;
        $is_active = isset($payload['is_active']) ? (int) $payload['is_active'] : null;

        if (!$programme_id || $is_active === null) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Programme id and status are required'));
        }

        $result = $this->Courses_model->update_programme_status($programme_id, $is_active);

        if (!$result['success']) {
            $code = isset($result['code']) ? (int) $result['code'] : 400;
            return $this->json_response($code, array(
                'status' => 'error',
                'message' => isset($result['message']) ? $result['message'] : 'Unable to update programme status',
            ));
        }

        return $this->json_response(200, array(
            'status' => 'success',
            'message' => $result['message'],
        ));
    }

    public function delete_programme()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!$this->Courses_model->programme_tables_ready()) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Programme tables not found'));
        }

        $payload = json_decode($this->input->raw_input_stream, true);
        if (!is_array($payload)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid JSON payload'));
        }

        $programme_id = isset($payload['programme_id']) ? $payload['programme_id'] : null;
        if (!$programme_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Programme id is required'));
        }

        $result = $this->Courses_model->delete_programme($programme_id);

        if (!$result['success']) {
            $status_code = isset($result['has_dependencies']) ? 409 : 400;
            return $this->json_response($status_code, array(
                'status' => 'error',
                'message' => $result['message'],
                'has_dependencies' => isset($result['has_dependencies']) ? $result['has_dependencies'] : false
            ));
        }

        return $this->json_response(200, array('status' => 'success', 'message' => $result['message']));
    }

    public function get_sessions()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!$this->Courses_model->tables_ready()) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Course tables not found'));
        }

        $sessions = $this->Courses_model->get_sessions();
        return $this->json_response(200, array(
            'status' => 'success',
            'data' => $sessions,
            'meta' => array('active_session' => $this->Courses_model->get_active_session()),
        ));
    }

    public function create_session()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!$this->require_session_management_permission()) {
            return;
        }

        if (!$this->Courses_model->tables_ready()) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Course tables not found'));
        }

        $payload = json_decode($this->input->raw_input_stream, true);
        if (!is_array($payload)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid JSON payload'));
        }

        $name = isset($payload['name']) ? $payload['name'] : null;
        $start_date = isset($payload['start_date']) ? $payload['start_date'] : null;
        $end_date = isset($payload['end_date']) ? $payload['end_date'] : null;
        $is_active = isset($payload['is_active']) ? (int) $payload['is_active'] : 0;

        if (!$name) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Session name is required'));
        }

        if (($start_date && !$this->is_valid_session_date($start_date)) || ($end_date && !$this->is_valid_session_date($end_date))) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Session dates must use the YYYY-MM-DD format'));
        }
        if ($start_date && $end_date && $start_date > $end_date) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Session end date must be on or after the start date'));
        }

        $session_id = $this->Courses_model->create_session($name, $start_date, $end_date, $is_active);
        if (!$session_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Unable to create session'));
        }

        return $this->json_response(201, array(
            'status' => 'success',
            'message' => 'Session saved',
            'data' => array('id' => $session_id),
        ));
    }

    public function set_active_session()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!$this->require_session_management_permission()) {
            return;
        }

        if (!$this->Courses_model->tables_ready()) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Course tables not found'));
        }

        $payload = json_decode($this->input->raw_input_stream, true);
        if (!is_array($payload)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid JSON payload'));
        }

        $session_id = isset($payload['session_id']) ? $payload['session_id'] : null;
        $reason = isset($payload['reason']) ? trim((string) $payload['reason']) : '';
        if ($reason === '') {
            return $this->json_response(422, array('status' => 'error', 'message' => 'An activation reason is required.'));
        }
        $result = $this->Courses_model->set_active_session(
            $session_id,
            $this->session->userdata('user_id'),
            $reason
        );

        if (!$result['success']) {
            $code = isset($result['code']) ? (int) $result['code'] : 400;
            return $this->json_response($code, array(
                'status' => 'error',
                'message' => isset($result['message']) ? $result['message'] : 'Unable to update active session',
            ));
        }

        return $this->json_response(200, array(
            'status' => 'success',
            'message' => $result['message'],
        ));
    }

    public function get_semesters()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!$this->Courses_model->tables_ready()) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Course tables not found'));
        }

        $semesters = $this->Courses_model->get_semesters();
        return $this->json_response(200, array('status' => 'success', 'data' => $semesters));
    }

    public function fee_invoices()
    {
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $type = $this->input->get('type', true);
            return $this->json_response(200, array(
                'status' => 'success',
                'data' => $this->Fee_model->list_invoices($type),
            ));
        }

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            return $this->create_fee_invoice();
        }

        return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
    }

    public function session_fee_settings()
    {
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            return $this->json_response(200, array(
                'status' => 'success',
                'data' => $this->Fee_model->list_session_fee_settings(),
            ));
        }

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        if (!$this->require_session_management_permission()) {
            return;
        }

        $result = $this->Fee_model->save_session_fee_setting(
            $this->json_payload(),
            $this->session->userdata('user_id')
        );
        if (isset($result['error'])) {
            return $this->json_response(isset($result['code']) ? (int) $result['code'] : 400, array(
                'status' => 'error',
                'message' => $result['error'],
            ));
        }

        return $this->json_response(200, array('status' => 'success', 'data' => $result['data']));
    }

    public function fee_invoice($id = null)
    {
        if (!$id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invoice id is required'));
        }

        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $invoice = $this->Fee_model->get_invoice($id);
            if (!$invoice) {
                return $this->json_response(404, array('status' => 'error', 'message' => 'Invoice not found'));
            }
            return $this->json_response(200, array('status' => 'success', 'data' => $invoice));
        }

        if ($_SERVER['REQUEST_METHOD'] === 'PUT' || $_SERVER['REQUEST_METHOD'] === 'PATCH') {
            $payload = $this->json_payload();
            $result = $this->Fee_model->update_invoice($id, $payload, $this->session->userdata('user_id'));
            if (isset($result['error'])) {
                return $this->json_response(isset($result['code']) ? $result['code'] : 400, array(
                    'status' => 'error',
                    'message' => $result['error'],
                ));
            }
            return $this->json_response(200, array('status' => 'success', 'data' => $result['data']));
        }

        if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
            $result = $this->Fee_model->delete_invoice($id, $this->session->userdata('user_id'));
            if (isset($result['error'])) {
                return $this->json_response(isset($result['code']) ? $result['code'] : 400, array(
                    'status' => 'error',
                    'message' => $result['error'],
                ));
            }
            return $this->json_response(200, array('status' => 'success', 'message' => 'Invoice deleted'));
        }

        return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
    }

    public function create_fee_invoice()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        $result = $this->Fee_model->create_invoice($this->json_payload(), $this->session->userdata('user_id'));
        if (isset($result['error'])) {
            return $this->json_response(isset($result['code']) ? $result['code'] : 400, array(
                'status' => 'error',
                'message' => $result['error'],
            ));
        }

        return $this->json_response(201, array('status' => 'success', 'data' => $result['data']));
    }

    public function update_fee_invoice()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        $payload = $this->json_payload();
        $id = $this->first_non_empty(array(
            isset($payload['id']) ? $payload['id'] : null,
            isset($payload['invoice_id']) ? $payload['invoice_id'] : null,
            isset($payload['invoiceCode']) ? $payload['invoiceCode'] : null,
        ));
        if (!$id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invoice id is required'));
        }

        $result = $this->Fee_model->update_invoice($id, $payload, $this->session->userdata('user_id'));
        if (isset($result['error'])) {
            return $this->json_response(isset($result['code']) ? $result['code'] : 400, array(
                'status' => 'error',
                'message' => $result['error'],
            ));
        }

        return $this->json_response(200, array('status' => 'success', 'data' => $result['data']));
    }

    public function delete_fee_invoice()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        $payload = $this->json_payload();
        $id = $this->first_non_empty(array(
            isset($payload['id']) ? $payload['id'] : null,
            isset($payload['invoice_id']) ? $payload['invoice_id'] : null,
        ));
        if (!$id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invoice id is required'));
        }

        $result = $this->Fee_model->delete_invoice($id, $this->session->userdata('user_id'));
        if (isset($result['error'])) {
            return $this->json_response(isset($result['code']) ? $result['code'] : 400, array(
                'status' => 'error',
                'message' => $result['error'],
            ));
        }

        return $this->json_response(200, array('status' => 'success', 'message' => 'Invoice deleted'));
    }

    public function publish_fee_invoice($id = null)
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        $payload = $this->json_payload();
        $id = $id ?: $this->first_non_empty(array(
            isset($payload['id']) ? $payload['id'] : null,
            isset($payload['invoice_id']) ? $payload['invoice_id'] : null,
        ));
        if (!$id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invoice id is required'));
        }

        $result = $this->Fee_model->publish_invoice($id, $this->session->userdata('user_id'));
        if (isset($result['error'])) {
            return $this->json_response(isset($result['code']) ? $result['code'] : 400, array(
                'status' => 'error',
                'message' => $result['error'],
            ));
        }

        return $this->json_response(200, array('status' => 'success', 'data' => $result['data']));
    }

    public function fee_summary()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        return $this->json_response(200, array('status' => 'success', 'data' => $this->Fee_model->summary()));
    }

    public function payments()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        $filters = array(
            'search' => $this->input->get('search', true),
            'status' => $this->input->get('status', true),
        );

        return $this->json_response(200, array(
            'status' => 'success',
            'data' => $this->Fee_model->admin_payment_dashboard($filters),
        ));
    }

    public function update_payment_status($id = null)
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'PATCH') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        $payload = $this->json_payload();
        $id = $id ?: $this->first_non_empty(array(
            isset($payload['id']) ? $payload['id'] : null,
            isset($payload['payment_id']) ? $payload['payment_id'] : null,
            isset($payload['reference']) ? $payload['reference'] : null,
        ));
        $status = $this->first_non_empty(array(
            isset($payload['status']) ? $payload['status'] : null,
            isset($payload['action']) ? $payload['action'] : null,
        ));

        if (!$id || !$status) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Payment id and status are required'));
        }

        $result = $this->Fee_model->update_admin_payment_status($id, $status, $this->session->userdata('user_id'));
        if (isset($result['error'])) {
            return $this->json_response(isset($result['code']) ? $result['code'] : 400, array(
                'status' => 'error',
                'message' => $result['error'],
            ));
        }

        return $this->json_response(200, array(
            'status' => 'success',
            'message' => 'Payment updated successfully',
            'data' => $result['data'],
        ));
    }

    public function export_payments_csv()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        $filters = array(
            'search' => $this->input->get('search', true),
            'status' => $this->input->get('status', true),
        );
        $filename = 'payment-transactions-' . date('Ymd-His') . '.csv';
        $this->output
            ->set_content_type('text/csv')
            ->set_header('Content-Disposition: attachment; filename="' . $filename . '"');

        $out = fopen('php://output', 'w');
        fputcsv($out, array('Reference', 'Receipt', 'Student ID', 'Student', 'Email', 'Program', 'Type', 'Amount', 'Method', 'Date', 'Status'));
        foreach ($this->Fee_model->export_payment_rows($filters) as $row) {
            fputcsv($out, array(
                isset($row['reference']) ? $row['reference'] : '',
                isset($row['receiptNo']) ? $row['receiptNo'] : '',
                isset($row['studentId']) ? $row['studentId'] : '',
                isset($row['studentName']) ? $row['studentName'] : '',
                isset($row['studentEmail']) ? $row['studentEmail'] : '',
                isset($row['program']) ? $row['program'] : '',
                isset($row['type']) ? $row['type'] : '',
                isset($row['amount']) ? $row['amount'] : '',
                isset($row['method']) ? $row['method'] : '',
                isset($row['date']) ? $row['date'] : '',
                isset($row['status']) ? $row['status'] : '',
            ));
        }
        fclose($out);
    }

    public function dashboard()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        return $this->json_response(200, array(
            'status' => 'success',
            'data' => $this->build_admin_dashboard_data(),
        ));
    }

    public function fee_students()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        return $this->json_response(200, array('status' => 'success', 'data' => $this->Fee_model->student_options()));
    }

    public function export_fee_invoices_csv()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        $filename = 'fee-invoices-' . date('Ymd-His') . '.csv';
        $this->output
            ->set_content_type('text/csv')
            ->set_header('Content-Disposition: attachment; filename="' . $filename . '"');

        $out = fopen('php://output', 'w');
        fputcsv($out, array('Invoice ID', 'Type', 'Title', 'Amount', 'Due Date', 'Status', 'Students Affected'));
        foreach ($this->Fee_model->export_rows() as $row) {
            fputcsv($out, array(
                isset($row['id']) ? $row['id'] : '',
                isset($row['type']) ? $row['type'] : '',
                isset($row['title']) ? $row['title'] : '',
                isset($row['amount']) ? $row['amount'] : '',
                isset($row['dueDate']) ? $row['dueDate'] : '',
                isset($row['status']) ? $row['status'] : '',
                isset($row['studentsAffected']) ? $row['studentsAffected'] : '',
            ));
        }
        fclose($out);
    }

    // List students for admin
    public function get_students()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!$this->Student_model->tables_ready()) {
            return $this->json_response(404, array('status' => 'error', 'message' => 'Student tables not found'));
        }

        $page = max(1, (int) $this->input->get('page', true));
        $perPage = (int) $this->input->get('per_page', true);
        $perPage = max(10, min($perPage ?: 25, 100));
        $filters = array(
            'search' => trim((string) $this->input->get('search', true)),
            'status' => $this->input->get('status', true),
            'department_id' => $this->input->get('department_id', true),
            'programme_id' => $this->input->get('programme_id', true),
            'level' => $this->input->get('level', true),
            'session' => $this->input->get('session', true),
            'profile_status' => $this->input->get('profile_status', true),
        );

        $total = $this->Student_model->count_students($filters);
        $totalPages = max(1, (int) ceil($total / $perPage));
        $page = min($page, $totalPages);
        $offset = ($page - 1) * $perPage;
        $students = $this->Student_model->list_students($filters, $perPage, $offset);
        $summary = $this->Student_model->student_summary();
        $from = $total > 0 ? $offset + 1 : 0;
        $to = $total > 0 ? min($offset + count($students), $total) : 0;

        return $this->json_response(200, array(
            'status' => 'success',
            'data' => $students,
            'meta' => array(
                'counts' => $summary['counts'],
                'summary' => $summary,
                'pagination' => array(
                    'page' => $page,
                    'per_page' => $perPage,
                    'total' => $total,
                    'total_pages' => $totalPages,
                    'from' => $from,
                    'to' => $to,
                ),
                'filter_options' => $this->Student_model->student_filter_options(),
            ),
        ));
    }


    public function export_students_csv()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!$this->Student_model->tables_ready()) {
            return $this->json_response(404, array('status' => 'error', 'message' => 'Student tables not found'));
        }

        $filters = array(
            'search' => trim((string) $this->input->get('search', true)),
            'status' => $this->input->get('status', true),
            'department_id' => $this->input->get('department_id', true),
            'programme_id' => $this->input->get('programme_id', true),
            'level' => $this->input->get('level', true),
            'session' => $this->input->get('session', true),
            'profile_status' => $this->input->get('profile_status', true),
        );

        $result = $this->Student_model->export_students_rows($filters);
        $students = isset($result['students']) ? $result['students'] : array();
        $programmes = isset($result['programmes']) ? $result['programmes'] : array();

        $stream = fopen('php://temp', 'r+');

        $headers = array(
            'first_name',
            'last_name',
            'other_name',
            'email',
            'phone_number',
            'admission_number',
            'matric_number',
            'department',
            'programme',
            'level_of_admission',
            'current_level',
            'session_of_entry',
            'entry_mode',
            'status',
            'temporary_password',
            'gender',
            'dob',
            'nin',
            'address',
            'state',
            'lga',
            'programme_reference',
            'reference_department',
            'reference_code',
            'reference_structure',
            'reference_duration_years',
        );
        fputcsv($stream, $headers);

        $cleanStr = function($text) {
            if ($text === null || $text === '') return '';
            return str_replace(array("\xEF\xBF\xBD", "\u{FFFD}", "\xE2\x80\x99", "\xE2\x80\x98", '’', '‘', '`'), "'", trim((string) $text));
        };

        $femaleNames = array(
            'aisha' => true, 'aishat' => true, 'aishatu' => true, 'amina' => true, 'aminat' => true, 'aminatu' => true,
            'asiya' => true, 'asiyatu' => true, 'asma' => true, 'asmau' => true, "asma'u" => true, 'balkisu' => true,
            'bilkisu' => true, 'binta' => true, 'fadima' => true, 'fadimatu' => true, 'fati' => true, 'fatima' => true,
            'fatimah' => true, 'fatimatu' => true, 'fauziya' => true, 'fauziyya' => true, 'habiba' => true, 'habibatu' => true,
            'hadiza' => true, 'hadizatu' => true, 'hafsa' => true, 'hafsat' => true, 'halima' => true, 'halimatu' => true,
            'hasana' => true, 'hassana' => true, 'hauwa' => true, "hauwa'u" => true, 'hauwau' => true, 'husaina' => true,
            'hussaina' => true, 'jamila' => true, 'jamilatu' => true, 'jummai' => true, 'khadija' => true, 'khadijah' => true,
            'kubra' => true, 'kulu' => true, 'laraba' => true, 'laure' => true, 'lubabatu' => true, 'maimuna' => true,
            'maimunatu' => true, 'mansura' => true, 'maryam' => true, 'maryama' => true, 'murja' => true, 'nafisa' => true,
            'nafisatu' => true, "naja'atu" => true, 'najaatu' => true, 'rabi' => true, 'rabia' => true, "rabi'a" => true,
            "rabi'atu" => true, 'rabiatu' => true, 'rahama' => true, 'rahamatu' => true, 'rukayya' => true, 'rukayyat' => true,
            'ruqayya' => true, 'ruqayyat' => true, 'sadiya' => true, 'sadiyatu' => true, 'safiya' => true, 'safiyatu' => true,
            'sakina' => true, 'sakinatu' => true, 'salma' => true, 'samira' => true, 'saratu' => true, 'saudat' => true,
            'shafa' => true, "shafa'atu" => true, 'shafaatu' => true, 'sumayya' => true, 'sumayyatu' => true, 'umma' => true,
            'ummi' => true, 'zahra' => true, "zahra'u" => true, 'zahrau' => true, 'zainab' => true, 'zainabu' => true,
            'zulaiha' => true, 'zulaihat' => true, 'mary' => true, 'grace' => true, 'faith' => true, 'mercy' => true,
            'blessing' => true, 'patience' => true, 'esther' => true, 'joy' => true, 'peace' => true, 'comfort' => true,
            'sarah' => true, 'ruth' => true,
        );

        $inferGender = function($firstName, $rawGender) use ($femaleNames) {
            if ($rawGender !== null && $rawGender !== '') {
                $g = strtolower(trim((string) $rawGender));
                if (strpos($g, 'f') === 0) return 'Female';
                if (strpos($g, 'm') === 0) return 'Male';
            }
            $cleanFirst = strtolower(preg_replace('/[^a-zA-Z\']/', '', (string) $firstName));
            $cleanNoQuote = str_replace("'", '', $cleanFirst);
            if (isset($femaleNames[$cleanFirst]) || isset($femaleNames[$cleanNoQuote])) {
                return 'Female';
            }
            return 'Male';
        };

        $maxRows = max(count($students), count($programmes));

        for ($i = 0; $i < $maxRows; $i++) {
            $student = isset($students[$i]) ? $students[$i] : null;
            $prog = isset($programmes[$i]) ? $programmes[$i] : null;

            // If reference programmes run out, match each student's programme or cycle
            if (!$prog && $student && !empty($programmes)) {
                $studentProgName = strtolower(trim(isset($student['programme_name']) ? (string)$student['programme_name'] : ''));
                foreach ($programmes as $p) {
                    if (strtolower(trim(isset($p['name']) ? (string)$p['name'] : '')) === $studentProgName) {
                        $prog = $p;
                        break;
                    }
                }
                if (!$prog) {
                    $prog = $programmes[$i % count($programmes)];
                }
            }

            if ($student) {
                $fullName = $cleanStr(isset($student['full_name']) ? $student['full_name'] : '');
                $firstName = $cleanStr(!empty($student['ap_first_name']) ? $student['ap_first_name'] : '');
                $lastName = $cleanStr(!empty($student['ap_last_name']) ? $student['ap_last_name'] : '');
                $otherName = $cleanStr(!empty($student['ap_other_name']) ? $student['ap_other_name'] : '');

                if ($firstName === '' || $lastName === '') {
                    $split = $this->Student_model->split_name($fullName);
                    if ($firstName === '') $firstName = $split['first_name'];
                    if ($lastName === '') $lastName = $split['last_name'];
                    if ($otherName === '' && !empty($split['other_name'])) $otherName = $split['other_name'];
                }

                $phone = !empty($student['phone']) ? $student['phone'] : (!empty($student['ap_phone']) ? $student['ap_phone'] : '');
                $rawGender = !empty($student['user_gender']) ? $student['user_gender'] : (!empty($student['ap_gender']) ? $student['ap_gender'] : '');
                $gender = $inferGender($firstName, $rawGender);

                $dob = !empty($student['user_dob']) ? $student['user_dob'] : (!empty($student['ap_dob']) ? $student['ap_dob'] : '2000-01-01');

                $nin = !empty($student['user_nin']) ? $student['user_nin'] : (!empty($student['ap_nin']) ? $student['ap_nin'] : '');
                if ($nin === '') {
                    $phoneDigits = preg_replace('/\D/', '', (string) $phone);
                    $nin = strlen($phoneDigits) === 11 ? $phoneDigits : (string) (20260000001 + $i);
                }

                $address = !empty($student['user_address']) ? $student['user_address'] : (!empty($student['ap_address']) ? $student['ap_address'] : 'Funtua, Katsina State');
                $state = !empty($student['user_state']) ? $student['user_state'] : (!empty($student['ap_state']) ? $student['ap_state'] : 'Katsina');
                $lga = !empty($student['user_lga']) ? $student['user_lga'] : (!empty($student['ap_lga']) ? $student['ap_lga'] : 'Funtua');

                $currentLevel = isset($student['current_level']) && $student['current_level'] !== '' ? $student['current_level'] : '100';
                $levelOfAdmission = !empty($student['admission_level']) ? $student['admission_level'] : $currentLevel;
                $matricNumber = !empty($student['matric_number']) ? $student['matric_number'] : (!empty($student['admission_number']) ? $student['admission_number'] : '');
                $sessionName = !empty($student['session_name']) ? $student['session_name'] : '2026/2027';
                $entryMode = !empty($student['entry_mode']) ? $student['entry_mode'] : 'Direct Entry';
                $status = !empty($student['student_status']) ? $student['student_status'] : 'active';

                $row = array(
                    $firstName,
                    $lastName,
                    $otherName,
                    isset($student['email']) ? $student['email'] : '',
                    $phone,
                    isset($student['admission_number']) ? $student['admission_number'] : '',
                    $matricNumber,
                    $cleanStr(isset($student['department_name']) ? $student['department_name'] : ''),
                    $cleanStr(isset($student['programme_name']) ? $student['programme_name'] : ''),
                    $levelOfAdmission,
                    $currentLevel,
                    $sessionName,
                    $entryMode,
                    $status,
                    'ChangeMe123!',
                    $gender,
                    $dob,
                    $nin,
                    $cleanStr($address),
                    $cleanStr($state),
                    $cleanStr($lga),
                );
            } else {
                $row = array_fill(0, 21, '');
            }

            if ($prog) {
                $row[] = $cleanStr(isset($prog['name']) ? $prog['name'] : '');
                $row[] = $cleanStr(isset($prog['department_name']) ? $prog['department_name'] : '');
                $row[] = isset($prog['code']) ? $prog['code'] : '';
                $row[] = isset($prog['programme_structure']) ? $prog['programme_structure'] : 'semester';
                $row[] = isset($prog['duration_years']) && $prog['duration_years'] !== '' ? (string) $prog['duration_years'] : '3';
            } else {
                $row[] = '';
                $row[] = '';
                $row[] = '';
                $row[] = '';
                $row[] = '';
            }

            fputcsv($stream, $row);
        }

        rewind($stream);
        $csv = stream_get_contents($stream);
        fclose($stream);

        $filename = 'students_export_' . date('Ymd_His') . '.csv';

        if ($this->input->get('download') === '1') {
            $this->output
                ->set_content_type('text/csv')
                ->set_header('Content-Disposition: attachment; filename="' . $filename . '"')
                ->set_output($csv);
            return;
        }

        return $this->json_response(200, array(
            'status' => 'success',
            'data' => array(
                'file_name' => $filename,
                'csv' => $csv,
                'count' => count($students),
            ),
        ));
    }


    public function delete_students()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();
        
        $payload = json_decode(file_get_contents('php://input'), true);
        if (!is_array($payload)) $payload = array();
        
        $student_ids = isset($payload['student_ids']) && is_array($payload['student_ids']) ? array_values(array_filter($payload['student_ids'])) : array();
        $delete_all = !empty($payload['delete_all']);
        
        if (empty($student_ids) && !$delete_all) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Select at least one student or choose delete all'));
        }
        
        // 1. Resolve which students to delete
        $filters = array(
            'search' => trim((string) ($payload['search'] ?? '')),
            'status' => $payload['status'] ?? null,
            'department_id' => $payload['department_id'] ?? null,
            'programme_id' => $payload['programme_id'] ?? null,
            'level' => $payload['level'] ?? null,
            'session' => $payload['session'] ?? null,
            'profile_status' => $payload['profile_status'] ?? null,
        );

        $hasAdmissions = $this->db->table_exists('admissions');
        $this->db->select('s.id, s.user_id, s.admission_id');
        $this->db->from('students s');
        $this->db->join('users u', 'u.id = s.user_id', 'left');
        if ($hasAdmissions) {
            $this->db->join('admissions adm', 'adm.id = s.admission_id', 'left');
        }
        $this->db->join('programmes p', 'p.id = s.programme_id', 'left');
        $this->db->join('departments d', 'd.id = s.department_id', 'left');
        
        if (!empty($filters['status']) && $filters['status'] !== 'all') {
            $this->db->where('s.status', $filters['status']);
        }
        if (!empty($filters['department_id']) && $filters['department_id'] !== 'all') {
            $this->db->where('s.department_id', $filters['department_id']);
        }
        
        if ($this->db->field_exists('deleted_at', 'students')) {
            $this->db->where('s.deleted_at IS NULL', null, false);
        }
        if (!empty($filters['programme_id']) && $filters['programme_id'] !== 'all') {
            $this->db->where('s.programme_id', $filters['programme_id']);
        }
        if (!empty($filters['level']) && $filters['level'] !== 'all') {
            $this->db->where('s.current_level', $filters['level']);
        }
        if (!empty($filters['session']) && $filters['session'] !== 'all' && $this->db->field_exists('session_name', 'students')) {
            $this->db->where('s.session_name', $filters['session']);
        }
        if (!empty($filters['profile_status']) && $filters['profile_status'] !== 'all' && $this->db->field_exists('account_update_required', 'students')) {
            $this->db->where('s.account_update_required', $filters['profile_status'] === 'update_required' ? 1 : 0);
        }
        
        $search = $filters['search'];
        if ($search !== '') {
            $this->db->group_start();
            $this->db->like('u.full_name', $search)->or_like('u.email', $search)->or_like('u.phone', $search);
            $this->db->or_like('p.name', $search)->or_like('p.code', $search);
            $this->db->or_like('d.name', $search)->or_like('d.code', $search);
            if ($hasAdmissions) {
                $this->db->or_like('adm.matric_number', $search)->or_like('adm.admission_number', $search);
            }
            $this->db->group_end();
        }

        if (!$delete_all) {
            $this->db->where_in('s.id', $student_ids);
        }

        $students = $this->db->get()->result_array();
        if (empty($students)) {
            return $this->json_response(404, array('status' => 'error', 'message' => 'No matching students found'));
        }

        $student_ids_to_delete = array_column($students, 'id');
        $user_ids = array_filter(array_column($students, 'user_id'));
        $admission_ids = array_filter(array_column($students, 'admission_id'));

        if (!empty($payload['dry_run'])) {
            return $this->json_response(200, array(
                'status' => 'success',
                'dry_run' => true,
                'data' => array(
                    'students' => count($student_ids_to_delete)
                )
            ));
        }

        $this->db->trans_start();

        // 1. Delete result attempts
        if ($this->db->table_exists('result_attempts')) {
            foreach (array_chunk($student_ids_to_delete, 500) as $chunk) {
                $this->db->where_in('student_id', $chunk);
                $this->db->delete('result_attempts');
            }
        }
        
        // 2. Delete course registrations
        if ($this->db->table_exists('course_registrations')) {
            $reg_ids = array();
            foreach (array_chunk($student_ids_to_delete, 500) as $chunk) {
                $this->db->select('id');
                $this->db->where_in('student_id', $chunk);
                $regs = $this->db->get('course_registrations')->result_array();
                foreach ($regs as $r) $reg_ids[] = $r['id'];
            }
            if (!empty($reg_ids)) {
                foreach (array_chunk($reg_ids, 500) as $chunk) {
                    $this->db->where_in('registration_id', $chunk);
                    $this->db->delete('course_registration_items');
                    if ($this->db->table_exists('course_registration_amendments')) {
                        $this->db->where_in('registration_id', $chunk);
                        $this->db->delete('course_registration_amendments');
                    }
                    $this->db->where_in('id', $chunk);
                    $this->db->delete('course_registrations');
                }
            }
        }

        // 3. Delete fees/wallet
        if ($this->db->table_exists('student_fee_payments')) {
            foreach (array_chunk($student_ids_to_delete, 500) as $chunk) {
                $this->db->where_in('student_id', $chunk);
                $this->db->delete('student_fee_payments');
            }
        }
        if ($this->db->table_exists('fee_invoices')) {
            foreach (array_chunk($student_ids_to_delete, 500) as $chunk) {
                $this->db->where_in('student_id', $chunk);
                $this->db->delete('fee_invoices');
            }
        }
        if ($this->db->table_exists('student_wallet_transactions')) {
            foreach (array_chunk($student_ids_to_delete, 500) as $chunk) {
                $this->db->where_in('student_id', $chunk);
                $this->db->delete('student_wallet_transactions');
            }
        }

        // 4. RBAC_model->delete_user_cascade already deletes students, applicants, applications, user_roles, users
        if (!empty($user_ids)) {
            $this->load->model('RBAC_model');
            foreach (array_unique($user_ids) as $uid) {
                $this->RBAC_model->delete_user_cascade($uid);
            }
        }

        // 5. If there are admissions tied to them, remove them
        if (!empty($admission_ids) && $hasAdmissions) {
            foreach (array_chunk(array_unique($admission_ids), 500) as $chunk) {
                $this->db->where_in('id', $chunk);
                $this->db->delete('admissions');
            }
        }

        $this->db->trans_complete();

        if ($this->db->trans_status() === false) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Failed to delete students'));
        }

        return $this->json_response(200, array(
            'status' => 'success',
            'message' => count($student_ids_to_delete) . ' student(s) deleted successfully'
        ));
    }

    public function update_session()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!$this->require_session_management_permission()) {
            return;
        }

        if (!$this->Courses_model->tables_ready()) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Course tables not found'));
        }

        $payload = json_decode($this->input->raw_input_stream, true);
        if (!is_array($payload)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid JSON payload'));
        }

        $session_id = isset($payload['session_id']) ? $payload['session_id'] : null;
        $name = isset($payload['name']) ? trim((string) $payload['name']) : '';
        $start_date = isset($payload['start_date']) ? trim((string) $payload['start_date']) : null;
        $end_date = isset($payload['end_date']) ? trim((string) $payload['end_date']) : null;

        if (!$session_id || $name === '') {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Session id and name are required'));
        }
        if (($start_date && !$this->is_valid_session_date($start_date)) || ($end_date && !$this->is_valid_session_date($end_date))) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Session dates must use the YYYY-MM-DD format'));
        }
        if ($start_date && $end_date && $start_date > $end_date) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Session end date must be on or after the start date'));
        }

        $result = $this->Courses_model->update_session($session_id, $name, $start_date, $end_date);
        if (!$result['success']) {
            return $this->json_response(isset($result['code']) ? (int) $result['code'] : 400, array(
                'status' => 'error',
                'message' => $result['message'],
            ));
        }

        return $this->json_response(200, array('status' => 'success', 'message' => $result['message']));
    }

    public function delete_session()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!$this->require_session_management_permission()) {
            return;
        }

        if (!$this->Courses_model->tables_ready()) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Course tables not found'));
        }

        $payload = json_decode($this->input->raw_input_stream, true);
        if (!is_array($payload)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid JSON payload'));
        }

        $session_id = isset($payload['session_id']) ? $payload['session_id'] : null;
        $result = $this->Courses_model->delete_session($session_id);
        if (!$result['success']) {
            return $this->json_response(isset($result['code']) ? (int) $result['code'] : 400, array(
                'status' => 'error',
                'message' => $result['message'],
                'has_dependencies' => !empty($result['has_dependencies']),
            ));
        }

        return $this->json_response(200, array('status' => 'success', 'message' => $result['message']));
    }

    public function archive_session()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        if (!$this->require_session_management_permission()) {
            return;
        }

        $payload = json_decode($this->input->raw_input_stream, true);
        if (!is_array($payload)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid JSON payload'));
        }
        $result = $this->Courses_model->archive_session(
            isset($payload['session_id']) ? $payload['session_id'] : null,
            isset($payload['reason']) ? $payload['reason'] : '',
            $this->session->userdata('user_id')
        );
        if (!$result['success']) {
            return $this->json_response(isset($result['code']) ? (int) $result['code'] : 400, array(
                'status' => 'error',
                'message' => $result['message'],
                'has_dependencies' => !empty($result['has_dependencies']),
            ));
        }

        return $this->json_response(200, array('status' => 'success', 'message' => $result['message']));
    }

    public function update_student()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        $payload = $this->json_payload();
        $student_id = isset($payload['id']) ? $payload['id'] : null;

        if (!$student_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Student ID is required'));
        }

        $this->db->where('id', $student_id);
        $student = $this->db->get('students')->row_array();
        if (!$student) {
            return $this->json_response(404, array('status' => 'error', 'message' => 'Student not found'));
        }

        $user_id = $student['user_id'];

        $this->db->trans_start();

        // Update Users Table (full_name, email, personal profile fields)
        $user_updates = array();
        if (isset($payload['full_name']) && trim($payload['full_name']) !== '') {
            $user_updates['full_name'] = str_replace(array("\xEF\xBF\xBD", "\u{FFFD}", "\xE2\x80\x99", "\xE2\x80\x98", '’', '‘', '`'), "'", trim($payload['full_name']));
        }
        if (isset($payload['email']) && trim($payload['email']) !== '') {
            $user_updates['email'] = trim($payload['email']);
        }
        foreach (array('phone', 'dob', 'gender', 'nin', 'address', 'state', 'lga', 'guardian_name', 'guardian_phone', 'guardian_relationship', 'guardian_address', 'next_of_kin', 'next_of_kin_phone') as $field) {
            if (array_key_exists($field, $payload) && $this->db->field_exists($field, 'users')) {
                $value = is_string($payload[$field]) ? trim($payload[$field]) : $payload[$field];
                $user_updates[$field] = $value === '' ? null : $value;
            }
        }
        
        if (!empty($user_updates)) {
            $this->db->where('id', $user_id);
            $this->db->update('users', $user_updates);
        }

        // Update Students Table (current_level, status)
        $student_updates = array();
        if (isset($payload['current_level'])) {
            $student_updates['current_level'] = trim($payload['current_level']);
        }
        if (isset($payload['status'])) {
            $student_updates['status'] = trim($payload['status']);
        }
        $academic_placement_changed = array_key_exists('programme_id', $payload)
            || array_key_exists('department_id', $payload);
        $programme_id = trim((string)($payload['programme_id'] ?? $student['programme_id'] ?? ''));
        $department_id = trim((string)($payload['department_id'] ?? $student['department_id'] ?? ''));

        if ($academic_placement_changed) {
            if ($programme_id === '' || $department_id === '') {
                $this->db->trans_rollback();
                return $this->json_response(400, array('status' => 'error', 'message' => 'Department and programme are required'));
            }
            $programme = $this->db->get_where('programmes', array('id' => $programme_id), 1)->row_array();
            if (!$programme) {
                $this->db->trans_rollback();
                return $this->json_response(400, array('status' => 'error', 'message' => 'Selected programme does not exist'));
            }
            $department = $this->db->get_where('departments', array('id' => $department_id), 1)->row_array();
            if (!$department) {
                $this->db->trans_rollback();
                return $this->json_response(400, array('status' => 'error', 'message' => 'Selected department does not exist'));
            }
            if ($programme['department_id'] !== $department_id) {
                $this->db->trans_rollback();
                return $this->json_response(400, array('status' => 'error', 'message' => 'Selected programme does not belong to the selected department'));
            }
            $student_updates['programme_id'] = $programme_id;
            $student_updates['department_id'] = $department_id;
        }

        $session_name = isset($payload['session_name']) ? trim((string)$payload['session_name']) : null;
        if ($session_name !== null && $session_name === '') {
            $this->db->trans_rollback();
            return $this->json_response(400, array('status' => 'error', 'message' => 'Academic session is required'));
        }
        if ($session_name !== null && $this->db->field_exists('session_name', 'students')) {
            $student_updates['session_name'] = $session_name;
        }

        $effectiveSessionName = $session_name !== null
            ? $session_name
            : (isset($student['session_name']) ? trim((string) $student['session_name']) : '');
        $effectiveEntryMode = isset($payload['entry_mode']) && trim((string) $payload['entry_mode']) !== ''
            ? trim((string) $payload['entry_mode'])
            : (isset($student['entry_mode']) ? trim((string) $student['entry_mode']) : '');
        if (isset($payload['entry_mode']) && $this->db->field_exists('entry_mode', 'students')) {
            $student_updates['entry_mode'] = $this->Student_model->normalize_entry_mode_label($effectiveEntryMode, isset($payload['current_level']) ? $payload['current_level'] : null);
            $effectiveEntryMode = $student_updates['entry_mode'];
        }
        if ($effectiveSessionName !== '') {
            $student_updates['current_level'] = $this->Student_model->calculate_student_level(
                $effectiveSessionName,
                $effectiveEntryMode,
                isset($payload['current_level']) ? $payload['current_level'] : (isset($student['current_level']) ? $student['current_level'] : null),
                $programme_id
            );
        }

        if (!empty($student_updates)) {
            $this->db->where('id', $student_id);
            $this->db->update('students', $student_updates);
        }

        // Update Admissions Table (admission_number / matric_number)
        if (isset($payload['matric_number']) && !empty($student['admission_id'])) {
            $this->db->where('id', $student['admission_id']);
            $this->db->update('admissions', array(
                'admission_number' => trim($payload['matric_number'])
            ));
        }

        if ($session_name !== null && !empty($student['admission_id'])
            && $this->db->field_exists('session_id', 'admissions')
            && $this->db->table_exists('academic_sessions')) {
            $session = $this->db->get_where('academic_sessions', array('name' => $session_name), 1)->row_array();
            if (!$session) {
                $this->db->trans_rollback();
                return $this->json_response(400, array('status' => 'error', 'message' => 'Selected academic session does not exist'));
            }
            $this->db->where('id', $student['admission_id']);
            $this->db->update('admissions', array('session_id' => $session['id']));
        }

        $this->db->trans_complete();

        if ($this->db->trans_status() === FALSE) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Failed to update student'));
        }

        return $this->json_response(200, array('status' => 'success', 'message' => 'Student updated successfully'));
    }

    public function get_student_profile()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!$this->Student_model->tables_ready()) {
            return $this->json_response(404, array('status' => 'error', 'message' => 'Student tables not found'));
        }

        $student_id = $this->input->get('student_id', true);
        $user_id = $this->input->get('user_id', true);
        $email = $this->input->get('email', true);

        if (!$user_id && $student_id && $this->db->table_exists('students')) {
            $student = $this->db->get_where('students', array('id' => $student_id), 1)->row_array();
            if ($student && isset($student['user_id'])) {
                $user_id = $student['user_id'];
            }
        }

        if (!$user_id && $email && $this->db->table_exists('users')) {
            $user = $this->db->get_where('users', array('email' => $email), 1)->row_array();
            if ($user && isset($user['id'])) {
                $user_id = $user['id'];
            }
        }

        if (!$user_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Student identifier is required'));
        }

        $profile = $this->Student_model->get_profile_by_user_id($user_id);
        if (!$profile) {
            return $this->json_response(404, array('status' => 'error', 'message' => 'Student profile not found'));
        }

        return $this->json_response(200, array(
            'status' => 'success',
            'data' => $this->build_admin_student_profile_payload($profile),
        ));
    }

    private function build_admin_student_profile_payload($profile)
    {
        if (!is_array($profile)) {
            return array();
        }

        return array(
            'id' => isset($profile['id']) ? $profile['id'] : null,
            'student_id' => isset($profile['student_id']) ? $profile['student_id'] : null,
            'full_name' => isset($profile['full_name']) ? str_replace(array("\xEF\xBF\xBD", "\u{FFFD}", "\xE2\x80\x99", "\xE2\x80\x98", '’', '‘', '`'), "'", $profile['full_name']) : null,
            'email' => isset($profile['email']) ? $profile['email'] : null,
            'phone' => isset($profile['phone']) ? $profile['phone'] : null,
            'nin' => isset($profile['nin']) ? $profile['nin'] : null,
            'dob' => isset($profile['dob']) ? $profile['dob'] : null,
            'gender' => isset($profile['gender']) ? $profile['gender'] : null,
            'address' => isset($profile['address']) ? $profile['address'] : null,
            'state' => isset($profile['state']) ? $profile['state'] : null,
            'lga' => isset($profile['lga']) ? $profile['lga'] : null,
            'guardian_name' => isset($profile['guardian_name']) ? $profile['guardian_name'] : null,
            'guardian_phone' => isset($profile['guardian_phone']) ? $profile['guardian_phone'] : null,
            'guardian_relationship' => isset($profile['guardian_relationship']) ? $profile['guardian_relationship'] : null,
            'guardian_address' => isset($profile['guardian_address']) ? $profile['guardian_address'] : null,
            'next_of_kin' => isset($profile['next_of_kin']) ? $profile['next_of_kin'] : null,
            'next_of_kin_phone' => isset($profile['next_of_kin_phone']) ? $profile['next_of_kin_phone'] : null,
            'session' => isset($profile['session_name']) ? $profile['session_name'] : null,
            'entry_mode' => isset($profile['entry_mode']) ? $profile['entry_mode'] : null,
            'current_level' => isset($profile['current_level']) ? $profile['current_level'] : null,
            'student_status' => isset($profile['student_status']) ? $profile['student_status'] : null,
            'programme_name' => isset($profile['programme_name']) ? $profile['programme_name'] : null,
            'department_name' => isset($profile['department_name']) ? $profile['department_name'] : null,
            'admission_number' => isset($profile['admission_number']) ? $profile['admission_number'] : null,
            'matric_number' => isset($profile['matric_number']) ? $profile['matric_number'] : null,
            'application_no' => isset($profile['application_no']) ? $profile['application_no'] : null,
            'onboarding_source' => isset($profile['onboarding_source']) ? $profile['onboarding_source'] : null,
            'profile_completion_status' => isset($profile['profile_completion_status']) ? $profile['profile_completion_status'] : null,
            'account_update_required' => isset($profile['account_update_required']) ? (int) $profile['account_update_required'] : 0,
            'education' => isset($profile['education']) ? $profile['education'] : null,
            'academic' => isset($profile['academic']) ? $profile['academic'] : null,
            'oLevel' => isset($profile['oLevel']) ? $profile['oLevel'] : null,
        );
    }

    public function bulk_onboard_students_csv()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!$this->Student_model->tables_ready()) {
            return $this->json_response(404, array('status' => 'error', 'message' => 'Student tables not found'));
        }

        $payload = $this->json_payload();
        $csv = isset($payload['csv']) ? $payload['csv'] : null;
        if (!$csv || !is_string($csv)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'CSV content is required'));
        }

        $parsed = $this->parse_csv_rows($csv);
        if (!isset($parsed['rows']) || !is_array($parsed['rows'])) {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => isset($parsed['message']) ? $parsed['message'] : 'Unable to parse CSV',
            ));
        }

        $result = $this->Student_model->bulk_onboard_students(
            $parsed['rows'],
            array(
                'default_status' => isset($payload['default_status']) ? $payload['default_status'] : 'active',
                'notify_students' => !empty($payload['notify_students']),
            ),
            $this->session->userdata('user_id')
        );

        if (isset($result['error'])) {
            return $this->json_response(isset($result['code']) ? $result['code'] : 400, array(
                'status' => 'error',
                'message' => $result['error'],
            ));
        }

        $message = 'Bulk onboarding completed: ' .
            (int) $result['created'] . ' created, ' .
            (int) $result['updated'] . ' updated, ' .
            (int) $result['skipped'] . ' skipped.';

        return $this->json_response(200, array(
            'status' => 'success',
            'message' => $message,
            'data' => array(
                'created' => (int) $result['created'],
                'updated' => (int) $result['updated'],
                'skipped' => (int) $result['skipped'],
                'errors' => isset($result['errors']) ? $result['errors'] : array(),
                'credentials' => isset($result['credentials']) ? $result['credentials'] : array(),
            ),
        ));
    }

    // List admission applications for admin review
    public function get_applications()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!$this->applications_tables_ready()) {
            return $this->json_response(404, array('status' => 'error', 'message' => 'Application tables not found'));
        }

        $result = $this->build_application_review_data();

        return $this->json_response(200, array(
            'status' => 'success',
            'data' => isset($result['applications']) ? $result['applications'] : array(),
            'meta' => array('counts' => isset($result['counts']) ? $result['counts'] : array()),
        ));
    }

    // Export application review data as CSV
    public function export_applications_csv()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!$this->applications_tables_ready()) {
            return $this->json_response(404, array('status' => 'error', 'message' => 'Application tables not found'));
        }

        $result = $this->build_application_review_data();
        $rows = isset($result['applications']) ? $result['applications'] : array();

        $stream = fopen('php://temp', 'r+');
        $headers = array(
            'id',
            'application_no',
            'applicant_name',
            'email',
            'phone',
            'program',
            'entry_mode',
            'jamb_score',
            'o_level_grades',
            'status',
            'notes',
        );
        fputcsv($stream, $headers);

        foreach ($rows as $item) {
            fputcsv($stream, array(
                isset($item['id']) ? $item['id'] : null,
                isset($item['application_no']) ? $item['application_no'] : null,
                isset($item['applicant_name']) ? $item['applicant_name'] : null,
                isset($item['email']) ? $item['email'] : null,
                isset($item['phone']) ? $item['phone'] : null,
                isset($item['program']) ? $item['program'] : null,
                isset($item['entry_mode']) ? $item['entry_mode'] : null,
                isset($item['jamb_score']) ? $item['jamb_score'] : null,
                isset($item['o_level_grades']) ? $item['o_level_grades'] : null,
                isset($item['status']) ? $item['status'] : null,
                isset($item['notes']) ? $item['notes'] : null,
            ));
        }

        rewind($stream);
        $csv = stream_get_contents($stream);
        fclose($stream);

        return $this->json_response(200, array(
            'status' => 'success',
            'data' => array(
                'file_name' => 'applications-review-' . date('Ymd-His') . '.csv',
                'csv' => $csv,
                'total' => count($rows),
            ),
        ));
    }

    // Bulk admit from uploaded CSV rows
    public function bulk_admit_from_csv()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!$this->applications_tables_ready()) {
            return $this->json_response(404, array('status' => 'error', 'message' => 'Application tables not found'));
        }

        $payload = json_decode($this->input->raw_input_stream, true);
        if (!is_array($payload)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid JSON payload'));
        }

        $csv = isset($payload['csv']) ? $payload['csv'] : null;
        if (!$csv || !is_string($csv)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'CSV content is required'));
        }

        $requiredFields = array('programme_id', 'session', 'entry_level', 'mode_of_entry');
        $missing = array();
        foreach ($requiredFields as $field) {
            if (!isset($payload[$field]) || trim((string) $payload[$field]) === '') {
                $missing[] = $field;
            }
        }

        if (!empty($missing)) {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => 'Missing required admission fields: ' . implode(', ', $missing),
            ));
        }

        $parsed = $this->parse_csv_rows($csv);
        if (!isset($parsed['rows']) || !is_array($parsed['rows'])) {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => isset($parsed['message']) ? $parsed['message'] : 'Unable to parse CSV',
            ));
        }

        $rows = $parsed['rows'];
        $total = count($rows);
        $admitted = 0;
        $skipped = 0;
        $errors = array();

        foreach ($rows as $index => $rowItem) {
            $statusRaw = $this->first_non_empty(array(
                isset($rowItem['status']) ? $rowItem['status'] : null,
                isset($rowItem['decision']) ? $rowItem['decision'] : null,
                isset($rowItem['admission_status']) ? $rowItem['admission_status'] : null,
            ));
            $csvStatus = $this->normalize_csv_status($statusRaw);

            if ($csvStatus !== 'approved') {
                $skipped += 1;
                continue;
            }

            $applicationId = $this->first_non_empty(array(
                isset($rowItem['id']) ? $rowItem['id'] : null,
                isset($rowItem['application_id']) ? $rowItem['application_id'] : null,
            ));
            $applicationNo = isset($rowItem['application_no']) ? $rowItem['application_no'] : null;

            if (!$applicationId && !$applicationNo) {
                $errors[] = array(
                    'row' => $index + 2,
                    'message' => 'Missing id/application_no in CSV row',
                );
                continue;
            }

            $this->db->from('applications');
            if ($applicationId) {
                $this->db->where('id', $applicationId);
            } else {
                $this->db->where('application_no', $applicationNo);
            }
            $this->db->limit(1);
            $applicationRow = $this->db->get()->row_array();

            if (!$applicationRow) {
                $errors[] = array(
                    'row' => $index + 2,
                    'message' => 'Application not found for provided identifier',
                    'id' => $applicationId,
                    'application_no' => $applicationNo,
                );
                continue;
            }

            $currentStatus = $this->normalize_application_status(
                isset($applicationRow['status']) ? $applicationRow['status'] : null
            );
            if ($currentStatus === 'approved') {
                $skipped += 1;
                continue;
            }

            $notes = $this->first_non_empty(array(
                isset($rowItem['notes']) ? $rowItem['notes'] : null,
                isset($payload['notes']) ? $payload['notes'] : null,
            ));

            $applyResult = $this->apply_application_status_update(
                $applicationRow,
                'approved',
                $notes,
                $payload
            );

            if (!isset($applyResult['success']) || !$applyResult['success']) {
                $errors[] = array(
                    'row' => $index + 2,
                    'message' => isset($applyResult['message']) ? $applyResult['message'] : 'Failed to admit applicant',
                    'id' => isset($applicationRow['id']) ? $applicationRow['id'] : null,
                    'application_no' => isset($applicationRow['application_no']) ? $applicationRow['application_no'] : null,
                );
                continue;
            }

            $admitted += 1;
        }

        return $this->json_response(200, array(
            'status' => 'success',
            'message' => 'CSV admission processing completed',
            'data' => array(
                'total_rows' => $total,
                'admitted' => $admitted,
                'skipped' => $skipped,
                'failed' => count($errors),
                'errors' => $errors,
            ),
        ));
    }

    private function build_admin_dashboard_data()
    {
        $activeSession = $this->Courses_model->tables_ready()
            ? $this->Courses_model->get_active_session()
            : null;

        $applicationData = array(
            'applications' => array(),
            'counts' => $this->default_application_counts(),
        );
        if ($this->applications_tables_ready()) {
            $applicationData = $this->build_application_review_data();
        }

        $applicationCounts = array_merge(
            $this->default_application_counts(),
            isset($applicationData['counts']) && is_array($applicationData['counts'])
                ? $applicationData['counts']
                : array()
        );

        $applications = isset($applicationData['applications']) && is_array($applicationData['applications'])
            ? $applicationData['applications']
            : array();
        $paymentSummary = $this->dashboard_payment_summary();
        $hostelSummary = $this->dashboard_hostel_summary(isset($activeSession['id']) ? $activeSession['id'] : null);

        return array(
            'session' => array(
                'id' => isset($activeSession['id']) ? $activeSession['id'] : null,
                'name' => isset($activeSession['name']) ? $activeSession['name'] : null,
                'start_date' => isset($activeSession['start_date']) ? $activeSession['start_date'] : null,
                'end_date' => isset($activeSession['end_date']) ? $activeSession['end_date'] : null,
            ),
            'summary' => array(
                'totalStudents' => $this->dashboard_student_total(),
                'activeApplications' => count($applications),
                'monthlyRevenue' => isset($paymentSummary['monthlyRevenue']) ? (float) $paymentSummary['monthlyRevenue'] : 0.0,
                'hostelOccupancy' => isset($hostelSummary['occupancyRate']) ? (float) $hostelSummary['occupancyRate'] : 0.0,
                'reviewApplications' => (int) $applicationCounts['pending'] + (int) $applicationCounts['under_review'],
                'pendingPayments' => isset($paymentSummary['pendingItems']) ? (int) $paymentSummary['pendingItems'] : 0,
                'hostelRequests' => isset($hostelSummary['pendingRequests']) ? (int) $hostelSummary['pendingRequests'] : 0,
                'supportTickets' => 0,
            ),
            'recentApplications' => $this->dashboard_recent_applications($applications),
            'recentPayments' => $this->dashboard_recent_payments(),
            'meta' => array(
                'applicationCounts' => $applicationCounts,
                'hostel' => $hostelSummary,
            ),
        );
    }

    private function default_application_counts()
    {
        return array(
            'pending' => 0,
            'under_review' => 0,
            'approved' => 0,
            'rejected' => 0,
            'waitlisted' => 0,
        );
    }

    private function dashboard_student_total()
    {
        if (!$this->db->table_exists('students')) {
            return 0;
        }

        if ($this->db->field_exists('deleted_at', 'students')) {
            $this->db->where('deleted_at IS NULL', null, false);
        }

        return (int) $this->db->count_all_results('students');
    }

    private function dashboard_recent_applications($applications)
    {
        $recent = array();
        foreach (array_slice($applications, 0, 5) as $application) {
            $recent[] = array(
                'id' => isset($application['application_no']) && $application['application_no']
                    ? $application['application_no']
                    : (isset($application['id']) ? $application['id'] : null),
                'name' => isset($application['applicant_name']) ? $application['applicant_name'] : 'Unknown Applicant',
                'program' => isset($application['program']) ? $application['program'] : 'Unassigned Programme',
                'date' => isset($application['date_applied']) ? $application['date_applied'] : null,
                'status' => isset($application['status']) ? $application['status'] : 'pending',
            );
        }

        return $recent;
    }

    private function dashboard_payment_summary()
    {
        $summary = array(
            'monthlyRevenue' => 0.0,
            'pendingItems' => 0,
        );

        if ($this->db->table_exists('student_fee_payments')) {
            $startOfMonth = date('Y-m-01 00:00:00');
            $this->db->select('COALESCE(SUM(amount), 0) as monthly_revenue', false);
            $this->db->where_in('status', array('completed', 'success', 'successful', 'paid'));
            $this->db->where('paid_at >=', $startOfMonth);
            $row = $this->db->get('student_fee_payments')->row_array();
            $summary['monthlyRevenue'] = isset($row['monthly_revenue']) ? (float) $row['monthly_revenue'] : 0.0;
        }

        if ($this->db->table_exists('fee_invoice_rules')) {
            if ($this->db->field_exists('deleted_at', 'fee_invoice_rules')) {
                $this->db->where('deleted_at IS NULL', null, false);
            }
            if ($this->db->field_exists('status', 'fee_invoice_rules')) {
                $this->db->where_in('status', array('draft', 'published', 'pending', 'overdue'));
            }
            $summary['pendingItems'] = (int) $this->db->count_all_results('fee_invoice_rules');
        }

        return $summary;
    }

    private function dashboard_recent_payments()
    {
        if (!$this->db->table_exists('student_fee_payments')) {
            return array();
        }

        $this->db->select('p.invoice_code, p.amount, p.status, p.paid_at, p.created_at');
        if ($this->db->table_exists('users')) {
            $this->db->select('u.full_name');
        }
        if ($this->db->table_exists('fee_invoice_rules')) {
            $this->db->select('r.title as invoice_title');
        }
        $this->db->from('student_fee_payments p');
        if ($this->db->table_exists('users')) {
            $this->db->join('users u', 'u.id = p.user_id', 'left');
        }
        if ($this->db->table_exists('fee_invoice_rules')) {
            $this->db->join('fee_invoice_rules r', 'r.id = p.invoice_rule_id', 'left');
        }
        $this->db->order_by('p.paid_at', 'DESC');
        $rows = $this->db->get('', 5)->result_array();

        $payments = array();
        foreach ($rows as $row) {
            $status = isset($row['status']) ? strtolower((string) $row['status']) : 'completed';
            $payments[] = array(
                'student' => isset($row['full_name']) && $row['full_name'] ? $row['full_name'] : 'Unknown Student',
                'type' => isset($row['invoice_title']) && $row['invoice_title'] ? $row['invoice_title'] : (isset($row['invoice_code']) ? $row['invoice_code'] : 'Payment'),
                'amount' => isset($row['amount']) ? (float) $row['amount'] : 0.0,
                'status' => in_array($status, array('completed', 'success', 'successful', 'paid'), true) ? 'completed' : $status,
                'date' => isset($row['paid_at']) ? $row['paid_at'] : (isset($row['created_at']) ? $row['created_at'] : null),
            );
        }

        return $payments;
    }

    private function dashboard_hostel_summary($session_id = null)
    {
        $summary = array(
            'capacity' => 0,
            'occupied' => 0,
            'occupancyRate' => 0.0,
            'pendingRequests' => 0,
        );

        if ($this->db->table_exists('hostel_bed_spaces')) {
            if ($this->db->field_exists('deleted_at', 'hostel_bed_spaces')) {
                $this->db->where('deleted_at IS NULL', null, false);
            }
            $summary['capacity'] = (int) $this->db->count_all_results('hostel_bed_spaces');
        } elseif ($this->db->table_exists('hostels')) {
            $this->db->select('COALESCE(SUM(total_capacity), 0) as total_capacity', false);
            if ($this->db->field_exists('deleted_at', 'hostels')) {
                $this->db->where('deleted_at IS NULL', null, false);
            }
            $row = $this->db->get('hostels')->row_array();
            $summary['capacity'] = isset($row['total_capacity']) ? (int) $row['total_capacity'] : 0;
        }

        if ($this->db->table_exists('hostel_bookings')) {
            if ($this->db->field_exists('deleted_at', 'hostel_bookings')) {
                $this->db->where('deleted_at IS NULL', null, false);
            }
            if ($session_id && $this->db->field_exists('session_id', 'hostel_bookings')) {
                $this->db->where('session_id', $session_id);
            }
            if ($this->db->field_exists('status', 'hostel_bookings')) {
                $this->db->where_in('status', array('approved', 'allocated', 'confirmed', 'checked_in', 'occupied', 'active'));
            }
            $summary['occupied'] = (int) $this->db->count_all_results('hostel_bookings');

            if ($this->db->field_exists('deleted_at', 'hostel_bookings')) {
                $this->db->where('deleted_at IS NULL', null, false);
            }
            if ($session_id && $this->db->field_exists('session_id', 'hostel_bookings')) {
                $this->db->where('session_id', $session_id);
            }
            if ($this->db->field_exists('status', 'hostel_bookings')) {
                $this->db->where_in('status', array('pending', 'awaiting_payment'));
            }
            $summary['pendingRequests'] = (int) $this->db->count_all_results('hostel_bookings');
        }

        if ($summary['capacity'] > 0) {
            $summary['occupancyRate'] = round(($summary['occupied'] / $summary['capacity']) * 100, 1);
        }

        return $summary;
    }

    private function build_application_review_data()
    {
        $this->db->from('applications');
        $this->db->select('applications.*, applicants.full_name, applicants.first_name, applicants.middle_name, applicants.last_name, applicants.email AS applicant_email, applicants.phone AS applicant_phone');
        $this->db->join('applicants', 'applicants.id = applications.applicant_id', 'left');
        $this->db->order_by('applications.applied_at', 'DESC');
        $query = $this->db->get();
        $rows = $query->result_array();

        $applications = array();
        $counts = array(
            'pending' => 0,
            'under_review' => 0,
            'approved' => 0,
            'rejected' => 0,
            'waitlisted' => 0,
        );

        foreach ($rows as $row) {
            $payload = $this->decode_payload(isset($row['payload']) ? $row['payload'] : null);

            $applicantName = $this->first_non_empty(array(
                isset($row['full_name']) ? $row['full_name'] : null,
                $this->combine_names($row),
                $this->combine_names($this->array_get($payload, 'personal', array())),
            ));

            $email = $this->first_non_empty(array(
                isset($row['applicant_email']) ? $row['applicant_email'] : null,
                $this->array_get($payload, 'contact.email'),
            ));

            $phone = $this->first_non_empty(array(
                isset($row['applicant_phone']) ? $row['applicant_phone'] : null,
                $this->array_get($payload, 'contact.phone'),
            ));

            $programme = $this->resolve_programme_label($row, $payload);

            $entryMode = $this->first_non_empty(array(
                isset($row['application_mode_of_entry']) ? $row['application_mode_of_entry'] : null,
                $this->array_get($payload, 'academic.applicationModeOfEntry'),
            ));

            $jambScore = $this->array_get($payload, 'jamb.jambScore');
            $oLevelGradeRows = $this->resolve_olevel_grade_rows($payload, $row);
            $oLevelGrades = $this->summarize_olevel_grades($payload, $row);
            $status = $this->normalize_application_status(isset($row['status']) ? $row['status'] : 'submitted');

            if (isset($counts[$status])) {
                $counts[$status] += 1;
            }

            $documentFiles = $this->collect_document_files($row, $payload);
            $applications[] = array(
                'id' => isset($row['id']) ? $row['id'] : null,
                'application_no' => isset($row['application_no']) ? $row['application_no'] : null,
                'applicant_name' => $applicantName ?: 'Unknown Applicant',
                'email' => $email,
                'phone' => $phone,
                'program' => $programme,
                'entry_mode' => $entryMode,
                'jamb_score' => $jambScore !== null ? (int) $jambScore : null,
                'o_level_grades' => $oLevelGrades,
                'o_level_grade_rows' => $oLevelGradeRows,
                'date_applied' => isset($row['applied_at']) ? $row['applied_at'] : null,
                'status' => $status,
                'raw_status' => isset($row['status']) ? $row['status'] : null,
                'notes' => isset($row['review_notes']) ? $row['review_notes'] : '',
                'documents' => $this->collect_documents($row, $payload),
                'document_files' => $documentFiles,
            );
        }

        return array(
            'applications' => $applications,
            'counts' => $counts,
        );
    }

    // Update application status (approve / reject / review)
    public function update_application_status()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        if (!$this->applications_tables_ready()) {
            return $this->json_response(404, array('status' => 'error', 'message' => 'Application tables not found'));
        }

        $payload = json_decode($this->input->raw_input_stream, true);
        if (!is_array($payload)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid JSON payload'));
        }

        $status = isset($payload['status']) ? strtolower(trim($payload['status'])) : null;
        $applicationId = isset($payload['id']) ? $payload['id'] : (isset($payload['application_id']) ? $payload['application_id'] : null);
        $applicationNo = isset($payload['application_no']) ? $payload['application_no'] : null;
        $notes = isset($payload['notes']) ? $payload['notes'] : null;

        $allowed = array('pending', 'under_review', 'approved', 'rejected', 'waitlisted');
        if (!$status || !in_array($status, $allowed, true)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid status value'));
        }

        if (!$applicationId && !$applicationNo) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Application identifier is required'));
        }

        $this->db->from('applications');
        if ($applicationId) {
            $this->db->where('id', $applicationId);
        }
        if ($applicationNo) {
            $this->db->or_where('application_no', $applicationNo);
        }
        $this->db->limit(1);
        $row = $this->db->get()->row_array();

        if (!$row) {
            return $this->json_response(404, array('status' => 'error', 'message' => 'Application not found'));
        }

        $result = $this->apply_application_status_update($row, $status, $notes, $payload);

        if (!isset($result['success']) || !$result['success']) {
            return $this->json_response(
                isset($result['code']) ? (int) $result['code'] : 422,
                array(
                    'status' => 'error',
                    'message' => isset($result['message']) ? $result['message'] : 'Unable to update application status',
                    'data' => isset($result['data']) ? $result['data'] : null,
                )
            );
        }

        return $this->json_response(200, array(
            'status' => 'success',
            'data' => isset($result['data']) ? $result['data'] : null,
            'message' => isset($result['message']) ? $result['message'] : 'Application status updated',
        ));
    }

    private function apply_application_status_update($applicationRow, $status, $notes, $payload)
    {
        $this->ensure_review_columns();

        $currentStatus = $this->normalize_application_status(
            isset($applicationRow['status']) ? $applicationRow['status'] : null
        );

        if ($status === 'approved' && $currentStatus === 'approved') {
            return array(
                'success' => false,
                'code' => 409,
                'message' => 'Applicant is already admitted.',
            );
        }

        $dbStatus = $this->map_status_to_db($status);

        $updateData = array(
            'status' => $dbStatus,
            'updated_at' => date('Y-m-d H:i:s'),
        );

        if ($status === 'approved') {
            $updateData = array_merge($updateData, $this->build_application_update_fields($payload));
        }

        if ($notes !== null) {
            $updateData['review_notes'] = $notes;
        }

        $admissionResult = null;
        if ($status === 'approved') {
            $this->db->trans_begin();
        }

        $this->db->where('id', $applicationRow['id']);
        $this->db->update('applications', $updateData);

        if ($status === 'approved') {
            $admissionResult = $this->admit_application($applicationRow, $payload);
            if (isset($admissionResult['error']) && $admissionResult['error'] === true) {
                $this->db->trans_rollback();
                return array(
                    'success' => false,
                    'code' => isset($admissionResult['code']) ? $admissionResult['code'] : 422,
                    'message' => isset($admissionResult['message']) ? $admissionResult['message'] : 'Unable to create admission record',
                    'data' => isset($admissionResult['data']) ? $admissionResult['data'] : null,
                );
            }

            if ($this->db->trans_status() === false) {
                $this->db->trans_rollback();
                return array(
                    'success' => false,
                    'code' => 500,
                    'message' => 'Admission transaction failed',
                );
            }

            $this->db->trans_commit();
        }

        return array(
            'success' => true,
            'message' => 'Application status updated',
            'data' => array(
                'id' => isset($applicationRow['id']) ? $applicationRow['id'] : null,
                'application_no' => isset($applicationRow['application_no']) ? $applicationRow['application_no'] : null,
                'status' => $status,
                'raw_status' => $dbStatus,
                'notes' => $notes,
                'admission' => $admissionResult,
            ),
        );
    }

    private function admit_application($applicationRow, $payload)
    {
        if (!$this->db->table_exists('admissions') || !$this->db->table_exists('students')) {
            return array('error' => true, 'message' => 'Admission tables not found');
        }

        $this->ensure_admissions_columns();

        $applicationId = isset($applicationRow['id']) ? $applicationRow['id'] : null;
        if (!$applicationId) {
            return array('error' => true, 'message' => 'Missing application id');
        }

        // Fetch applicant to resolve email/user linkage
        $applicant = null;
        if ($this->db->table_exists('applicants') && isset($applicationRow['applicant_id'])) {
            $applicant = $this->db
                ->get_where('applicants', array('id' => $applicationRow['applicant_id']), 1)
                ->row_array();
        }

        $user = null;
        if ($applicant && isset($applicant['email'])) {
            $user = $this->db
                ->get_where('users', array('email' => $applicant['email']), 1)
                ->row_array();
        }

        if (!$user || !isset($user['id'])) {
            return array('error' => true, 'message' => 'User account not found for applicant email');
        }

        // Resolve programme/department
        $programmeId = isset($payload['programme_id']) ? $payload['programme_id'] : (isset($applicationRow['programme_id']) ? $applicationRow['programme_id'] : null);
        $this->Courses_model->ensure_programme_structure_column();
        $programme = $programmeId ? $this->db->get_where('programmes', array('id' => $programmeId), 1)->row_array() : null;
        $departmentId = isset($payload['department_id']) ? $payload['department_id'] : (isset($programme['department_id']) ? $programme['department_id'] : null);

        if (!$programmeId || !$departmentId) {
            return array('error' => true, 'message' => 'Programme or department missing for admission');
        }

        // An admission must retain a verified canonical session reference.
        // Do not create a session from an administrative form value.
        $sessionId = null;
        foreach (array(
            isset($payload['session_id']) ? $payload['session_id'] : null,
            isset($payload['session']) ? $payload['session'] : null,
            isset($applicationRow['session_id']) ? $applicationRow['session_id'] : null,
        ) as $sessionReference) {
            $sessionId = $this->resolve_existing_session_id($sessionReference);
            if ($sessionId) {
                break;
            }
        }
        if (!$sessionId) {
            return array('error' => true, 'code' => 422, 'message' => 'The application must be assigned to an existing academic session before it can be admitted.');
        }

        // Determine entry level / deadlines
        $rawEntryLevel = isset($payload['entry_level']) ? $payload['entry_level'] : '100';
        $acceptanceDeadline = isset($payload['registration_close']) ? $payload['registration_close'] : null;
        $lectureStart = isset($payload['lecture_start']) ? $payload['lecture_start'] : null;
        $rawModeOfEntry = isset($payload['mode_of_entry']) ? $payload['mode_of_entry'] : null;
        $programType = isset($programme['programme_structure']) && $programme['programme_structure']
            ? $programme['programme_structure']
            : (isset($payload['program_type']) ? $payload['program_type'] : null);
        if ($programType === 'contact_based') {
            $programType = 'contact';
        }
        if ($programType !== 'contact' && $programType !== 'semester') {
            $programType = 'semester';
        }
        $admissionCondition = isset($payload['admission_condition']) ? $payload['admission_condition'] : null;

        $modeOfEntry = $this->Student_model->normalize_entry_mode_label($rawModeOfEntry, $rawEntryLevel, $rawModeOfEntry);
        $entryLevel = $this->Student_model->format_entry_level_for_programme($modeOfEntry, $programType);
        $resolvedSessionName = $this->Student_model->resolve_session_name_from_ref($sessionId);
        $calculatedCurrentLevel = $this->Student_model->calculate_student_level(
            $resolvedSessionName !== '' ? $resolvedSessionName : $sessionId,
            $modeOfEntry,
            $entryLevel,
            $programType,
            null,
            isset($programme['duration_years']) ? (int) $programme['duration_years'] : null,
            $modeOfEntry
        );

        // Upsert admission
        $existingAdmission = $this->db
            ->get_where('admissions', array('application_id' => $applicationId), 1)
            ->row_array();

        $admissionId = $existingAdmission && isset($existingAdmission['id'])
            ? $existingAdmission['id']
            : $this->generate_uuid();

        if (!$existingAdmission) {
            $admissionNumber = $this->generate_admission_number(isset($programme['code']) ? $programme['code'] : null);
            $admissionInsert = array(
                'id' => $admissionId,
                'application_id' => $applicationId,
                'admission_number' => $admissionNumber,
                'matric_number' => isset($payload['matric_number']) ? $payload['matric_number'] : null,
                'level' => $entryLevel,
                'admission_date' => date('Y-m-d'),
                'acceptance_deadline' => $acceptanceDeadline,
                'status' => 'admitted',
                'created_at' => date('Y-m-d H:i:s'),
            );
            if ($sessionId) {
                $admissionInsert['session_id'] = $sessionId;
            }
            if ($modeOfEntry) {
                $admissionInsert['mode_of_entry'] = $modeOfEntry;
            }
            if ($programType) {
                $admissionInsert['program_type'] = $programType;
            }
            if ($admissionCondition) {
                $admissionInsert['admission_condition'] = $admissionCondition;
            }
            if ($lectureStart) {
                $admissionInsert['lecture_start_date'] = $lectureStart;
            }
            $this->db->insert('admissions', $admissionInsert);
        } else {
            $admissionUpdate = array(
                'level' => $entryLevel,
                'acceptance_deadline' => $acceptanceDeadline,
                'status' => 'admitted',
                'updated_at' => date('Y-m-d H:i:s'),
            );
            if ($sessionId) {
                $admissionUpdate['session_id'] = $sessionId;
            }
            if ($modeOfEntry) {
                $admissionUpdate['mode_of_entry'] = $modeOfEntry;
            }
            if ($programType) {
                $admissionUpdate['program_type'] = $programType;
            }
            if ($admissionCondition) {
                $admissionUpdate['admission_condition'] = $admissionCondition;
            }
            if ($lectureStart) {
                $admissionUpdate['lecture_start_date'] = $lectureStart;
            }

            $this->db->where('id', $admissionId);
            $this->db->update('admissions', $admissionUpdate);
        }

        // Upsert student
        $existingStudent = $this->db
            ->get_where('students', array('admission_id' => $admissionId), 1)
            ->row_array();

        $studentId = $existingStudent && isset($existingStudent['id'])
            ? $existingStudent['id']
            : $this->generate_uuid();

        $studentData = array(
            'user_id' => $user['id'],
            'admission_id' => $admissionId,
            'programme_id' => $programmeId,
            'department_id' => $departmentId,
            'current_level' => $calculatedCurrentLevel,
            'status' => 'active',
        );
        if ($this->db->field_exists('session_id', 'students') && $sessionId) {
            $studentData['session_id'] = $sessionId;
        }
        if ($this->db->field_exists('entry_session_id', 'students') && $sessionId) {
            $studentData['entry_session_id'] = $sessionId;
        }
        if ($this->db->field_exists('session_name', 'students') && $resolvedSessionName !== '') {
            $studentData['session_name'] = $resolvedSessionName;
        }
        if ($this->db->field_exists('entry_mode', 'students') && $modeOfEntry) {
            $studentData['entry_mode'] = $modeOfEntry;
        }

        if (!$existingStudent) {
            $studentData['id'] = $studentId;
            $studentData['created_at'] = date('Y-m-d H:i:s');
            $this->db->insert('students', $studentData);
        } else {
            $studentData['updated_at'] = date('Y-m-d H:i:s');
            $this->db->where('id', $studentId);
            $this->db->update('students', $studentData);
        }

        return array(
            'admission_id' => $admissionId,
            'student_id' => $studentId,
        );
    }

    private function resolve_existing_session_id($reference)
    {
        $reference = trim((string) $reference);
        if ($reference === '') {
            return null;
        }

        if (!$this->db->table_exists('academic_sessions')) {
            return null;
        }

        $existing = $this->db->get_where('academic_sessions', array('id' => $reference), 1)->row_array();
        if ($existing && isset($existing['id'])) {
            return $existing['id'];
        }

        $existing = $this->db->get_where('academic_sessions', array('name' => $reference), 1)->row_array();
        return $existing && isset($existing['id']) ? $existing['id'] : null;
    }

    private function is_valid_session_date($value)
    {
        $date = DateTime::createFromFormat('Y-m-d', (string) $value);
        return $date && $date->format('Y-m-d') === $value;
    }

    private function build_application_update_fields($payload)
    {
        $updates = array();

        if (!is_array($payload)) {
            return $updates;
        }

        if (isset($payload['programme_id']) && $payload['programme_id'] && $this->db->field_exists('programme_id', 'applications')) {
            $updates['programme_id'] = $payload['programme_id'];
        }

        if ((isset($payload['session_id']) || isset($payload['session'])) && $this->db->field_exists('session_id', 'applications')) {
            $sessionId = $this->resolve_existing_session_id(
                isset($payload['session_id']) ? $payload['session_id'] : $payload['session']
            );
            if ($sessionId) {
                $updates['session_id'] = $sessionId;
            }
        }

        $modeOfEntry = isset($payload['mode_of_entry']) ? $payload['mode_of_entry'] : null;
        if ($modeOfEntry) {
            if ($this->db->field_exists('entry_mode', 'applications')) {
                $updates['entry_mode'] = $modeOfEntry;
            }
            if ($this->db->field_exists('application_mode_of_entry', 'applications')) {
                $updates['application_mode_of_entry'] = $modeOfEntry;
            }
        }

        return $updates;
    }

    private function ensure_admissions_columns()
    {
        if (!$this->db->table_exists('admissions')) {
            return;
        }

        if (!$this->db->field_exists('session_id', 'admissions')) {
            $this->db->query("ALTER TABLE `admissions` ADD COLUMN `session_id` CHAR(36) NULL AFTER `application_id`");
        }

        if (!$this->db->field_exists('mode_of_entry', 'admissions')) {
            $this->db->query("ALTER TABLE `admissions` ADD COLUMN `mode_of_entry` VARCHAR(50) NULL AFTER `matric_number`");
        }

        if (!$this->db->field_exists('program_type', 'admissions')) {
            $this->db->query("ALTER TABLE `admissions` ADD COLUMN `program_type` VARCHAR(50) NULL AFTER `mode_of_entry`");
        }

        if (!$this->db->field_exists('admission_condition', 'admissions')) {
            $this->db->query("ALTER TABLE `admissions` ADD COLUMN `admission_condition` VARCHAR(50) NULL AFTER `program_type`");
        }

        if (!$this->db->field_exists('lecture_start_date', 'admissions')) {
            $this->db->query("ALTER TABLE `admissions` ADD COLUMN `lecture_start_date` DATE NULL AFTER `admission_date`");
        }
    }

    private function generate_admission_number($programmeCode = null)
    {
        $prefix = $programmeCode ? strtoupper($programmeCode) : 'ADM';
        return $prefix . '-' . date('Ymd') . '-' . substr(str_replace('-', '', $this->generate_uuid()), 0, 6);
    }

    private function applications_tables_ready()
    {
        return $this->db->table_exists('applications') && $this->db->table_exists('applicants');
    }

    private function decode_payload($payload)
    {
        if (!$payload) {
            return array();
        }

        $decoded = json_decode($payload, true);
        return is_array($decoded) ? $decoded : array();
    }

    private function json_payload()
    {
        $decoded = json_decode($this->input->raw_input_stream, true);
        if (is_array($decoded)) {
            return $decoded;
        }

        $post = $this->input->post();
        return is_array($post) ? $post : array();
    }

    private function combine_names($source)
    {
        if (!is_array($source)) {
            return null;
        }

        $parts = array();
        foreach (array('first_name', 'middle_name', 'last_name', 'firstName', 'middleName', 'lastName') as $key) {
            if (isset($source[$key]) && $source[$key]) {
                $parts[] = trim($source[$key]);
            }
        }

        return empty($parts) ? null : trim(implode(' ', $parts));
    }

    private function first_non_empty($values)
    {
        if (!is_array($values)) {
            return null;
        }

        foreach ($values as $value) {
            if ($value !== null && $value !== '') {
                return $value;
            }
        }

        return null;
    }

    private function array_get($array, $path, $default = null)
    {
        if (!is_array($array)) {
            return $default;
        }

        $segments = is_array($path) ? $path : explode('.', $path);
        $current = $array;
        foreach ($segments as $segment) {
            if (!is_array($current) || !array_key_exists($segment, $current)) {
                return $default;
            }
            $current = $current[$segment];
        }

        return $current;
    }

    private function summarize_olevel_grades($payload, $applicationRow = null)
    {
        $gradeRows = $this->resolve_olevel_grade_rows($payload, $applicationRow);
        if (empty($gradeRows)) {
            return null;
        }

        $results = array();
        foreach ($gradeRows as $row) {
            if (isset($row['subject'], $row['grade'])) {
                $results[] = trim($row['subject'] . ' ' . $row['grade']);
            }
        }

        return empty($results) ? null : implode(', ', $results);
    }

    private function resolve_olevel_grade_rows($payload, $applicationRow = null)
    {
        $rows = array();

        $first = $this->array_get($payload, 'oLevel.firstSitting');
        if (is_array($first)) {
            foreach ($first as $entry) {
                if (is_array($entry) && !empty($entry['subject']) && !empty($entry['grade'])) {
                    $rows[] = array(
                        'subject' => trim($entry['subject']),
                        'grade' => trim($entry['grade']),
                        'sitting' => 'First Sitting',
                    );
                }
            }
        }

        $second = $this->array_get($payload, 'oLevel.secondSitting');
        if (is_array($second)) {
            foreach ($second as $entry) {
                if (is_array($entry) && !empty($entry['subject']) && !empty($entry['grade'])) {
                    $rows[] = array(
                        'subject' => trim($entry['subject']),
                        'grade' => trim($entry['grade']),
                        'sitting' => 'Second Sitting',
                    );
                }
            }
        }

        if (!empty($rows)) {
            return $rows;
        }

        if ($this->db->table_exists('application_olevel_results') && isset($applicationRow['id'])) {
            $query = $this->db->get_where('application_olevel_results', array('application_id' => $applicationRow['id']));
            $resultRows = $query->result_array();
            foreach ($resultRows as $resultRow) {
                $subjects = $this->parse_olevel_subjects(isset($resultRow['subjects']) ? $resultRow['subjects'] : null);
                foreach ($subjects as $subjectRow) {
                    if (!empty($subjectRow['subject']) && !empty($subjectRow['grade'])) {
                        $rows[] = array(
                            'subject' => trim($subjectRow['subject']),
                            'grade' => trim($subjectRow['grade']),
                            'sitting' => isset($resultRow['exam_type']) ? trim($resultRow['exam_type']) : null,
                        );
                    }
                }
            }
        }

        return $rows;
    }

    private function parse_olevel_subjects($raw)
    {
        if (!$raw) {
            return array();
        }

        if (is_array($raw)) {
            return $raw;
        }

        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            return $decoded;
        }

        $rows = array();
        $lines = preg_split('/\r\n|\r|\n/', trim($raw));
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }

            $parts = preg_split('/\s*[:=-]\s*/', $line, 2);
            if (count($parts) === 2) {
                $rows[] = array('subject' => trim($parts[0]), 'grade' => trim($parts[1]));
                continue;
            }

            if (preg_match('/^(.+?)\s+([A-E][1-9]?|[A-E])$/i', $line, $matches)) {
                $rows[] = array('subject' => trim($matches[1]), 'grade' => trim($matches[2]));
            }
        }

        return $rows;
    }

    private function collect_documents($applicationRow, $payload)
    {
        $documents = array();

        if ($this->db->table_exists('application_documents') && isset($applicationRow['id'])) {
            $docQuery = $this->db->get_where('application_documents', array('application_id' => $applicationRow['id']));
            $rows = $docQuery->result_array();
            foreach ($rows as $row) {
                if (isset($row['doc_type']) && $row['doc_type']) {
                    $documents[] = $row['doc_type'];
                } elseif (isset($row['file_name']) && $row['file_name']) {
                    $documents[] = $row['file_name'];
                }
            }
        }

        if (empty($documents)) {
            $fromPayload = $this->array_get($payload, 'documents');
            if (is_array($fromPayload)) {
                foreach ($fromPayload as $key => $value) {
                    if ($value) {
                        $documents[] = is_string($key) ? $key : (is_string($value) ? $value : 'Document');
                    }
                }
            }
        }

        return $documents;
    }

    private function collect_document_files($applicationRow, $payload)
    {
        $documents = array();

        if ($this->db->table_exists('application_documents') && isset($applicationRow['id'])) {
            $docQuery = $this->db->get_where('application_documents', array('application_id' => $applicationRow['id']));
            $rows = $docQuery->result_array();
            foreach ($rows as $row) {
                $documents[] = array(
                    'type' => isset($row['doc_type']) ? $row['doc_type'] : null,
                    'file_name' => isset($row['file_name']) ? $row['file_name'] : null,
                    'storage_path' => isset($row['storage_path']) ? $row['storage_path'] : null,
                );
            }
        }

        if (empty($documents)) {
            $fromPayload = $this->array_get($payload, 'documents');
            if (is_array($fromPayload)) {
                foreach ($fromPayload as $key => $value) {
                    if (!$value) {
                        continue;
                    }
                    $documents[] = array(
                        'type' => is_string($key) ? $key : null,
                        'file_name' => is_string($value) ? $value : null,
                        'storage_path' => null,
                    );
                }
            }
        }

        return $documents;
    }

    private function resolve_programme_label($row, $payload)
    {
        $programmeCode = $this->first_non_empty(array(
            isset($row['first_choice_program_code']) ? $row['first_choice_program_code'] : null,
            $this->array_get($payload, 'academic.firstChoiceProgram'),
        ));

        $programme = null;
        if (isset($row['programme_id']) && $row['programme_id'] && $this->db->table_exists('programmes')) {
            $programme = $this->db->get_where('programmes', array('id' => $row['programme_id']), 1)->row_array();
        }

        if (!$programme && $programmeCode && $this->db->table_exists('programmes')) {
            $programme = $this->db->get_where('programmes', array('code' => $programmeCode), 1)->row_array();
        }

        if (is_array($programme) && !empty($programme['name'])) {
            return $programme['name'];
        }

        return $programmeCode ?: 'N/A';
    }

    private function parse_csv_rows($csvContent)
    {
        $content = trim((string) $csvContent);
        if ($content === '') {
            return array('message' => 'CSV content is empty');
        }

        // Normalize Windows-1252 smart quotes, Unicode replacement characters, and curly quotes to ASCII apostrophe
        $content = str_replace(array("\x91", "\x92", "\xE2\x80\x98", "\xE2\x80\x99", "\xEF\xBF\xBD", "\u{FFFD}", '’', '‘', '`', '´'), "'", $content);

        $lines = preg_split('/\r\n|\r|\n/', $content);
        if (!is_array($lines) || count($lines) < 2) {
            return array('message' => 'CSV must include a header and at least one data row');
        }

        $headerLine = array_shift($lines);
        $headers = str_getcsv($headerLine);
        if (!is_array($headers) || empty($headers)) {
            return array('message' => 'Invalid CSV headers');
        }

        $normalizedHeaders = array();
        foreach ($headers as $index => $header) {
            $name = trim((string) $header);
            if ($index === 0) {
                $name = preg_replace('/^\xEF\xBB\xBF/', '', $name);
            }
            $name = strtolower($name);
            $normalizedHeaders[] = $name !== '' ? $name : 'column_' . ($index + 1);
        }

        $rows = array();
        foreach ($lines as $line) {
            if (trim((string) $line) === '') {
                continue;
            }

            $values = str_getcsv($line);
            if (!is_array($values)) {
                continue;
            }

            $row = array();
            foreach ($normalizedHeaders as $i => $key) {
                $row[$key] = isset($values[$i]) ? trim((string) $values[$i]) : '';
            }

            $rows[] = $row;
        }

        return array('rows' => $rows);
    }

    private function normalize_csv_status($value)
    {
        $status = strtolower(trim((string) $value));
        if ($status === '') {
            return 'skip';
        }

        if (in_array($status, array('approved', 'admitted', 'admit', 'yes', '1', 'true'), true)) {
            return 'approved';
        }

        if (in_array($status, array('rejected', 'reject'), true)) {
            return 'rejected';
        }

        return 'skip';
    }

    private function normalize_application_status($status)
    {
        $value = strtolower((string) $status);
        switch ($value) {
            case 'approved':
            case 'admitted':
                return 'approved';
            case 'rejected':
                return 'rejected';
            case 'review':
            case 'under_review':
            case 'processing':
                return 'under_review';
            case 'waitlist':
            case 'waitlisted':
                return 'waitlisted';
            case 'submitted':
            case 'draft':
            default:
                return 'pending';
        }
    }

    private function map_status_to_db($status)
    {
        $value = strtolower((string) $status);
        switch ($value) {
            case 'approved':
                return 'admitted';
            case 'rejected':
                return 'rejected';
            case 'under_review':
                return 'under_review';
            case 'waitlisted':
                return 'waitlisted';
            case 'pending':
            default:
                return 'submitted';
        }
    }

    private function ensure_review_columns()
    {
        if (!$this->db->table_exists('applications')) {
            return;
        }

        if (!$this->db->field_exists('review_notes', 'applications')) {
            $this->db->query("ALTER TABLE `applications` ADD COLUMN `review_notes` TEXT NULL AFTER `payload`");
        }

        if (!$this->db->field_exists('updated_at', 'applications')) {
            $this->db->query("ALTER TABLE `applications` ADD COLUMN `updated_at` DATETIME NULL AFTER `applied_at`");
        }
    }

    private function generate_uuid()
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }

    public function fix_encoding()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        $tables_fixed = array();
        $total_fixed = 0;

        if ($this->db->table_exists('users')) {
            $users = $this->db->query("SELECT id, full_name FROM users WHERE full_name LIKE '%\xEF\xBF\xBD%' OR full_name LIKE '%’%' OR full_name LIKE '%‘%'")->result_array();
            $count = 0;
            foreach ($users as $u) {
                $cleaned = str_replace(array("\xEF\xBF\xBD", "\u{FFFD}", "\xE2\x80\x99", "\xE2\x80\x98", '’', '‘', '`', '´'), "'", $u['full_name']);
                if ($cleaned !== $u['full_name']) {
                    $this->db->where('id', $u['id'])->update('users', array('full_name' => $cleaned));
                    $count++;
                }
            }
            $tables_fixed['users'] = $count;
            $total_fixed += $count;
        }

        if ($this->db->table_exists('applicants')) {
            $applicants = $this->db->query("SELECT id, first_name, other_names, last_name FROM applicants WHERE first_name LIKE '%\xEF\xBF\xBD%' OR other_names LIKE '%\xEF\xBF\xBD%' OR last_name LIKE '%\xEF\xBF\xBD%' OR first_name LIKE '%’%' OR last_name LIKE '%’%'")->result_array();
            $count = 0;
            foreach ($applicants as $a) {
                $upd = array();
                foreach (array('first_name', 'other_names', 'last_name') as $col) {
                    if (!empty($a[$col])) {
                        $cleaned = str_replace(array("\xEF\xBF\xBD", "\u{FFFD}", "\xE2\x80\x99", "\xE2\x80\x98", '’', '‘', '`', '´'), "'", $a[$col]);
                        if ($cleaned !== $a[$col]) {
                            $upd[$col] = $cleaned;
                        }
                    }
                }
                if (!empty($upd)) {
                    $this->db->where('id', $a['id'])->update('applicants', $upd);
                    $count++;
                }
            }
            $tables_fixed['applicants'] = $count;
            $total_fixed += $count;
        }

        if ($this->db->table_exists('students')) {
            $students = $this->db->query("SELECT id, first_name, last_name, middle_name FROM students WHERE first_name LIKE '%\xEF\xBF\xBD%' OR last_name LIKE '%\xEF\xBF\xBD%' OR middle_name LIKE '%\xEF\xBF\xBD%' OR first_name LIKE '%’%' OR last_name LIKE '%’%' OR middle_name LIKE '%’%'")->result_array();
            $count = 0;
            foreach ($students as $s) {
                $upd = array();
                foreach (array('first_name', 'last_name', 'middle_name') as $col) {
                    if (!empty($s[$col])) {
                        $cleaned = str_replace(array("\xEF\xBF\xBD", "\u{FFFD}", "\xE2\x80\x99", "\xE2\x80\x98", '’', '‘', '`', '´'), "'", $s[$col]);
                        if ($cleaned !== $s[$col]) {
                            $upd[$col] = $cleaned;
                        }
                    }
                }
                if (!empty($upd)) {
                    $this->db->where('id', $s['id'])->update('students', $upd);
                    $count++;
                }
            }
            $tables_fixed['students'] = $count;
            $total_fixed += $count;
        }

        return $this->json_response(200, array(
            'status' => 'success',
            'message' => "Repaired {$total_fixed} corrupted names/records in database.",
            'fixed_count' => $total_fixed,
            'tables' => $tables_fixed
        ));
    }

    private function json_response($status, $payload)
    {
        $this->output
            ->set_status_header($status)
            ->set_content_type('application/json')
            ->set_output(json_encode($payload));
    }
}



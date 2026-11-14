<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Auth extends CI_Controller {
    public function __construct()
    {
        parent::__construct();
        $this->load->database();
        $this->load->model('User_model');
        $this->load->library('session');
        $this->load->model('RBAC_model');
    }

    public function register()
    {
        $payload = $this->get_json_body();
        $full_name = isset($payload['full_name']) ? trim($payload['full_name']) : '';
        $email = isset($payload['email']) ? strtolower(trim($payload['email'])) : '';
        $phone = isset($payload['phone']) ? trim($payload['phone']) : null;
        $nin = isset($payload['nin']) ? trim($payload['nin']) : null;
        $password = isset($payload['password']) ? $payload['password'] : '';

        if ($full_name === '' || $email === '' || $password === '') {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => 'full_name, email, and password are required.'
            ));
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => 'Invalid email address.'
            ));
        }

        if (strlen($password) < 6) {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => 'Password must be at least 6 characters.'
            ));
        }

        if ($this->User_model->find_by_email($email)) {
            return $this->json_response(409, array(
                'status' => 'error',
                'message' => 'Email already exists.'
            ));
        }

        $user_id = $this->generate_uuid();
        $now = date('Y-m-d H:i:s');

        $inserted = $this->User_model->create(array(
            'id' => $user_id,
            'email' => $email,
            'full_name' => $full_name,
            'phone' => $phone,
            'nin' => $nin,
            'password_hash' => password_hash($password, PASSWORD_BCRYPT),
            'status' => 'active',
            'created_at' => $now,
            'created_by' => null,
            'updated_at' => null,
            'updated_by' => null,
            'deleted_at' => null,
            'deleted_by' => null
        ));

        if (!$inserted) {
            return $this->json_response(500, array(
                'status' => 'error',
                'message' => 'Failed to create account.'
            ));
        }

        return $this->json_response(201, array(
            'status' => 'success',
            'message' => 'Account created successfully.',
            'data' => array(
                'id' => $user_id,
                'email' => $email,
                'full_name' => $full_name,
                'phone' => $phone,
                'nin' => $nin
            )
        ));
    }

    public function login()
    {
        $this->ensure_password_policy_schema();

        $payload = $this->get_json_body();
        $email = isset($payload['email']) ? strtolower(trim($payload['email'])) : '';
        $password = isset($payload['password']) ? $payload['password'] : '';

        if ($email === '' || $password === '') {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => 'email and password are required.'
            ));
        }

        $user = $this->User_model->find_by_email($email);
        if (!$user || !empty($user['deleted_at'])) {
            return $this->json_response(401, array(
                'status' => 'error',
                'message' => 'Invalid credentials.'
            ));
        }

        if ($user['status'] !== 'active') {
            return $this->json_response(403, array(
                'status' => 'error',
                'message' => 'Account is not active.'
            ));
        }

        if (!password_verify($password, $user['password_hash'])) {
            return $this->json_response(401, array(
                'status' => 'error',
                'message' => 'Invalid credentials.'
            ));
        }

        $this->session->set_userdata(array(
            'user_id' => $user['id'],
            'email' => $user['email'],
            'full_name' => $user['full_name'],
            'logged_in' => true,
            'must_change_password' => $this->must_change_password($user),
            'login_at' => date('Y-m-d H:i:s')
        ));

        // include roles and permissions for frontend admin session normalization
        $roles = $this->RBAC_model->get_user_roles($user['id']);
        $permissions = $this->RBAC_model->get_user_permissions($user['id']);

        $user_payload = array(
            'id' => $user['id'],
            'email' => $user['email'],
            'full_name' => $user['full_name'],
            'phone' => $user['phone'],
            'must_change_password' => $this->must_change_password($user),
            'roles' => $roles,
            'permissions' => $permissions,
        );

        return $this->json_response(200, array(
            'status' => 'success',
            'message' => 'Login successful.',
            'data' => array(
                'token' => $this->create_access_token($user),
                'user' => $user_payload
            )
        ));
    }

    private function create_access_token($user)
    {
        $payload = array(
            'sub' => isset($user['id']) ? $user['id'] : '',
            'email' => isset($user['email']) ? $user['email'] : '',
            'exp' => time() + (60 * 60 * 8),
        );
        $encodedPayload = $this->base64url_encode(json_encode($payload));
        $signature = hash_hmac('sha256', $encodedPayload, $this->token_secret());

        return $encodedPayload . '.' . $signature;
    }

    private function base64url_encode($value)
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private function token_secret()
    {
        $key = $this->config->item('encryption_key');
        return $key ? $key : 'aacas-local-admin-token-secret';
    }

    private function get_json_body()
    {
        $raw = $this->input->raw_input_stream;
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            return $decoded;
        }

        return $this->input->post() ? $this->input->post() : array();
    }

    public function change_password()
    {
        $this->ensure_password_policy_schema();

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array(
                'status' => 'error',
                'message' => 'Method not allowed.'
            ));
        }

        $user = $this->get_user_from_session_or_token();
        if (!$user) {
            return $this->json_response(401, array(
                'status' => 'error',
                'message' => 'Authentication required.'
            ));
        }

        $payload = $this->get_json_body();
        $currentPassword = isset($payload['current_password'])
            ? (string) $payload['current_password']
            : (isset($payload['currentPassword']) ? (string) $payload['currentPassword'] : '');
        $newPassword = isset($payload['new_password'])
            ? (string) $payload['new_password']
            : (isset($payload['newPassword']) ? (string) $payload['newPassword'] : '');
        $confirmPassword = isset($payload['confirm_password'])
            ? (string) $payload['confirm_password']
            : (isset($payload['confirmPassword']) ? (string) $payload['confirmPassword'] : '');

        if ($currentPassword === '' || $newPassword === '' || $confirmPassword === '') {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => 'Current password, new password, and confirmation are required.'
            ));
        }

        if (!password_verify($currentPassword, $user['password_hash'])) {
            return $this->json_response(401, array(
                'status' => 'error',
                'message' => 'Current password is incorrect.'
            ));
        }

        if ($newPassword !== $confirmPassword) {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => 'New password and confirmation do not match.'
            ));
        }

        if (strlen($newPassword) < 8) {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => 'New password must be at least 8 characters.'
            ));
        }

        if ($newPassword === '000000') {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => 'Choose a password different from the temporary password.'
            ));
        }

        if (password_verify($newPassword, $user['password_hash'])) {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => 'New password must be different from the current password.'
            ));
        }

        $updates = array(
            'password_hash' => password_hash($newPassword, PASSWORD_BCRYPT),
            'must_change_password' => 0,
        );
        if ($this->db->field_exists('password', 'users')) {
            $updates['password'] = $updates['password_hash'];
        }
        if ($this->db->field_exists('updated_at', 'users')) {
            $updates['updated_at'] = date('Y-m-d H:i:s');
        }

        $this->db->where('id', $user['id']);
        $this->db->update('users', $updates);

        $this->session->set_userdata('must_change_password', 0);

        $freshUser = $this->User_model->find_by_id($user['id']);
        $roles = $this->RBAC_model->get_user_roles($user['id']);
        $permissions = $this->RBAC_model->get_user_permissions($user['id']);

        // Check if student and maintenance mode is active
        $is_student = false;
        foreach ($roles as $role) {
            if (strtolower($role['name']) === 'student') {
                $is_student = true;
                break;
            }
        }
        
        if ($is_student) {
            $this->load->database();
            if ($this->db->table_exists('system_settings')) {
                $query = $this->db->get_where('system_settings', array('setting_key' => 'student_portal_enabled'));
                $enabled = '1';
                if ($query->num_rows() > 0) {
                    $enabled = $query->row()->setting_value;
                }
                
                if ($enabled === '0') {
                    $title = 'System Maintenance';
                    $message = 'The student portal is temporarily unavailable.';
                    $expected_end = '';
                    $q = $this->db->get_where('system_settings', array('setting_key' => 'maintenance_title'));
                    if ($q->num_rows() > 0) $title = $q->row()->setting_value;
                    $q = $this->db->get_where('system_settings', array('setting_key' => 'maintenance_message'));
                    if ($q->num_rows() > 0) $message = $q->row()->setting_value;
                    $q = $this->db->get_where('system_settings', array('setting_key' => 'maintenance_expected_end'));
                    if ($q->num_rows() > 0) $expected_end = $q->row()->setting_value;

                    return $this->json_response(503, array(
                        'status' => 'error',
                        'code' => 'STUDENT_PORTAL_MAINTENANCE',
                        'message' => 'The student portal is in maintenance mode.',
                        'data' => array(
                            'title' => $title,
                            'message' => $message,
                            'expected_end' => $expected_end
                        )
                    ));
                }
            }
        }
        $token = $this->create_access_token($freshUser ? $freshUser : $user);

        return $this->json_response(200, array(
            'status' => 'success',
            'message' => 'Password changed successfully.',
            'data' => array(
                'token' => $token,
                'user' => array(
                    'id' => $user['id'],
                    'email' => $user['email'],
                    'full_name' => $user['full_name'],
                    'phone' => isset($user['phone']) ? $user['phone'] : null,
                    'must_change_password' => false,
                    'roles' => $roles,
                    'permissions' => $permissions,
                ),
            ),
        ));
    }

    public function update_admin_account()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'PUT' && $_SERVER['REQUEST_METHOD'] !== 'PATCH') {
            return $this->json_response(405, array(
                'status' => 'error',
                'message' => 'Method not allowed.'
            ));
        }

        $user = $this->get_user_from_session_or_token();
        if (!$user) {
            return $this->json_response(401, array(
                'status' => 'error',
                'message' => 'Authentication required.'
            ));
        }

        $payload = $this->get_json_body();
        $fullName = isset($payload['full_name']) ? trim((string) $payload['full_name']) : '';
        $phone = isset($payload['phone']) ? trim((string) $payload['phone']) : null;

        if ($fullName === '') {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => 'Full name is required.'
            ));
        }

        $updates = array(
            'full_name' => $fullName,
            'phone' => $phone === '' ? null : $phone,
        );
        if ($this->db->field_exists('updated_at', 'users')) {
            $updates['updated_at'] = date('Y-m-d H:i:s');
        }

        foreach (array_keys($updates) as $key) {
            if (!$this->db->field_exists($key, 'users')) {
                unset($updates[$key]);
            }
        }

        if (!empty($updates)) {
            $this->db->where('id', $user['id']);
            $this->db->update('users', $updates);
        }

        $freshUser = $this->User_model->find_by_id($user['id']);
        $roles = $this->RBAC_model->get_user_roles($user['id']);
        $permissions = $this->RBAC_model->get_user_permissions($user['id']);

        // Check if student and maintenance mode is active
        $is_student = false;
        foreach ($roles as $role) {
            if (strtolower($role['name']) === 'student') {
                $is_student = true;
                break;
            }
        }
        
        if ($is_student) {
            $this->load->database();
            if ($this->db->table_exists('system_settings')) {
                $query = $this->db->get_where('system_settings', array('setting_key' => 'student_portal_enabled'));
                $enabled = '1';
                if ($query->num_rows() > 0) {
                    $enabled = $query->row()->setting_value;
                }
                
                if ($enabled === '0') {
                    $title = 'System Maintenance';
                    $message = 'The student portal is temporarily unavailable.';
                    $expected_end = '';
                    $q = $this->db->get_where('system_settings', array('setting_key' => 'maintenance_title'));
                    if ($q->num_rows() > 0) $title = $q->row()->setting_value;
                    $q = $this->db->get_where('system_settings', array('setting_key' => 'maintenance_message'));
                    if ($q->num_rows() > 0) $message = $q->row()->setting_value;
                    $q = $this->db->get_where('system_settings', array('setting_key' => 'maintenance_expected_end'));
                    if ($q->num_rows() > 0) $expected_end = $q->row()->setting_value;

                    return $this->json_response(503, array(
                        'status' => 'error',
                        'code' => 'STUDENT_PORTAL_MAINTENANCE',
                        'message' => 'The student portal is in maintenance mode.',
                        'data' => array(
                            'title' => $title,
                            'message' => $message,
                            'expected_end' => $expected_end
                        )
                    ));
                }
            }
        }
        $token = $this->get_bearer_token();
        if (!$token) {
            $token = $this->create_access_token($freshUser ? $freshUser : $user);
        }

        if ($freshUser) {
            $this->session->set_userdata(array(
                'full_name' => $freshUser['full_name'],
                'email' => $freshUser['email'],
            ));
        }

        return $this->json_response(200, array(
            'status' => 'success',
            'message' => 'Account updated successfully.',
            'data' => array(
                'token' => $token,
                'user' => array(
                    'id' => isset($freshUser['id']) ? $freshUser['id'] : $user['id'],
                    'email' => isset($freshUser['email']) ? $freshUser['email'] : $user['email'],
                    'full_name' => isset($freshUser['full_name']) ? $freshUser['full_name'] : $fullName,
                    'phone' => isset($freshUser['phone']) ? $freshUser['phone'] : $phone,
                    'must_change_password' => $this->must_change_password($freshUser ? $freshUser : $user),
                    'roles' => $roles,
                    'permissions' => $permissions,
                ),
            ),
        ));
    }

    public function logout()
    {
        $this->session->sess_destroy();
        return $this->json_response(200, array(
            'status' => 'success',
            'message' => 'Logout successful.'
        ));
    }

    public function me()
    {
        $this->ensure_password_policy_schema();

        $user = $this->get_user_from_session_or_token();
        if (!$user) {
            return $this->json_response(401, array(
                'status' => 'error',
                'message' => 'Authentication required.'
            ));
        }

        $roles = $this->RBAC_model->get_user_roles($user['id']);
        $permissions = $this->RBAC_model->get_user_permissions($user['id']);
        $token = $this->get_bearer_token();
        if (!$token) {
            $token = $this->create_access_token($user);
        }

        $user_payload = array(
            'id' => $user['id'],
            'email' => $user['email'],
            'full_name' => $user['full_name'],
            'phone' => $user['phone'],
            'must_change_password' => $this->must_change_password($user),
            'roles' => $roles,
            'permissions' => $permissions,
        );

        return $this->json_response(200, array(
            'status' => 'success',
            'message' => 'User authenticated.',
            'data' => array(
                'user' => $user_payload,
                'token' => $token,
            )
        ));
    }

    private function get_user_from_session_or_token()
    {
        if ($this->session->userdata('user_id') && $this->session->userdata('logged_in')) {
            $user_id = $this->session->userdata('user_id');
            return $this->User_model->find_by_id($user_id);
        }

        return $this->user_from_bearer_token();
    }

    private function ensure_password_policy_schema()
    {
        if ($this->db->table_exists('users') && !$this->db->field_exists('must_change_password', 'users')) {
            $this->db->query("ALTER TABLE `users` ADD COLUMN `must_change_password` TINYINT(1) NOT NULL DEFAULT 0 AFTER `password_hash`");
        }
    }

    private function must_change_password($user)
    {
        return isset($user['must_change_password']) && (int) $user['must_change_password'] === 1;
    }

    private function get_bearer_token()
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

        return trim(substr($authorization, 7));
    }

    private function user_from_bearer_token()
    {
        $token = $this->get_bearer_token();
        if (!$token) {
            return null;
        }

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

    private function json_response($status, $payload)
    {
        $this->output
            ->set_status_header($status)
            ->set_content_type('application/json')
            ->set_output(json_encode($payload));
        return;
    }

    private function generate_uuid()
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}

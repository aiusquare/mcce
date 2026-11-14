<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Admin_settings extends CI_Controller {

    public function __construct() {
        parent::__construct();
        $this->load->database();
        $this->load->model('Settings_model');
        // Assume auth and permissions are checked here, we can use the same pattern as other admin controllers.
        // Actually, let's load User_model and RBAC_model.
        $this->load->model('User_model');
        $this->load->model('RBAC_model');
    }

    private function resolve_admin() {
        $header_user_id = $this->input->get_request_header('X-User-Id', true);
        if ($header_user_id) {
            return $this->User_model->find_by_id($header_user_id);
        }
        
        // Try getting from token
        $headers = $this->input->request_headers();
        $auth_header = isset($headers['Authorization']) ? $headers['Authorization'] : (isset($headers['authorization']) ? $headers['authorization'] : '');
        if (preg_match('/Bearer\s(\S+)/', $auth_header, $matches)) {
            $token = $matches[1];
            $parts = explode('.', $token);
            if (count($parts) === 2) {
                $payload = json_decode(base64_decode(strtr($parts[0], '-_', '+/')), true);
                if (isset($payload['sub'])) {
                    return $this->User_model->find_by_id($payload['sub']);
                }
            }
        }
        return null;
    }

    private function json_response($status_code, $data) {
        $this->output
            ->set_status_header($status_code)
            ->set_content_type('application/json', 'utf-8')
            ->set_output(json_encode($data));
    }
    
    private function get_json_body() {
        $stream = $this->security->xss_clean($this->input->raw_input_stream);
        return json_decode($stream, true);
    }

    public function get_settings() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method Not Allowed'));
        }

        $admin = $this->resolve_admin();
        if (!$admin) {
            return $this->json_response(401, array('status' => 'error', 'message' => 'Unauthorized'));
        }

        $settings = $this->Settings_model->get_all();
        
        return $this->json_response(200, array(
            'status' => 'success',
            'data' => $settings
        ));
    }

    public function update_settings() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method Not Allowed'));
        }

        $admin = $this->resolve_admin();
        if (!$admin) {
            return $this->json_response(401, array('status' => 'error', 'message' => 'Unauthorized'));
        }
        
        // TODO: check if user has permission. Usually super admin.
        // I will check if they have Super Admin role
        $roles = $this->RBAC_model->get_user_roles($admin['id']);
        $is_super_admin = false;
        foreach ($roles as $role) {
            if (strtolower($role['name']) === 'super admin') {
                $is_super_admin = true;
                break;
            }
        }
        
        // If not super admin, check if they have specific permission
        if (!$is_super_admin) {
            $perms = $this->RBAC_model->get_user_permissions($admin['id']);
            $has_perm = false;
            foreach ($perms as $perm) {
                if ($perm['name'] === 'manage_settings') {
                    $has_perm = true;
                    break;
                }
            }
            if (!$has_perm) {
                return $this->json_response(403, array('status' => 'error', 'message' => 'Forbidden: You do not have permission to manage settings.'));
            }
        }

        $payload = $this->get_json_body();
        
        // Audit log variables
        $old_enabled = $this->Settings_model->get_setting('student_portal_enabled', '1');
        
        if (isset($payload['student_portal_enabled'])) {
            $this->Settings_model->update_setting('student_portal_enabled', $payload['student_portal_enabled'] ? '1' : '0', $admin['id']);
        }
        if (isset($payload['maintenance_title'])) {
            $this->Settings_model->update_setting('maintenance_title', $payload['maintenance_title'], $admin['id']);
        }
        if (isset($payload['maintenance_message'])) {
            $this->Settings_model->update_setting('maintenance_message', $payload['maintenance_message'], $admin['id']);
        }
        if (isset($payload['maintenance_expected_end'])) {
            $this->Settings_model->update_setting('maintenance_expected_end', $payload['maintenance_expected_end'], $admin['id']);
        }
        
        // Basic audit trail logging if changed
        $new_enabled = isset($payload['student_portal_enabled']) ? ($payload['student_portal_enabled'] ? '1' : '0') : $old_enabled;
        if ($old_enabled !== $new_enabled) {
            $action = $new_enabled === '1' ? 'Student Portal Enabled' : 'Student Portal Disabled';
            // If they have an audit log table, we would insert here. We'll just rely on the updated_by column in system_settings for now.
            // Since the project's exact audit model isn't specified, we'll gracefully skip.
            if ($this->db->table_exists('audit_logs')) {
                $this->db->insert('audit_logs', array(
                    'user_id' => $admin['id'],
                    'action' => $action,
                    'details' => json_encode(array(
                        'old_state' => $old_enabled,
                        'new_state' => $new_enabled,
                        'message' => isset($payload['maintenance_message']) ? $payload['maintenance_message'] : ''
                    )),
                    'created_at' => date('Y-m-d H:i:s')
                ));
            }
        }

        $settings = $this->Settings_model->get_all();
        
        return $this->json_response(200, array(
            'status' => 'success',
            'message' => 'Settings updated successfully.',
            'data' => $settings
        ));
    }
}

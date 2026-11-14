<?php
if (!defined('BASEPATH')) exit('No direct script access allowed');

class MaintenanceHook {
    public function check_maintenance() {
        $CI =& get_instance();
        
        $uri = $CI->uri->uri_string();
        
        // We only enforce maintenance for student routes
        // This includes anything routed to the student controller or api/student
        $is_student_route = (strpos($uri, 'api/student') === 0 || $CI->router->fetch_class() === 'student');
        
        // Let's also check if they are trying to log in as a student
        // But the prompt said: "Where practical, allow the student login page to remain accessible. After a student is identified/authenticated, ensure they cannot proceed into protected portal functionality."
        // So we will NOT block api/auth/login, because we don't know yet if they are a student or admin during login.
        // The frontend will receive the token, but their first protected request (e.g. api/student/profile) will return 503.
        
        if ($is_student_route) {
            $CI->load->database();
            // Check if settings table exists to avoid errors during fresh installs before migration
            if (!$CI->db->table_exists('system_settings')) {
                return;
            }

            $query = $CI->db->get_where('system_settings', array('setting_key' => 'student_portal_enabled'));
            $enabled = '1';
            if ($query->num_rows() > 0) {
                $enabled = $query->row()->setting_value;
            }

            if ($enabled === '0') {
                $title = 'System Maintenance';
                $message = 'The student portal is temporarily unavailable while we perform a system update. Please check back soon.';
                $expected_end = '';

                $query = $CI->db->get_where('system_settings', array('setting_key' => 'maintenance_title'));
                if ($query->num_rows() > 0) $title = $query->row()->setting_value;

                $query = $CI->db->get_where('system_settings', array('setting_key' => 'maintenance_message'));
                if ($query->num_rows() > 0) $message = $query->row()->setting_value;

                $query = $CI->db->get_where('system_settings', array('setting_key' => 'maintenance_expected_end'));
                if ($query->num_rows() > 0) $expected_end = $query->row()->setting_value;

                http_response_code(503);
                header('Content-Type: application/json');
                echo json_encode(array(
                    'status' => 'error',
                    'code' => 'STUDENT_PORTAL_MAINTENANCE',
                    'message' => 'The student portal is in maintenance mode.',
                    'data' => array(
                        'title' => $title,
                        'message' => $message,
                        'expected_end' => $expected_end
                    )
                ));
                exit();
            }
        }
    }
}

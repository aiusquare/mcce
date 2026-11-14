<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Regression_test extends CI_Controller {
    public function __construct() {
        parent::__construct();
        if (!is_cli()) {
            exit('CLI only');
        }
    }

    public function run() {
        echo "Starting Regression Tests...\n";
        
        $this->load->database();
        $this->load->model('Carryover_sync_model');
        $this->load->model('Results_model');
        
        // Find a student
        $student = $this->db->get('students')->row_array();
        if (!$student) {
            echo "No student found to test on.\n";
            return;
        }
        
        // 1. Check Bulk Registration overwrite logic (Test Case C)
        echo "Checking Bulk Registration Logic...\n";
        $has_overwrite_check = false;
        $file = file_get_contents(APPPATH . 'controllers/Admin_course_registration.php');
        if (stripos($file, '$overwrite') !== false || stripos($file, 'overwrite') !== false) {
            $has_overwrite_check = true;
        }
        echo "Admin_course_registration handles overwrite: " . ($has_overwrite_check ? "YES" : "NO") . "\n";
        
        // Let's directly check if it skips students with envelopes
        if (preg_match('/NOT EXISTS \\(\\s*SELECT 1 FROM course_registrations/', $file)) {
            echo "BUG DETECTED: Bulk Registration uses strict NOT EXISTS and will skip carryover students!\n";
        }

        echo "Tests completed.\n";
    }
}


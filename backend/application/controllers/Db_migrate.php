<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Db_migrate extends CI_Controller {
    public function index() {
        $this->load->database();
        $this->load->dbforge();

        $fields = array(
            'source' => array('type' => 'VARCHAR', 'constraint' => '50', 'null' => TRUE),
            'origin_result_attempt_id' => array('type' => 'CHAR', 'constraint' => '36', 'null' => TRUE),
            'origin_session_id' => array('type' => 'CHAR', 'constraint' => '36', 'null' => TRUE),
            'origin_semester_id' => array('type' => 'CHAR', 'constraint' => '36', 'null' => TRUE),
            'origin_level' => array('type' => 'VARCHAR', 'constraint' => '50', 'null' => TRUE),
            'origin_score' => array('type' => 'DECIMAL', 'constraint' => '5,2', 'null' => TRUE),
            'origin_grade' => array('type' => 'VARCHAR', 'constraint' => '5', 'null' => TRUE),
            'last_synced_at' => array('type' => 'DATETIME', 'null' => TRUE),
            'sync_run_id' => array('type' => 'VARCHAR', 'constraint' => '100', 'null' => TRUE),
            'sync_status' => array('type' => 'VARCHAR', 'constraint' => '50', 'null' => TRUE)
        );

        $added = [];
        foreach ($fields as $col => $def) {
            if (!$this->db->field_exists($col, 'course_registration_items')) {
                $this->dbforge->add_column('course_registration_items', array($col => $def));
                $added[] = $col;
            }
        }
        
        echo "Added columns: " . implode(', ', $added);
    }
}


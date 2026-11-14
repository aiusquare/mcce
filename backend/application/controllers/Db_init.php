<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Db_init extends CI_Controller {
    public function __construct() {
        parent::__construct();
        $this->load->database();
    }
    
    public function setup() {
        $sql = "CREATE TABLE IF NOT EXISTS `system_settings` (
          `setting_key` varchar(50) NOT NULL,
          `setting_value` text,
          `updated_by` char(36) DEFAULT NULL,
          `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (`setting_key`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
        
        $this->db->query($sql);
        
        $sql2 = "INSERT IGNORE INTO `system_settings` (`setting_key`, `setting_value`) VALUES 
        ('student_portal_enabled', '1'),
        ('maintenance_title', 'System Maintenance'),
        ('maintenance_message', 'The student portal is temporarily unavailable while we perform a system update. Please check back soon.'),
        ('maintenance_expected_end', '');";
        
        $this->db->query($sql2);
        echo "Database setup completed successfully.";
    }
}

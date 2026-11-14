<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Migration extends CI_Controller {
    public function __construct()
    {
        parent::__construct();
        $this->load->database();
    }

    /**
     * Run all enabled migrations to the latest version.
     * Visit: http://localhost/mcchst-new-updated-backend/migration/run
     */
    public function run()
    {
        $this->load->library('migration');

        if ($this->migration->latest() === FALSE) {
            $error = $this->migration->error_string();
            echo json_encode([
                'status' => 'error',
                'message' => $error ? $error : 'Migration failed'
            ]);
            return;
        }

        echo json_encode([
            'status' => 'success',
            'message' => 'Migrations are up to date',
            'version' => $this->migration->find_migrations() ? max(array_keys($this->migration->find_migrations())) : null
        ]);
    }

    /**
     * Add NIN column to users table
     * Visit: http://localhost/mcchst-new-updated-backend/migration/add_nin
     */
    public function add_nin()
    {
        try {
            // Check if column already exists
            $fields = $this->db->field_data('users');
            $column_exists = false;
            
            foreach ($fields as $field) {
                if ($field->name === 'nin') {
                    $column_exists = true;
                    break;
                }
            }

            if ($column_exists) {
                echo json_encode([
                    'status' => 'info',
                    'message' => 'NIN column already exists in users table'
                ]);
                return;
            }

            // Run migration
            $this->db->query("ALTER TABLE `users` ADD COLUMN `nin` VARCHAR(11) DEFAULT NULL AFTER `phone`");

            echo json_encode([
                'status' => 'success',
                'message' => 'NIN column added successfully to users table'
            ]);
        } catch (Exception $e) {
            echo json_encode([
                'status' => 'error',
                'message' => 'Migration failed: ' . $e->getMessage()
            ]);
        }
    }
}

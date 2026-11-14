<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Migration_Add_applicants_applications extends CI_Migration
{
    public function up()
    {
        $this->load->dbforge();

        $this->ensure_applicants_table();
        $this->ensure_applications_table();
    }

    public function down()
    {
        if ($this->db->table_exists('applications')) {
            $this->dbforge->drop_table('applications', true);
        }

        if ($this->db->table_exists('applicants')) {
            $this->dbforge->drop_table('applicants', true);
        }
    }

    private function ensure_applicants_table()
    {
        if (!$this->db->table_exists('applicants')) {
            $fields = array(
                'id' => array('type' => 'INT', 'constraint' => 10, 'unsigned' => true, 'auto_increment' => true),
                'full_name' => array('type' => 'VARCHAR', 'constraint' => 255, 'null' => true),
                'email' => array('type' => 'VARCHAR', 'constraint' => 255, 'null' => false),
                'phone' => array('type' => 'VARCHAR', 'constraint' => 50, 'null' => true),
                'nin' => array('type' => 'VARCHAR', 'constraint' => 50, 'null' => true),
                'created_at' => array('type' => 'DATETIME', 'null' => true),
            );

            $this->dbforge->add_field($fields);
            $this->dbforge->add_key('id', true);
            $this->dbforge->create_table('applicants', true, array('ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4'));
            $this->ensure_index('applicants', 'email_unique', 'ADD UNIQUE KEY `email_unique` (`email`)');
            return;
        }

        $this->add_column_if_missing('applicants', 'full_name', array('type' => 'VARCHAR', 'constraint' => 255, 'null' => true));
        $this->add_column_if_missing('applicants', 'email', array('type' => 'VARCHAR', 'constraint' => 255, 'null' => false, 'default' => ''));
        $this->add_column_if_missing('applicants', 'phone', array('type' => 'VARCHAR', 'constraint' => 50, 'null' => true));
        $this->add_column_if_missing('applicants', 'nin', array('type' => 'VARCHAR', 'constraint' => 50, 'null' => true));
        $this->add_column_if_missing('applicants', 'created_at', array('type' => 'DATETIME', 'null' => true));
        $this->ensure_index('applicants', 'email_unique', 'ADD UNIQUE KEY `email_unique` (`email`)');
    }

    private function ensure_applications_table()
    {
        if (!$this->db->table_exists('applications')) {
            $fields = array(
                'id' => array('type' => 'INT', 'constraint' => 10, 'unsigned' => true, 'auto_increment' => true),
                'applicant_id' => array('type' => 'INT', 'constraint' => 10, 'unsigned' => true, 'null' => true),
                'programme_id' => array('type' => 'INT', 'constraint' => 10, 'unsigned' => true, 'null' => true),
                'application_no' => array('type' => 'VARCHAR', 'constraint' => 50, 'null' => false),
                'status' => array('type' => 'VARCHAR', 'constraint' => 50, 'null' => false, 'default' => 'submitted'),
                'payload' => array('type' => 'MEDIUMTEXT', 'null' => true),
                'applied_at' => array('type' => 'DATETIME', 'null' => true),
            );

            $this->dbforge->add_field($fields);
            $this->dbforge->add_key('id', true);
            $this->dbforge->add_key('applicant_id');
            $this->dbforge->add_key('programme_id');
            $this->dbforge->create_table('applications', true, array('ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4'));
            $this->ensure_index('applications', 'application_no_unique', 'ADD UNIQUE KEY `application_no_unique` (`application_no`)');
            return;
        }

        $this->add_column_if_missing('applications', 'application_no', array('type' => 'VARCHAR', 'constraint' => 50, 'null' => false, 'default' => ''));
        $this->add_column_if_missing('applications', 'status', array('type' => 'VARCHAR', 'constraint' => 50, 'null' => false, 'default' => 'submitted'));
        $this->add_column_if_missing('applications', 'payload', array('type' => 'MEDIUMTEXT', 'null' => true));
        $this->add_column_if_missing('applications', 'applied_at', array('type' => 'DATETIME', 'null' => true));
        $this->add_column_if_missing('applications', 'programme_id', array('type' => 'INT', 'constraint' => 10, 'unsigned' => true, 'null' => true));

        $this->ensure_index('applications', 'application_no_unique', 'ADD UNIQUE KEY `application_no_unique` (`application_no`)');
        $this->ensure_index('applications', 'applicant_idx', 'ADD KEY `applicant_idx` (`applicant_id`)');
        $this->ensure_index('applications', 'programme_idx', 'ADD KEY `programme_idx` (`programme_id`)');
    }

    private function add_column_if_missing($table, $column, $definition)
    {
        if ($this->db->field_exists($column, $table)) {
            return;
        }

        $this->dbforge->add_column($table, array($column => $definition));
    }

    private function ensure_index($table, $index, $alterSql)
    {
        $query = $this->db->query("SHOW INDEX FROM `{$table}` WHERE Key_name = " . $this->db->escape($index));
        if ($query && $query->num_rows() > 0) {
            return;
        }

        $this->db->query("ALTER TABLE `{$table}` {$alterSql}");
    }
}

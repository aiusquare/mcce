<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Migration_Extend_applicant_application_tables extends CI_Migration
{
    public function up()
    {
        $this->load->dbforge();

        $this->extend_applicants();
        $this->extend_applications();
        $this->create_application_guardians();
        $this->create_application_jamb();
        $this->create_application_olevel_results();
        $this->create_application_documents();
    }

    public function down()
    {
        $this->dbforge->drop_table('application_documents', true);
        $this->dbforge->drop_table('application_olevel_results', true);
        $this->dbforge->drop_table('application_jamb', true);
        $this->dbforge->drop_table('application_guardians', true);

        $this->drop_column_if_exists('applications', 'application_session');
        $this->drop_column_if_exists('applications', 'application_level');
        $this->drop_column_if_exists('applications', 'application_mode_of_entry');
        $this->drop_column_if_exists('applications', 'first_choice_department');
        $this->drop_column_if_exists('applications', 'first_choice_program_code');
        $this->drop_column_if_exists('applications', 'second_choice_department');
        $this->drop_column_if_exists('applications', 'second_choice_program_code');
        $this->drop_column_if_exists('applications', 'previous_institution');
        $this->drop_column_if_exists('applications', 'created_at');
        $this->drop_column_if_exists('applications', 'updated_at');

        $this->drop_column_if_exists('applicants', 'first_name');
        $this->drop_column_if_exists('applicants', 'middle_name');
        $this->drop_column_if_exists('applicants', 'last_name');
        $this->drop_column_if_exists('applicants', 'date_of_birth');
        $this->drop_column_if_exists('applicants', 'gender');
        $this->drop_column_if_exists('applicants', 'address');
        $this->drop_column_if_exists('applicants', 'state');
        $this->drop_column_if_exists('applicants', 'lga');
        $this->drop_column_if_exists('applicants', 'nationality');
        $this->drop_column_if_exists('applicants', 'updated_at');
    }

    private function extend_applicants()
    {
        if (!$this->db->table_exists('applicants')) {
            return;
        }

        $this->add_column_if_missing('applicants', 'first_name', array('type' => 'VARCHAR', 'constraint' => 100, 'null' => true));
        $this->add_column_if_missing('applicants', 'middle_name', array('type' => 'VARCHAR', 'constraint' => 100, 'null' => true));
        $this->add_column_if_missing('applicants', 'last_name', array('type' => 'VARCHAR', 'constraint' => 100, 'null' => true));
        $this->add_column_if_missing('applicants', 'date_of_birth', array('type' => 'DATE', 'null' => true));
        $this->add_column_if_missing('applicants', 'gender', array('type' => 'VARCHAR', 'constraint' => 20, 'null' => true));
        $this->add_column_if_missing('applicants', 'address', array('type' => 'TEXT', 'null' => true));
        $this->add_column_if_missing('applicants', 'state', array('type' => 'VARCHAR', 'constraint' => 100, 'null' => true));
        $this->add_column_if_missing('applicants', 'lga', array('type' => 'VARCHAR', 'constraint' => 100, 'null' => true));
        $this->add_column_if_missing('applicants', 'nationality', array('type' => 'VARCHAR', 'constraint' => 100, 'null' => true));
        $this->add_column_if_missing('applicants', 'updated_at', array('type' => 'DATETIME', 'null' => true));
    }

    private function extend_applications()
    {
        if (!$this->db->table_exists('applications')) {
            return;
        }

        $this->add_column_if_missing('applications', 'application_session', array('type' => 'VARCHAR', 'constraint' => 20, 'null' => true));
        $this->add_column_if_missing('applications', 'application_level', array('type' => 'VARCHAR', 'constraint' => 50, 'null' => true));
        $this->add_column_if_missing('applications', 'application_mode_of_entry', array('type' => 'VARCHAR', 'constraint' => 50, 'null' => true));
        $this->add_column_if_missing('applications', 'first_choice_department', array('type' => 'VARCHAR', 'constraint' => 150, 'null' => true));
        $this->add_column_if_missing('applications', 'first_choice_program_code', array('type' => 'VARCHAR', 'constraint' => 50, 'null' => true));
        $this->add_column_if_missing('applications', 'second_choice_department', array('type' => 'VARCHAR', 'constraint' => 150, 'null' => true));
        $this->add_column_if_missing('applications', 'second_choice_program_code', array('type' => 'VARCHAR', 'constraint' => 50, 'null' => true));
        $this->add_column_if_missing('applications', 'previous_institution', array('type' => 'VARCHAR', 'constraint' => 255, 'null' => true));
        $this->add_column_if_missing('applications', 'created_at', array('type' => 'DATETIME', 'null' => true));
        $this->add_column_if_missing('applications', 'updated_at', array('type' => 'DATETIME', 'null' => true));
    }

    private function create_application_guardians()
    {
        if ($this->db->table_exists('application_guardians')) {
            return;
        }

        $fields = array(
            'id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
            'application_id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
            'name' => array('type' => 'VARCHAR', 'constraint' => 255, 'null' => true),
            'relationship' => array('type' => 'VARCHAR', 'constraint' => 100, 'null' => true),
            'email' => array('type' => 'VARCHAR', 'constraint' => 255, 'null' => true),
            'phone' => array('type' => 'VARCHAR', 'constraint' => 50, 'null' => true),
            'address' => array('type' => 'TEXT', 'null' => true),
            'occupation' => array('type' => 'VARCHAR', 'constraint' => 100, 'null' => true),
            'created_at' => array('type' => 'DATETIME', 'null' => true),
        );

        $this->dbforge->add_field($fields);
        $this->dbforge->add_key('id', true);
        $this->dbforge->add_key('application_id');
        $this->dbforge->create_table('application_guardians', true, array('ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci'));
    }

    private function create_application_jamb()
    {
        if ($this->db->table_exists('application_jamb')) {
            return;
        }

        $fields = array(
            'id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
            'application_id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
            'jamb_number' => array('type' => 'VARCHAR', 'constraint' => 30, 'null' => true),
            'jamb_score' => array('type' => 'INT', 'constraint' => 11, 'null' => true),
            'exam_year' => array('type' => 'VARCHAR', 'constraint' => 10, 'null' => true),
            'created_at' => array('type' => 'DATETIME', 'null' => true),
        );

        $this->dbforge->add_field($fields);
        $this->dbforge->add_key('id', true);
        $this->dbforge->add_key('application_id');
        $this->dbforge->create_table('application_jamb', true, array('ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci'));
    }

    private function create_application_olevel_results()
    {
        if ($this->db->table_exists('application_olevel_results')) {
            return;
        }

        $fields = array(
            'id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
            'application_id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
            'sitting' => array('type' => 'TINYINT', 'constraint' => 1, 'null' => true),
            'exam_body' => array('type' => 'VARCHAR', 'constraint' => 50, 'null' => true),
            'exam_number' => array('type' => 'VARCHAR', 'constraint' => 50, 'null' => true),
            'exam_year' => array('type' => 'VARCHAR', 'constraint' => 10, 'null' => true),
            'exam_type' => array('type' => 'VARCHAR', 'constraint' => 30, 'null' => true),
            'subjects' => array('type' => 'MEDIUMTEXT', 'null' => true),
            'created_at' => array('type' => 'DATETIME', 'null' => true),
        );

        $this->dbforge->add_field($fields);
        $this->dbforge->add_key('id', true);
        $this->dbforge->add_key('application_id');
        $this->dbforge->create_table('application_olevel_results', true, array('ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci'));
    }

    private function create_application_documents()
    {
        if ($this->db->table_exists('application_documents')) {
            return;
        }

        $fields = array(
            'id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
            'application_id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
            'doc_type' => array('type' => 'VARCHAR', 'constraint' => 50, 'null' => true),
            'file_name' => array('type' => 'VARCHAR', 'constraint' => 255, 'null' => true),
            'mime_type' => array('type' => 'VARCHAR', 'constraint' => 100, 'null' => true),
            'storage_path' => array('type' => 'VARCHAR', 'constraint' => 255, 'null' => true),
            'created_at' => array('type' => 'DATETIME', 'null' => true),
        );

        $this->dbforge->add_field($fields);
        $this->dbforge->add_key('id', true);
        $this->dbforge->add_key('application_id');
        $this->dbforge->add_key('doc_type');
        $this->dbforge->create_table('application_documents', true, array('ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci'));
    }

    private function add_column_if_missing($table, $column, $definition)
    {
        if ($this->db->field_exists($column, $table)) {
            return;
        }
        $this->dbforge->add_column($table, array($column => $definition));
    }

    private function drop_column_if_exists($table, $column)
    {
        if (!$this->db->field_exists($column, $table)) {
            return;
        }
        $this->dbforge->drop_column($table, $column);
    }
}

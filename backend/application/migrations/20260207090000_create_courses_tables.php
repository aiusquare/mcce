<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Migration_Create_courses_tables extends CI_Migration
{
    public function up()
    {
        $this->load->dbforge();

        $this->create_departments_table();
        $this->create_programmes_table();
        $this->create_sessions_table();
        $this->create_semesters_table();
        $this->create_courses_table();
        $this->create_course_offerings_table();
    }

    public function down()
    {
        $this->dbforge->drop_table('course_offerings', true);
        $this->dbforge->drop_table('courses', true);
        $this->dbforge->drop_table('semesters', true);
        $this->dbforge->drop_table('academic_sessions', true);
        $this->dbforge->drop_table('programmes', true);
        $this->dbforge->drop_table('departments', true);
    }

    private function create_departments_table()
    {
        if ($this->db->table_exists('departments')) {
            return;
        }

        $fields = array(
            'id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
            'name' => array('type' => 'VARCHAR', 'constraint' => 200, 'null' => false),
            'code' => array('type' => 'VARCHAR', 'constraint' => 50, 'null' => true),
            'created_at' => array('type' => 'DATETIME', 'null' => false),
            'updated_at' => array('type' => 'DATETIME', 'null' => true),
        );

        $this->dbforge->add_field($fields);
        $this->dbforge->add_key('id', true);
        $this->dbforge->add_key('name', false, true);
        $this->dbforge->create_table('departments', true, array('ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci'));
    }

    private function create_programmes_table()
    {
        if ($this->db->table_exists('programmes')) {
            return;
        }

        $fields = array(
            'id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
            'department_id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
            'name' => array('type' => 'VARCHAR', 'constraint' => 200, 'null' => false),
            'code' => array('type' => 'VARCHAR', 'constraint' => 50, 'null' => true),
            'award' => array('type' => 'VARCHAR', 'constraint' => 100, 'null' => true),
            'duration_years' => array('type' => 'INT', 'constraint' => 11, 'null' => false, 'default' => 2),
            'programme_structure' => array('type' => 'VARCHAR', 'constraint' => 30, 'null' => false, 'default' => 'semester'),
            'created_at' => array('type' => 'DATETIME', 'null' => false),
            'updated_at' => array('type' => 'DATETIME', 'null' => true),
        );

        $this->dbforge->add_field($fields);
        $this->dbforge->add_key('id', true);
        $this->dbforge->add_key('code', false, true);
        $this->dbforge->add_key('department_id');
        $this->dbforge->create_table('programmes', true, array('ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci'));
    }

    private function create_sessions_table()
    {
        if ($this->db->table_exists('academic_sessions')) {
            return;
        }

        $fields = array(
            'id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
            'name' => array('type' => 'VARCHAR', 'constraint' => 100, 'null' => false),
            'start_date' => array('type' => 'DATE', 'null' => false),
            'end_date' => array('type' => 'DATE', 'null' => false),
            'is_active' => array('type' => 'TINYINT', 'constraint' => 1, 'null' => false, 'default' => 0),
            'created_at' => array('type' => 'DATETIME', 'null' => false),
            'updated_at' => array('type' => 'DATETIME', 'null' => true),
        );

        $this->dbforge->add_field($fields);
        $this->dbforge->add_key('id', true);
        $this->dbforge->add_key('name', false, true);
        $this->dbforge->create_table('academic_sessions', true, array('ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci'));
    }

    private function create_semesters_table()
    {
        if ($this->db->table_exists('semesters')) {
            return;
        }

        $fields = array(
            'id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
            'name' => array('type' => 'VARCHAR', 'constraint' => 50, 'null' => false),
            'sort_order' => array('type' => 'INT', 'constraint' => 11, 'null' => false),
            'created_at' => array('type' => 'DATETIME', 'null' => false),
            'updated_at' => array('type' => 'DATETIME', 'null' => true),
        );

        $this->dbforge->add_field($fields);
        $this->dbforge->add_key('id', true);
        $this->dbforge->add_key('name', false, true);
        $this->dbforge->create_table('semesters', true, array('ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci'));
    }

    private function create_courses_table()
    {
        if ($this->db->table_exists('courses')) {
            return;
        }

        $fields = array(
            'id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
            'programme_id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
            'code' => array('type' => 'VARCHAR', 'constraint' => 50, 'null' => false),
            'title' => array('type' => 'VARCHAR', 'constraint' => 200, 'null' => false),
            'credit_units' => array('type' => 'INT', 'constraint' => 11, 'null' => false),
            'level' => array('type' => 'VARCHAR', 'constraint' => 30, 'null' => true),
            'type' => array('type' => 'VARCHAR', 'constraint' => 30, 'null' => false, 'default' => 'core'),
            'programme_structure' => array('type' => 'VARCHAR', 'constraint' => 30, 'null' => false, 'default' => 'semester'),
            'contact_number' => array('type' => 'TINYINT', 'constraint' => 3, 'null' => true),
            'year_number' => array('type' => 'TINYINT', 'constraint' => 3, 'null' => true),
            'semester_name' => array('type' => 'VARCHAR', 'constraint' => 50, 'null' => true),
            'created_at' => array('type' => 'DATETIME', 'null' => false),
            'updated_at' => array('type' => 'DATETIME', 'null' => true),
        );

        $this->dbforge->add_field($fields);
        $this->dbforge->add_key('id', true);
        $this->dbforge->add_key(array('code', 'programme_id'), false, true);
        $this->dbforge->add_key('programme_id');
        $this->dbforge->add_key(array('programme_structure', 'contact_number', 'year_number'));
        $this->dbforge->create_table('courses', true, array('ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci'));
    }

    private function create_course_offerings_table()
    {
        if ($this->db->table_exists('course_offerings')) {
            return;
        }

        $fields = array(
            'id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
            'course_id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
            'session_id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
            'semester_id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
            'lecturer_name' => array('type' => 'VARCHAR', 'constraint' => 200, 'null' => true),
            'schedule' => array('type' => 'VARCHAR', 'constraint' => 100, 'null' => true),
            'created_at' => array('type' => 'DATETIME', 'null' => false),
            'updated_at' => array('type' => 'DATETIME', 'null' => true),
        );

        $this->dbforge->add_field($fields);
        $this->dbforge->add_key('id', true);
        $this->dbforge->add_key('course_id');
        $this->dbforge->add_key('session_id');
        $this->dbforge->add_key('semester_id');
        $this->dbforge->create_table('course_offerings', true, array('ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci'));
    }
}

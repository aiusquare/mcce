<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Migration_Create_course_registration_tables extends CI_Migration
{
    public function up()
    {
        $this->load->dbforge();

        // 1. Alter course_offerings to add status
        if (!$this->db->field_exists('status', 'course_offerings')) {
            $fields = array(
                'status' => array(
                    'type' => 'VARCHAR',
                    'constraint' => 20,
                    'null' => false,
                    'default' => 'open'
                )
            );
            $this->dbforge->add_column('course_offerings', $fields);
        }

        // 2. Course Registration Settings
        if (!$this->db->table_exists('course_registration_settings')) {
            $this->dbforge->add_field(array(
                'id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
                'session_id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
                'semester_id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
                'opens_at' => array('type' => 'DATETIME', 'null' => true),
                'closes_at' => array('type' => 'DATETIME', 'null' => true),
                'late_closes_at' => array('type' => 'DATETIME', 'null' => true),
                'status' => array('type' => 'VARCHAR', 'constraint' => 20, 'null' => false, 'default' => 'closed'),
                'require_approval' => array('type' => 'TINYINT', 'constraint' => 1, 'null' => false, 'default' => 1),
                'require_financial_clearance' => array('type' => 'TINYINT', 'constraint' => 1, 'null' => false, 'default' => 0),
                'created_at' => array('type' => 'DATETIME', 'null' => false),
                'updated_at' => array('type' => 'DATETIME', 'null' => true),
            ));
            $this->dbforge->add_key('id', true);
            $this->dbforge->add_key(array('session_id', 'semester_id'), false, true); // unique constraint
            $this->dbforge->create_table('course_registration_settings', true, array('ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4'));
        }

        // 3. Programme Level Credit Rules (Configurable credit rules)
        if (!$this->db->table_exists('credit_load_rules')) {
            $this->dbforge->add_field(array(
                'id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
                'programme_id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
                'level' => array('type' => 'VARCHAR', 'constraint' => 30, 'null' => false),
                'semester_id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => true),
                'min_credits' => array('type' => 'INT', 'null' => false, 'default' => 15),
                'max_credits' => array('type' => 'INT', 'null' => false, 'default' => 24),
                'created_at' => array('type' => 'DATETIME', 'null' => false),
                'updated_at' => array('type' => 'DATETIME', 'null' => true),
            ));
            $this->dbforge->add_key('id', true);
            $this->dbforge->add_key(array('programme_id', 'level', 'semester_id'), false, true);
            $this->dbforge->create_table('credit_load_rules', true, array('ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4'));
        }

        // 4. Course Registrations
        if (!$this->db->table_exists('course_registrations')) {
            $this->dbforge->add_field(array(
                'id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
                'student_id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
                'session_id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
                'semester_id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
                'programme_id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
                'level' => array('type' => 'VARCHAR', 'constraint' => 30, 'null' => false),
                'status' => array('type' => 'VARCHAR', 'constraint' => 20, 'null' => false, 'default' => 'draft'),
                'total_credits' => array('type' => 'INT', 'null' => false, 'default' => 0),
                'submitted_at' => array('type' => 'DATETIME', 'null' => true),
                'approved_at' => array('type' => 'DATETIME', 'null' => true),
                'approved_by' => array('type' => 'CHAR', 'constraint' => 36, 'null' => true),
                'returned_at' => array('type' => 'DATETIME', 'null' => true),
                'returned_by' => array('type' => 'CHAR', 'constraint' => 36, 'null' => true),
                'return_reason' => array('type' => 'TEXT', 'null' => true),
                'created_at' => array('type' => 'DATETIME', 'null' => false),
                'updated_at' => array('type' => 'DATETIME', 'null' => true),
            ));
            $this->dbforge->add_key('id', true);
            $this->dbforge->add_key(array('student_id', 'session_id', 'semester_id'), false, true); // unique constraint
            $this->dbforge->add_key('programme_id');
            $this->dbforge->add_key('status');
            $this->dbforge->create_table('course_registrations', true, array('ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4'));
        }

        // 5. Course Registration Items
        if (!$this->db->table_exists('course_registration_items')) {
            $this->dbforge->add_field(array(
                'id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
                'registration_id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
                'course_id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
                'course_offering_id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => true),
                'registration_type' => array('type' => 'VARCHAR', 'constraint' => 20, 'null' => false, 'default' => 'core'), // core, elective, carryover, repeat
                'status' => array('type' => 'VARCHAR', 'constraint' => 20, 'null' => false, 'default' => 'active'), // active, dropped
                'created_at' => array('type' => 'DATETIME', 'null' => false),
                'updated_at' => array('type' => 'DATETIME', 'null' => true),
            ));
            $this->dbforge->add_key('id', true);
            $this->dbforge->add_key('registration_id');
            $this->dbforge->add_key('course_id');
            $this->dbforge->add_key(array('registration_id', 'course_id'), false, true); // unique
            $this->dbforge->create_table('course_registration_items', true, array('ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4'));
        }

        // 6. Registration Amendments (Audit trail)
        if (!$this->db->table_exists('course_registration_amendments')) {
            $this->dbforge->add_field(array(
                'id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
                'registration_id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
                'actor_id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
                'action_type' => array('type' => 'VARCHAR', 'constraint' => 50, 'null' => false), // add_course, drop_course, approve, return
                'course_id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => true),
                'old_value' => array('type' => 'TEXT', 'null' => true),
                'new_value' => array('type' => 'TEXT', 'null' => true),
                'reason' => array('type' => 'TEXT', 'null' => false),
                'created_at' => array('type' => 'DATETIME', 'null' => false),
            ));
            $this->dbforge->add_key('id', true);
            $this->dbforge->add_key('registration_id');
            $this->dbforge->create_table('course_registration_amendments', true, array('ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4'));
        }
    }

    public function down()
    {
        $this->load->dbforge();
        $this->dbforge->drop_table('course_registration_amendments', true);
        $this->dbforge->drop_table('course_registration_items', true);
        $this->dbforge->drop_table('course_registrations', true);
        $this->dbforge->drop_table('credit_load_rules', true);
        $this->dbforge->drop_table('course_registration_settings', true);

        if ($this->db->field_exists('status', 'course_offerings')) {
            $this->dbforge->drop_column('course_offerings', 'status');
        }
    }
}

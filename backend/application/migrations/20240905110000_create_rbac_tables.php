<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Migration_Create_rbac_tables extends CI_Migration
{
    public function up()
    {
        $this->load->dbforge();


        $this->create_roles_table();
        $this->create_permissions_table();
        $this->create_resources_table();
        $this->create_role_permissions_table();
        $this->create_user_roles_table();
    }

    public function down()
    {
        $this->dbforge->drop_table('user_roles', true);
        $this->dbforge->drop_table('role_permissions', true);
        $this->dbforge->drop_table('permissions', true);
        $this->dbforge->drop_table('resources', true);
        $this->dbforge->drop_table('roles', true);
    }

    private function create_roles_table()
    {
        if ($this->db->table_exists('roles')) {
            return;
        }

        $fields = array(
            'id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
            'name' => array('type' => 'VARCHAR', 'constraint' => 100, 'null' => false),
            'description' => array('type' => 'TEXT', 'null' => true),
            'is_active' => array('type' => 'TINYINT', 'constraint' => 1, 'null' => false, 'default' => 1),
            'created_at' => array('type' => 'DATETIME', 'null' => false),
            'updated_at' => array('type' => 'DATETIME', 'null' => true),
        );

        $this->dbforge->add_field($fields);
        $this->dbforge->add_key('id', true);
        $this->dbforge->add_key('name');
        $this->dbforge->create_table('roles', true, array('ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci'));
    }

    private function create_permissions_table()
    {
        if ($this->db->table_exists('permissions')) {
            return;
        }

        $fields = array(
            'id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
            'name' => array('type' => 'VARCHAR', 'constraint' => 100, 'null' => false),
            'description' => array('type' => 'TEXT', 'null' => true),
            'is_active' => array('type' => 'TINYINT', 'constraint' => 1, 'null' => false, 'default' => 1),
            'created_at' => array('type' => 'DATETIME', 'null' => false),
        );

        $this->dbforge->add_field($fields);
        $this->dbforge->add_key('id', true);
        $this->dbforge->add_key('name');
        $this->dbforge->create_table('permissions', true, array('ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci'));
    }

    private function create_resources_table()
    {
        if ($this->db->table_exists('resources')) {
            return;
        }

        $fields = array(
            'id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
            'name' => array('type' => 'VARCHAR', 'constraint' => 100, 'null' => false),
            'slug' => array('type' => 'VARCHAR', 'constraint' => 100, 'null' => false),
            'description' => array('type' => 'TEXT', 'null' => true),
            'icon' => array('type' => 'VARCHAR', 'constraint' => 50, 'null' => true),
            'path' => array('type' => 'VARCHAR', 'constraint' => 255, 'null' => true),
            'is_active' => array('type' => 'TINYINT', 'constraint' => 1, 'null' => false, 'default' => 1),
            'created_at' => array('type' => 'DATETIME', 'null' => false),
        );

        $this->dbforge->add_field($fields);
        $this->dbforge->add_key('id', true);
        $this->dbforge->add_key('slug');
        $this->dbforge->create_table('resources', true, array('ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci'));
    }

    private function create_role_permissions_table()
    {
        if ($this->db->table_exists('role_permissions')) {
            return;
        }

        $fields = array(
            'id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
            'role_id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
            'permission_id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
            'resource_id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => true),
            'created_at' => array('type' => 'DATETIME', 'null' => false),
        );

        $this->dbforge->add_field($fields);
        $this->dbforge->add_key('id', true);
        $this->dbforge->add_key(array('role_id', 'permission_id', 'resource_id'));
        $this->dbforge->create_table('role_permissions', true, array('ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci'));
    }

    private function create_user_roles_table()
    {
        if ($this->db->table_exists('user_roles')) {
            return;
        }

        $fields = array(
            'id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
            'user_id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
            'role_id' => array('type' => 'CHAR', 'constraint' => 36, 'null' => false),
            'assigned_at' => array('type' => 'DATETIME', 'null' => false),
            'created_at' => array('type' => 'DATETIME', 'null' => false),
        );

        $this->dbforge->add_field($fields);
        $this->dbforge->add_key('id', true);
        $this->dbforge->add_key(array('user_id', 'role_id'));
        $this->dbforge->create_table('user_roles', true, array('ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci'));
    }
}

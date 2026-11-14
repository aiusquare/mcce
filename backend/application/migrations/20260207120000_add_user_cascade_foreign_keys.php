<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Migration_Add_user_cascade_foreign_keys extends CI_Migration
{
    public function up()
    {
        // Ensure user deletions cascade to related tables
        $this->add_fk('user_roles', 'fk_user_roles_user', 'user_id', 'users', 'id');
        $this->add_fk('students', 'fk_students_user', 'user_id', 'users', 'id');
        $this->add_fk('applicants', 'fk_applicants_user', 'user_id', 'users', 'id');
        $this->add_fk('applications', 'fk_applications_applicant', 'applicant_id', 'applicants', 'id');
    }

    public function down()
    {
        $this->drop_fk('applications', 'fk_applications_applicant');
        $this->drop_fk('applicants', 'fk_applicants_user');
        $this->drop_fk('students', 'fk_students_user');
        $this->drop_fk('user_roles', 'fk_user_roles_user');
    }

    private function add_fk($table, $constraint, $column, $refTable, $refColumn, $onDelete = 'CASCADE', $onUpdate = 'CASCADE')
    {
        if (!$this->db->table_exists($table) || !$this->db->field_exists($column, $table)) {
            return;
        }
        if (!$this->db->table_exists($refTable) || !$this->db->field_exists($refColumn, $refTable)) {
            return;
        }

        if ($this->fk_exists($table, $constraint)) {
            $this->drop_fk($table, $constraint);
        }

        $this->db->query(
            "ALTER TABLE `{$table}` ADD CONSTRAINT `{$constraint}` FOREIGN KEY (`{$column}`) REFERENCES `{$refTable}`(`{$refColumn}`) ON DELETE {$onDelete} ON UPDATE {$onUpdate}"
        );
    }

    private function drop_fk($table, $constraint)
    {
        if (!$this->db->table_exists($table)) {
            return;
        }

        if (!$this->fk_exists($table, $constraint)) {
            return;
        }

        $this->db->query("ALTER TABLE `{$table}` DROP FOREIGN KEY `{$constraint}`");
    }

    private function fk_exists($table, $constraint)
    {
        $dbName = $this->db->database;
        $sql = "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? LIMIT 1";
        $query = $this->db->query($sql, array($dbName, $table, $constraint));
        return $query->num_rows() > 0;
    }
}

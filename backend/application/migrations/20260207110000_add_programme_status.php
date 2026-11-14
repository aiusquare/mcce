<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Migration_Add_programme_status extends CI_Migration
{
    public function up()
    {
        if (!$this->db->table_exists('programmes')) {
            return;
        }

        if (!$this->db->field_exists('is_active', 'programmes')) {
            $this->db->query("ALTER TABLE `programmes` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `duration_years`");
        }
    }

    public function down()
    {
        if ($this->db->table_exists('programmes') && $this->db->field_exists('is_active', 'programmes')) {
            $this->db->query("ALTER TABLE `programmes` DROP COLUMN `is_active`");
        }
    }
}

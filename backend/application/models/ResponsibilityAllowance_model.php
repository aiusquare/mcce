<?php
if (!defined('BASEPATH')) exit('No direct script access allowed');

class ResponsibilityAllowance_model extends CI_Model {
    private $table = 'responsibility_allowance';

    public function insert_batch($rows)
    {
        if (empty($rows)) {
            return 0;
        }

        $this->db->trans_start();
        $inserted = $this->db->insert_batch($this->table, $rows);
        $this->db->trans_complete();

        if ($this->db->trans_status() === FALSE) {
            return 0;
        }

        if (is_int($inserted) && $inserted > 0) {
            return $inserted;
        }

        return count($rows);
    }
}

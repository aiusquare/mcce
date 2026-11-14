<?php
if (!defined('BASEPATH')) exit('No direct script access allowed');

class MonthlySalary_model extends CI_Model {
    private $table = 'monthly_salary';

    public function replace_batch($rows, $month_value)
    {
        if (empty($rows)) {
            return 0;
        }

        $this->db->trans_start();
        $this->db->where('month', $month_value)
                 ->delete($this->table);

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

<?php
if (!defined('BASEPATH')) exit('No direct script access allowed');

class Staff_model extends CI_Model {
    private $table = 'staff';
    private $history_table = 'staff_history';

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

    public function insert_history($row)
    {
        if (empty($row) || !isset($row['staff_id']) || !isset($row['effective_from'])) {
            return false;
        }

        return $this->db->insert($this->history_table, $row);
    }

    public function latest_history_for_month($staff_ids, $monthDate)
    {
        if (empty($staff_ids)) {
            return array();
        }

        $this->db->select('*')
                 ->from($this->history_table)
                 ->where_in('staff_id', $staff_ids)
                 ->where('effective_from <=', $monthDate)
                 ->order_by('staff_id', 'ASC')
                 ->order_by('effective_from', 'DESC');

        $rows = $this->db->get()->result_array();
        $map = array();
        foreach ($rows as $row) {
            $sid = $row['staff_id'];
            if (!isset($map[$sid])) {
                $map[$sid] = $row; // first one is latest because of ordering desc
            }
        }
        return $map;
    }

    public function update_by_staff_id($staff_id, $data)
    {
        if (empty($staff_id) || empty($data)) {
            return false;
        }

        $this->db->where('staff_id', $staff_id);
        $this->db->limit(1);
        $this->db->update($this->table, $data);
        return $this->db->affected_rows() >= 0; // allow 0 when data unchanged
    }

    public function list_history($staff_id = null)
    {
        $this->db->from($this->history_table);
        if ($staff_id) {
            $this->db->where('staff_id', $staff_id);
        }
        $this->db->order_by('effective_from', 'DESC');
        $this->db->order_by('created_at', 'DESC');
        return $this->db->get()->result_array();
    }
}

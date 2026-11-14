<?php
if (!defined('BASEPATH')) exit('No direct script access allowed');

class ControlAccount_model extends CI_Model {
    private $table = 'control_accounts';

    public function by_group($group_id)
    {
        $this->db->where('account_group_id', (int)$group_id);
        $this->db->order_by('code', 'ASC');
        return $this->db->get($this->table)->result_array();
    }

    public function find($id)
    {
        $this->db->where('id', (int)$id);
        $this->db->limit(1);
        return $this->db->get($this->table)->row_array();
    }

    public function create($group_id, $code, $name)
    {
        if (!$group_id || !$name) {
            return array('error' => 'Missing required fields');
        }

        $cleanCode = trim((string)$code);
        $cleanName = trim((string)$name);
        $groupId = (int)$group_id;

        // Auto-generate next control code if not provided
        if ($cleanCode === '') {
            $this->db->select('code');
            $this->db->from($this->table);
            $this->db->where('account_group_id', $groupId);
            $codes = $this->db->get()->result_array();

            $maxNum = 0;
            foreach ($codes as $row) {
                $digits = isset($row['code']) ? preg_replace('/\D+/', '', $row['code']) : '';
                if ($digits === '') {
                    continue;
                }
                $num = (int)$digits;
                if ($num > $maxNum) {
                    $maxNum = $num;
                }
            }

            $nextNum = $maxNum + 1;
            $cleanCode = str_pad((string)$nextNum, 2, '0', STR_PAD_LEFT);
        }

        // Check duplicate code within group
        $this->db->where('account_group_id', $groupId);
        $this->db->where('code', $cleanCode);
        $this->db->limit(1);
        $exists = $this->db->get($this->table)->row_array();
        if ($exists) {
            return array('error' => 'Control account code already exists in this group');
        }

        $data = array(
            'account_group_id' => $groupId,
            'code' => $cleanCode,
            'name' => $cleanName,
            'created_at' => date('Y-m-d H:i:s'),
        );

        $this->db->insert($this->table, $data);
        if ($this->db->affected_rows() <= 0) {
            return array('error' => 'Failed to create control account');
        }
        $data['id'] = $this->db->insert_id();
        return $data;
    }
}

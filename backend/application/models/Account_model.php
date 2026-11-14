<?php
if (!defined('BASEPATH')) exit('No direct script access allowed');

class Account_model extends CI_Model {
    private $table = 'accounts';

    public function list_all()
    {
        $this->db->select('a.*, g.code as group_code, g.name as group_name, c.code as control_code, c.name as control_name');
        $this->db->from('accounts a');
        $this->db->join('account_groups g', 'a.account_group_id = g.id', 'left');
        $this->db->join('control_accounts c', 'a.control_account_id = c.id', 'left');
        $this->db->order_by('a.account_number', 'ASC');
        return $this->db->get()->result_array();
    }

    public function find_by_number($account_number)
    {
        $this->db->select('id, account_number, name, account_group_id, control_account_id, account_type');
        $this->db->from($this->table);
        $this->db->where('account_number', trim((string)$account_number));
        $this->db->limit(1);
        return $this->db->get()->row_array();
    }

    public function create($group, $control, $name, $account_type)
    {
        if (!$group || !$control || !$name || !$account_type) {
            return array('error' => 'Missing required fields');
        }

        $cleanType = strtolower(trim($account_type));
        if (!in_array($cleanType, array('personal', 'impersonal'))) {
            return array('error' => 'Invalid account_type');
        }

        $this->db->trans_start();

        // Locking by selecting current max serial for this control
        $this->db->select('code, account_group_id');
        $this->db->from('control_accounts');
        $this->db->where('id', (int)$control);
        $this->db->limit(1);
        $controlRow = $this->db->get()->row_array();
        if (!$controlRow) {
            $this->db->trans_complete();
            return array('error' => 'Control account not found');
        }

        $this->db->select('code');
        $this->db->from('account_groups');
        $this->db->where('id', (int)$group);
        $this->db->limit(1);
        $groupRow = $this->db->get()->row_array();
        if (!$groupRow) {
            $this->db->trans_complete();
            return array('error' => 'Account group not found');
        }

        if ((int)$controlRow['account_group_id'] !== (int)$group) {
            $this->db->trans_complete();
            return array('error' => 'Control account does not belong to group');
        }

        // Next serial number for this control account
        $this->db->select('COUNT(*) AS total');
        $this->db->from($this->table);
        $this->db->where('control_account_id', (int)$control);
        $countRow = $this->db->get()->row_array();
        $nextSerial = isset($countRow['total']) ? ((int)$countRow['total']) + 1 : 1;
        $serialPadded = str_pad((string)$nextSerial, 4, '0', STR_PAD_LEFT);

        $accountNumber = $groupRow['code'] . $controlRow['code'] . $serialPadded;

        $data = array(
            'account_group_id' => (int)$group,
            'control_account_id' => (int)$control,
            'account_number' => $accountNumber,
            'name' => $name,
            'account_type' => $cleanType,
            'created_at' => date('Y-m-d H:i:s'),
        );

        $this->db->insert($this->table, $data);

        $this->db->trans_complete();

        if ($this->db->trans_status() === FALSE) {
            return array('error' => 'Failed to create account');
        }

        $data['id'] = $this->db->insert_id();
        return $data;
    }
}

<?php
if (!defined('BASEPATH')) exit('No direct script access allowed');

class AccountGroup_model extends CI_Model {
    private $table = 'account_groups';

    public function all()
    {
        $this->db->order_by('code', 'ASC');
        return $this->db->get($this->table)->result_array();
    }
}

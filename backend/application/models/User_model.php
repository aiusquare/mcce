<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class User_model extends CI_Model {
    private $table = 'users';

    public function find_by_id($id)
    {
        $query = $this->db->get_where($this->table, array('id' => $id), 1);
        return $query->row_array();
    }

    public function find_by_email($email)
    {
        $query = $this->db->get_where($this->table, array('email' => $email), 1);
        return $query->row_array();
    }

    public function create($data)
    {
        return $this->db->insert($this->table, $data);
    }
}

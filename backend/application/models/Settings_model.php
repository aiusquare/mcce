<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Settings_model extends CI_Model {
    
    public function __construct() {
        parent::__construct();
        $this->load->database();
    }

    public function get_setting($key, $default = null) {
        $query = $this->db->get_where('system_settings', array('setting_key' => $key));
        if ($query->num_rows() > 0) {
            return $query->row()->setting_value;
        }
        return $default;
    }
    
    public function get_all() {
        $query = $this->db->get('system_settings');
        $result = array();
        foreach ($query->result() as $row) {
            $result[$row->setting_key] = $row->setting_value;
        }
        return $result;
    }

    public function update_setting($key, $value, $updated_by = null) {
        $query = $this->db->get_where('system_settings', array('setting_key' => $key));
        
        if ($query->num_rows() > 0) {
            $this->db->where('setting_key', $key);
            $this->db->update('system_settings', array(
                'setting_value' => $value,
                'updated_by' => $updated_by,
                'updated_at' => date('Y-m-d H:i:s')
            ));
        } else {
            $this->db->insert('system_settings', array(
                'setting_key' => $key,
                'setting_value' => $value,
                'updated_by' => $updated_by,
                'updated_at' => date('Y-m-d H:i:s')
            ));
        }
    }
}

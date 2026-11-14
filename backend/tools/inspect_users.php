<?php
require __DIR__ . '/../index.php';
$CI =& get_instance();
$CI->load->database();
$users = $CI->db->get('users')->result_array();
echo "USERS:\n";
print_r($users);

$roles = $CI->db->get('roles')->result_array();
echo "\nROLES:\n";
print_r($roles);

$ur = $CI->db->get('user_roles')->result_array();
echo "\nUSER_ROLES:\n";
print_r($ur);

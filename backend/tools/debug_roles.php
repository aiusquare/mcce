<?php
require __DIR__ . '/../index.php';
$CI =& get_instance();
$CI->load->database();
$email = 'superadmin@aacas.edu.ng';
$user = $CI->db->get_where('users', ['email' => $email])->row_array();
if (!$user) { echo "User not found\n"; exit(0); }
echo "User: {$user['email']} (id={$user['id']})\n";
$roles = $CI->db->get('roles')->result_array();
echo "Roles:\n";
foreach ($roles as $r) {
    echo " - {$r['id']} : {$r['name']}\n";
}
$assigned = $CI->db->select('r.id as role_id, r.name as role_name')
    ->from('roles r')
    ->join('user_roles ur', 'ur.role_id = r.id')
    ->where('ur.user_id', $user['id'])
    ->get()
    ->result_array();

echo "Assigned Roles for user:\n";
foreach ($assigned as $a) {
    echo " - {$a['role_id']} : {$a['role_name']}\n";
}
$rp = $CI->db->select('count(*) as cnt')->from('role_permissions')->get()->row_array();
echo "Total role_permissions: {$rp['cnt']}\n";
$super = $CI->db->get_where('roles', ['name' => 'Super Admin'])->row_array();
if ($super) echo "Super role exists: {$super['id']}\n";
else echo "Super role does not exist\n";
?>
<?php
// One-off seeder to add super admin if missing
require __DIR__ . '/../vendor/autoload.php';
require __DIR__ . '/../index.php';

$CI =& get_instance();
$CI->load->database();

$super_admin_email = 'superadmin@aacas.edu.ng';
$existing = $CI->db->get_where('users', ['email' => $super_admin_email])->row_array();
if ($existing) {
    echo "Super admin already exists: {$existing['email']}\n";
    exit(0);
}

$CI->load->model('RBAC_model');
$user_id = $CI->RBAC_model->generate_uuid();
$CI->db->insert('users', [
    'id' => $user_id,
    'email' => $super_admin_email,
    'full_name' => 'Super Admin',
    'phone' => null,
    'nin' => null,
    'password_hash' => password_hash('SuperAdmin123!', PASSWORD_BCRYPT),
    'status' => 'active',
    'created_at' => date('Y-m-d H:i:s'),
]);
$CI->db->insert('user_roles', [
    'id' => $CI->RBAC_model->generate_uuid(),
    'user_id' => $user_id,
    'role_id' => null, // assign below
    'assigned_at' => date('Y-m-d H:i:s'),
    'created_at' => date('Y-m-d H:i:s'),
]);

// fetch Admin role id
$role = $CI->db->get_where('roles', ['name' => 'Admin'])->row_array();
if ($role) {
    $CI->db->where('user_id', $user_id)->update('user_roles', ['role_id' => $role['id']]);
    echo "Super admin created and assigned to Admin role ({$role['id']}).\n";
} else {
    echo "Super admin created but Admin role not found.\n";
}

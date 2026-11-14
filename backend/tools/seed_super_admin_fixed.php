<?php
// One-off seeder to add super admin (fixed for user_roles schema without 'id')
require __DIR__ . '/../index.php';

$CI =& get_instance();
$CI->load->database();

function generate_uuid() {
    return sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

$super_admin_email = 'superadmin@aacas.edu.ng';
$user = $CI->db->get_where('users', ['email' => $super_admin_email])->row_array();
if ($user) {
    echo "User already exists: {$user['email']} (id={$user['id']})\n";
} else {
    // ensure RBAC_model available for uuid generation
    if (!class_exists('RBAC_model')) {
        $CI->load->model('RBAC_model');
    }
    $user_id = generate_uuid();
    $inserted = $CI->db->insert('users', [
        'id' => $user_id,
        'email' => $super_admin_email,
        'full_name' => 'Super Admin',
        'phone' => null,
        'nin' => null,
        'password_hash' => password_hash('SuperAdmin123!', PASSWORD_BCRYPT),
        'status' => 'active',
        'created_at' => date('Y-m-d H:i:s'),
    ]);
    if ($inserted) {
        echo "Created user {$super_admin_email} (id={$user_id})\n";
    } else {
        echo "Failed to create user.\n";
        var_export($CI->db->error());
        exit(1);
    }
}

// (re)load user id
$user = $CI->db->get_where('users', ['email' => $super_admin_email])->row_array();
if (!$user) {
    echo "User not found after create. Aborting.\n";
    exit(1);
}
$user_id = $user['id'];

// find Admin role
$role = $CI->db->get_where('roles', ['name' => 'Admin'])->row_array();
if (!$role) {
    echo "Admin role not found.\n";
    exit(1);
}
$role_id = $role['id'];

// check existing assignment
$exists = $CI->db->get_where('user_roles', ['user_id' => $user_id, 'role_id' => $role_id])->row_array();
if ($exists) {
    echo "User already assigned to Admin role.\n";
} else {
    // insert into user_roles using schema without 'id'
    $ok = $CI->db->insert('user_roles', [
        'user_id' => $user_id,
        'role_id' => $role_id,
        'created_at' => date('Y-m-d H:i:s'),
    ]);
    if ($ok) {
        echo "Assigned user to Admin role successfully.\n";
    } else {
        echo "Failed to assign role. DB error:\n";
        var_export($CI->db->error());
        exit(1);
    }
}

// Ensure a Super Admin role exists (slug: super_admin) and give it full permissions
$super_role = $CI->db->get_where('roles', ['name' => 'Super Admin'], 1)->row_array();
if (!$super_role) {
    $super_role_id = generate_uuid();
    $created = $CI->db->insert('roles', [
        'id' => $super_role_id,
        'name' => 'Super Admin',
        'description' => 'All privileges (system super administrator)',
        'created_at' => date('Y-m-d H:i:s'),
        'updated_at' => date('Y-m-d H:i:s')
    ]);
    if ($created) {
        echo "Created Super Admin role.\n";
        $super_role = $CI->db->get_where('roles', ['id' => $super_role_id], 1)->row_array();
    } else {
        echo "Failed to create Super Admin role. DB error:\n";
        var_export($CI->db->error());
        exit(1);
    }
}
$super_role_id = $super_role['id'];

// Grant all permissions on all resources to Super Admin (avoid duplicates)
$existing = $CI->db->get_where('role_permissions', ['role_id' => $super_role_id])->row_array();
if (!$existing) {
    $permissions = $CI->db->select('id')->from('permissions')->get()->result_array();
    $resources = $CI->db->select('id')->from('resources')->get()->result_array();
    $rp_inserts = [];
    foreach ($permissions as $perm) {
        foreach ($resources as $res) {
            $rp_inserts[] = [
                'id' => generate_uuid(),
                'role_id' => $super_role_id,
                'permission_id' => $perm['id'],
                'resource_id' => $res['id'],
                'created_at' => date('Y-m-d H:i:s'),
            ];
        }
    }
    if (count($rp_inserts) > 0) {
        $CI->db->insert_batch('role_permissions', $rp_inserts);
        echo "Granted all permissions to Super Admin role.\n";
    }
}

// Assign user to Super Admin role as well (if not already)
$exists_super = $CI->db->get_where('user_roles', ['user_id' => $user_id, 'role_id' => $super_role_id])->row_array();
if (!$exists_super) {
    $ok2 = $CI->db->insert('user_roles', [
        'user_id' => $user_id,
        'role_id' => $super_role_id,
        'created_at' => date('Y-m-d H:i:s'),
    ]);
    if ($ok2) {
        echo "Assigned user to Super Admin role successfully.\n";
    } else {
        echo "Failed to assign Super Admin role. DB error:\n";
        var_export($CI->db->error());
        exit(1);
    }
} else {
    echo "User already assigned to Super Admin role.\n";
}

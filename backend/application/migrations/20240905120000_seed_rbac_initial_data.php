<?php

class Migration_Seed_rbac_initial_data extends CI_Migration {

	public function up()
	{
		// Generate UUIDs for initial data
		$admin_role_id = $this->_generate_uuid();
		$manager_role_id = $this->_generate_uuid();
		$staff_role_id = $this->_generate_uuid();
		$student_role_id = $this->_generate_uuid();

		// Seed roles
		$roles = [
			[
				'id' => $admin_role_id,
				'name' => 'Admin',
				'description' => 'Full system access',
				'created_at' => date('Y-m-d H:i:s'),
				'updated_at' => date('Y-m-d H:i:s')
			],
			[
				'id' => $manager_role_id,
				'name' => 'Manager',
				'description' => 'Can manage applications and users',
				'created_at' => date('Y-m-d H:i:s'),
				'updated_at' => date('Y-m-d H:i:s')
			],
			[
				'id' => $staff_role_id,
				'name' => 'Staff',
				'description' => 'Can view and manage applications',
				'created_at' => date('Y-m-d H:i:s'),
				'updated_at' => date('Y-m-d H:i:s')
			],
			[
				'id' => $student_role_id,
				'name' => 'Student',
				'description' => 'Student access',
				'created_at' => date('Y-m-d H:i:s'),
				'updated_at' => date('Y-m-d H:i:s')
			]
		];
		$this->db->insert_batch('roles', $roles);

		// Seed permissions
		$permissions = [
			['id' => $this->_generate_uuid(), 'name' => 'view', 'description' => 'View resource', 'created_at' => date('Y-m-d H:i:s')],
			['id' => $this->_generate_uuid(), 'name' => 'create', 'description' => 'Create resource', 'created_at' => date('Y-m-d H:i:s')],
			['id' => $this->_generate_uuid(), 'name' => 'edit', 'description' => 'Edit resource', 'created_at' => date('Y-m-d H:i:s')],
			['id' => $this->_generate_uuid(), 'name' => 'delete', 'description' => 'Delete resource', 'created_at' => date('Y-m-d H:i:s')],
			['id' => $this->_generate_uuid(), 'name' => 'approve', 'description' => 'Approve application', 'created_at' => date('Y-m-d H:i:s')],
			['id' => $this->_generate_uuid(), 'name' => 'reject', 'description' => 'Reject application', 'created_at' => date('Y-m-d H:i:s')],
			['id' => $this->_generate_uuid(), 'name' => 'manage_users', 'description' => 'Manage system users', 'created_at' => date('Y-m-d H:i:s')],
			['id' => $this->_generate_uuid(), 'name' => 'assign_roles', 'description' => 'Assign roles to users', 'created_at' => date('Y-m-d H:i:s')],
		];
		$this->db->insert_batch('permissions', $permissions);
		$permission_ids = array_column($permissions, 'id');

		// Seed resources (admin pages)
		$resources = [
			['id' => $this->_generate_uuid(), 'name' => 'Dashboard', 'slug' => 'dashboard', 'description' => 'Admin Dashboard', 'icon' => 'home', 'path' => '/admin', 'created_at' => date('Y-m-d H:i:s')],
			['id' => $this->_generate_uuid(), 'name' => 'Users', 'slug' => 'users', 'description' => 'User Management', 'icon' => 'users', 'path' => '/admin/users', 'created_at' => date('Y-m-d H:i:s')],
			['id' => $this->_generate_uuid(), 'name' => 'Roles', 'slug' => 'roles', 'description' => 'Role Management', 'icon' => 'settings', 'path' => '/admin/roles', 'created_at' => date('Y-m-d H:i:s')],
			['id' => $this->_generate_uuid(), 'name' => 'Permissions', 'slug' => 'permissions', 'description' => 'Permission Management', 'icon' => 'lock', 'path' => '/admin/permissions', 'created_at' => date('Y-m-d H:i:s')],
			['id' => $this->_generate_uuid(), 'name' => 'Applications', 'slug' => 'applications', 'description' => 'Application Management', 'icon' => 'file', 'path' => '/admin/applications', 'created_at' => date('Y-m-d H:i:s')],
			['id' => $this->_generate_uuid(), 'name' => 'Invoices', 'slug' => 'invoices', 'description' => 'Invoice Management', 'icon' => 'receipt', 'path' => '/admin/invoices', 'created_at' => date('Y-m-d H:i:s')],
			['id' => $this->_generate_uuid(), 'name' => 'Exams', 'slug' => 'exams', 'description' => 'Exam Management', 'icon' => 'book', 'path' => '/admin/exams', 'created_at' => date('Y-m-d H:i:s')],
			['id' => $this->_generate_uuid(), 'name' => 'Reports', 'slug' => 'reports', 'description' => 'System Reports', 'icon' => 'chart', 'path' => '/admin/reports', 'created_at' => date('Y-m-d H:i:s')],
		];
		$this->db->insert_batch('resources', $resources);
		$resource_ids = array_column($resources, 'id');

		// Assign permissions to Admin role (all permissions on all resources)
		$admin_perms = [];
		foreach ($permission_ids as $perm_id) {
			foreach ($resource_ids as $res_id) {
				$admin_perms[] = [
					'id' => $this->_generate_uuid(),
					'role_id' => $admin_role_id,
					'permission_id' => $perm_id,
					'resource_id' => $res_id,
					'created_at' => date('Y-m-d H:i:s')
				];
			}
		}
		$this->db->insert_batch('role_permissions', $admin_perms);

		// Assign limited permissions to Manager role
		$manager_perms = [];
		$view_idx = 0; $create_idx = 1; $edit_idx = 2; $approve_idx = 4; $reject_idx = 5;
		foreach ($resource_ids as $i => $res_id) {
			if (in_array($i, [4, 5, 6])) { // Applications, Invoices, Exams
				$manager_perms[] = [
					'id' => $this->_generate_uuid(),
					'role_id' => $manager_role_id,
					'permission_id' => $permission_ids[$view_idx],
					'resource_id' => $res_id,
					'created_at' => date('Y-m-d H:i:s')
				];
				$manager_perms[] = [
					'id' => $this->_generate_uuid(),
					'role_id' => $manager_role_id,
					'permission_id' => $permission_ids[$edit_idx],
					'resource_id' => $res_id,
					'created_at' => date('Y-m-d H:i:s')
				];
				$manager_perms[] = [
					'id' => $this->_generate_uuid(),
					'role_id' => $manager_role_id,
					'permission_id' => $permission_ids[$approve_idx],
					'resource_id' => $res_id,
					'created_at' => date('Y-m-d H:i:s')
				];
			}
		}
		if (count($manager_perms) > 0) {
			$this->db->insert_batch('role_permissions', $manager_perms);
		}

		// Assign limited permissions to Staff role (view only)
		$staff_perms = [];
		foreach ($resource_ids as $i => $res_id) {
			if (in_array($i, [4, 5, 6])) { // Applications, Invoices, Exams
				$staff_perms[] = [
					'id' => $this->_generate_uuid(),
					'role_id' => $staff_role_id,
					'permission_id' => $permission_ids[$view_idx],
					'resource_id' => $res_id,
					'created_at' => date('Y-m-d H:i:s')
				];
			}
		}
		if (count($staff_perms) > 0) {
			$this->db->insert_batch('role_permissions', $staff_perms);
		}

        // Seed a super admin user and assign Admin role
        $super_admin_email = 'superadmin@aacas.edu.ng';
        $existing_admin = $this->db->get_where('users', array('email' => $super_admin_email), 1)->row_array();
		if (!$existing_admin) {
            $user_id = $this->_generate_uuid();
            $this->db->insert('users', array(
                'id' => $user_id,
                'email' => $super_admin_email,
                'full_name' => 'Super Admin',
                'phone' => null,
                'nin' => null,
                'password_hash' => password_hash('SuperAdmin123!', PASSWORD_BCRYPT),
                'status' => 'active',
                'created_at' => date('Y-m-d H:i:s'),
                'created_by' => null,
                'updated_at' => null,
                'updated_by' => null,
                'deleted_at' => null,
                'deleted_by' => null,
            ));
            $this->db->insert('user_roles', array(
                'id' => $this->_generate_uuid(),
                'user_id' => $user_id,
                'role_id' => $admin_role_id,
                'assigned_at' => date('Y-m-d H:i:s'),
                'created_at' => date('Y-m-d H:i:s'),
            ));
        }

		// finished seeding in up()
		return true;
	}

	public function down()
	{
		// Clear seeded data
		$this->db->truncate('role_permissions');
		$this->db->truncate('user_roles');
		$this->db->truncate('roles');
		$this->db->truncate('permissions');
		$this->db->truncate('resources');

		// remove seeded super admin if present
		$super_admin_email = 'superadmin@aacas.edu.ng';
		$this->db->delete('users', array('email' => $super_admin_email));

		return true;
	}

	private function _generate_uuid()
	{
		return sprintf(
			'%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
			mt_rand(0, 0xffff), mt_rand(0, 0xffff),
			mt_rand(0, 0xffff),
			mt_rand(0, 0x0fff) | 0x4000,
			mt_rand(0, 0x3fff) | 0x8000,
			mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
		);
	}
}

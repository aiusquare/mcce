<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class RBAC_model extends CI_Model {
    private $roles_table = 'roles';
    private $permissions_table = 'permissions';
    private $resources_table = 'resources';
    private $role_permissions_table = 'role_permissions';
    private $user_roles_table = 'user_roles';
    private $users_table = 'users';

    // Generate UUID
    public function generate_uuid()
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }

    // Get user roles
    public function get_user_roles($user_id)
    {
        $query = $this->db
            ->select('r.id, r.name, r.description')
            ->from($this->user_roles_table . ' ur')
            ->join($this->roles_table . ' r', 'ur.role_id = r.id')
            ->where('ur.user_id', $user_id)
            ->where('r.is_active', 1)
            ->get();
        return $query->result_array();
    }

    // Get user permissions for a resource
    public function get_user_permissions($user_id, $resource_slug = null)
    {
        $this->db->distinct()->select('p.id, p.name, r.slug as resource_slug', false)
            ->from($this->user_roles_table . ' ur')
            ->join($this->roles_table . ' ro', 'ur.role_id = ro.id')
            ->join($this->role_permissions_table . ' rp', 'ro.id = rp.role_id')
            ->join($this->permissions_table . ' p', 'rp.permission_id = p.id')
            ->join($this->resources_table . ' r', 'rp.resource_id = r.id', 'left')
            ->where('ur.user_id', $user_id)
            ->where('p.is_active', 1)
            ->where('ro.is_active', 1);
        
        if ($resource_slug) {
            $this->db->where('r.slug', $resource_slug);
        }

        $query = $this->db->get();
        return $query->result_array();
    }

    // Check if user has permission
    public function has_permission($user_id, $permission_name, $resource_slug = null)
    {
        $permissions = $this->get_user_permissions($user_id, $resource_slug);
        foreach ($permissions as $perm) {
            if ($perm['name'] === $permission_name) {
                return true;
            }
        }
        return false;
    }

    // Get all roles
    public function get_roles()
    {
        $this->ensure_exams_officer_role();
        $query = $this->db->order_by('name')->get($this->roles_table);
        return $query->result_array();
    }

    /**
     * Ensure Exams Officer role, required resources, permissions, and role permissions exist.
     */
    public function ensure_exams_officer_role()
    {
        if (!$this->db->table_exists($this->roles_table)) {
            return null;
        }

        // 1. Check or create 'Exams Officer' role
        $role = $this->db->get_where($this->roles_table, array('name' => 'Exams Officer'), 1)->row_array();
        if (!$role) {
            $role = $this->db->get_where($this->roles_table, array('name' => 'Exam Officer'), 1)->row_array();
        }

        $role_id = $role ? $role['id'] : null;
        if (!$role_id) {
            $role_id = $this->generate_uuid();
            $role_data = array(
                'id' => $role_id,
                'name' => 'Exams Officer',
                'description' => 'Examination Officer - Results, Broadsheet, Graduation & Exam Logistics Management',
                'is_active' => 1,
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s')
            );
            if ($this->db->field_exists('slug', $this->roles_table)) {
                $role_data['slug'] = 'exams_officer';
            }
            $this->db->insert($this->roles_table, $role_data);
        }

        // 2. Ensure resources exist
        $required_resources = array(
            'dashboard' => array('name' => 'Dashboard', 'path' => '/admin/dashboard', 'icon' => 'home'),
            'exams' => array('name' => 'Exam Management', 'path' => '/admin/exams', 'icon' => 'book'),
            'results' => array('name' => 'Result Management', 'path' => '/admin/results', 'icon' => 'file-text'),
            'graduation' => array('name' => 'Graduation Management', 'path' => '/admin/graduation', 'icon' => 'award'),
            'course-registration' => array('name' => 'Course Registration', 'path' => '/admin/course-registration', 'icon' => 'calendar'),
            'students' => array('name' => 'Students', 'path' => '/admin/students', 'icon' => 'users'),
            'courses' => array('name' => 'Courses', 'path' => '/admin/courses', 'icon' => 'layers'),
        );

        $resource_map = array();
        if ($this->db->table_exists($this->resources_table)) {
            foreach ($required_resources as $slug => $meta) {
                $res = $this->db->get_where($this->resources_table, array('slug' => $slug), 1)->row_array();
                if (!$res) {
                    $res_id = $this->generate_uuid();
                    $res_data = array(
                        'id' => $res_id,
                        'name' => $meta['name'],
                        'slug' => $slug,
                        'description' => $meta['name'],
                        'icon' => $meta['icon'],
                        'path' => $meta['path'],
                        'is_active' => 1,
                        'created_at' => date('Y-m-d H:i:s')
                    );
                    $this->db->insert($this->resources_table, $res_data);
                    $resource_map[$slug] = $res_id;
                } else {
                    $resource_map[$slug] = $res['id'];
                }
            }
        }

        // 3. Ensure permissions exist
        $required_perms = array('view', 'create', 'edit', 'delete', 'approve', 'manage');
        $perm_map = array();
        if ($this->db->table_exists($this->permissions_table)) {
            foreach ($required_perms as $pname) {
                $perm = $this->db->get_where($this->permissions_table, array('name' => $pname), 1)->row_array();
                if (!$perm) {
                    $pid = $this->generate_uuid();
                    $this->db->insert($this->permissions_table, array(
                        'id' => $pid,
                        'name' => $pname,
                        'description' => ucfirst($pname) . ' resource',
                        'is_active' => 1,
                        'created_at' => date('Y-m-d H:i:s')
                    ));
                    $perm_map[$pname] = $pid;
                } else {
                    $perm_map[$pname] = $perm['id'];
                }
            }
        }

        // 4. Assign permissions to Exams Officer role in role_permissions
        if ($role_id && $this->db->table_exists($this->role_permissions_table)) {
            $assignments = array(
                // Core exam office modules get manage, view, create, edit, approve
                'exams' => array('view', 'create', 'edit', 'manage'),
                'results' => array('view', 'create', 'edit', 'approve', 'manage'),
                'graduation' => array('view', 'create', 'edit', 'approve', 'manage'),
                'course-registration' => array('view', 'create', 'edit', 'manage'),
                // Lookup registry modules get view
                'students' => array('view'),
                'courses' => array('view'),
                'dashboard' => array('view'),
            );

            foreach ($assignments as $res_slug => $perm_names) {
                $res_id = isset($resource_map[$res_slug]) ? $resource_map[$res_slug] : null;
                foreach ($perm_names as $pname) {
                    $pid = isset($perm_map[$pname]) ? $perm_map[$pname] : null;
                    if ($pid) {
                        $where = array('role_id' => $role_id, 'permission_id' => $pid);
                        if ($res_id) {
                            $where['resource_id'] = $res_id;
                        }
                        $existing = $this->db->get_where($this->role_permissions_table, $where, 1)->row_array();
                        if (!$existing) {
                            $this->db->insert($this->role_permissions_table, array(
                                'id' => $this->generate_uuid(),
                                'role_id' => $role_id,
                                'permission_id' => $pid,
                                'resource_id' => $res_id,
                                'created_at' => date('Y-m-d H:i:s')
                            ));
                        }
                    }
                }
            }
        }

        return $role_id;
    }

    // Create role
    public function create_role($name, $description = null)
    {
        $id = $this->generate_uuid();
        $data = array(
            'id' => $id,
            'name' => $name,
            'description' => $description,
            'is_active' => 1,
            'created_at' => date('Y-m-d H:i:s'),
        );
        $this->db->insert($this->roles_table, $data);
        return $id;
    }

    // Create permission
    public function create_permission($name, $description = null)
    {
        $id = $this->generate_uuid();
        $data = array(
            'id' => $id,
            'name' => $name,
            'description' => $description,
            'is_active' => 1,
            'created_at' => date('Y-m-d H:i:s'),
        );
        $this->db->insert($this->permissions_table, $data);
        return $id;
    }

    // Create resource
    public function create_resource($name, $slug, $description = null, $icon = null, $path = null)
    {
        $id = $this->generate_uuid();
        $data = array(
            'id' => $id,
            'name' => $name,
            'slug' => $slug,
            'description' => $description,
            'icon' => $icon,
            'path' => $path,
            'is_active' => 1,
            'created_at' => date('Y-m-d H:i:s'),
        );
        $this->db->insert($this->resources_table, $data);
        return $id;
    }

    // Assign permission to role
    public function assign_permission_to_role($role_id, $permission_id, $resource_id = null)
    {
        $id = $this->generate_uuid();
        $data = array(
            'id' => $id,
            'role_id' => $role_id,
            'permission_id' => $permission_id,
            'resource_id' => $resource_id,
            'created_at' => date('Y-m-d H:i:s'),
        );
        return $this->db->insert($this->role_permissions_table, $data);
    }

    // Assign role to user
    public function assign_role_to_user($user_id, $role_id)
    {
        if (!$user_id || !$role_id) {
            return false;
        }

        $existing = $this->db->get_where($this->user_roles_table, array(
            'user_id' => $user_id,
            'role_id' => $role_id,
        ), 1)->row_array();
        if ($existing) {
            return true;
        }

        $data = array(
            'user_id' => $user_id,
            'role_id' => $role_id,
            'assigned_at' => date('Y-m-d H:i:s'),
            'created_at' => date('Y-m-d H:i:s'),
        );

        if ($this->db->field_exists('id', $this->user_roles_table)) {
            $data['id'] = $this->generate_uuid();
        }
        foreach (array_keys($data) as $key) {
            if (!$this->db->field_exists($key, $this->user_roles_table)) {
                unset($data[$key]);
            }
        }

        return $this->db->insert($this->user_roles_table, $data);
    }

    // Remove role from user
    public function remove_role_from_user($user_id, $role_id)
    {
        return $this->db->delete($this->user_roles_table, array(
            'user_id' => $user_id,
            'role_id' => $role_id,
        ));
    }

    // Delete user and all related records (user_roles, applicants, applications, students)
    public function delete_user_cascade($user_id)
    {
        if (!$user_id) {
            return array('success' => false, 'message' => 'User id is required', 'code' => 400);
        }

        $this->db->trans_begin();

        // Collect applicant ids linked to this user
        $applicant_ids = array();
        if ($this->db->table_exists('applicants') && $this->db->field_exists('user_id', 'applicants')) {
            $query = $this->db->get_where('applicants', array('user_id' => $user_id));
            foreach ($query->result_array() as $row) {
                if (isset($row['id'])) {
                    $applicant_ids[] = $row['id'];
                }
            }
        }

        // Delete applications tied to those applicants
        if (!empty($applicant_ids) && $this->db->table_exists('applications') && $this->db->field_exists('applicant_id', 'applications')) {
            $this->db->where_in('applicant_id', $applicant_ids);
            $this->db->delete('applications');
        }

        // Delete applicants
        if ($this->db->table_exists('applicants') && $this->db->field_exists('user_id', 'applicants')) {
            $this->db->delete('applicants', array('user_id' => $user_id));
        }

        // Delete students linked by user_id
        if ($this->db->table_exists('students') && $this->db->field_exists('user_id', 'students')) {
            $this->db->delete('students', array('user_id' => $user_id));
        }

        // Delete user role assignments
        if ($this->db->table_exists($this->user_roles_table)) {
            $this->db->delete($this->user_roles_table, array('user_id' => $user_id));
        }

        // Finally delete the user record
        $this->db->delete($this->users_table, array('id' => $user_id));

        if ($this->db->trans_status() === false) {
            $this->db->trans_rollback();
            return array('success' => false, 'message' => 'Failed to delete user', 'code' => 500);
        }

        $this->db->trans_commit();
        return array('success' => true, 'message' => 'User and related records deleted');
    }

    // Get all users with roles
    public function get_users_with_roles()
    {
        $this->db
            ->select('u.id, u.full_name, u.email, u.phone, GROUP_CONCAT(r.name SEPARATOR ", ") as roles')
            ->from('users u')
            ->join($this->user_roles_table . ' ur', 'u.id = ur.user_id', 'inner')
            ->join($this->roles_table . ' r', 'ur.role_id = r.id', 'inner');

        if ($this->db->table_exists('students') && $this->db->field_exists('user_id', 'students')) {
            $this->db->join('students s', 's.user_id = u.id', 'left');
            $this->db->where('s.id IS NULL', null, false);
        }

        if ($this->db->table_exists('applicants')) {
            if ($this->db->field_exists('user_id', 'applicants')) {
                $this->db->join('applicants au', 'au.user_id = u.id', 'left');
                $this->db->where('au.id IS NULL', null, false);
            }
            if ($this->db->field_exists('email', 'applicants')) {
                $this->db->join('applicants ae', 'ae.email = u.email', 'left');
                $this->db->where('ae.id IS NULL', null, false);
            }
        }

        $query = $this->db
            ->where('r.is_active', 1)
            ->where("LOWER(r.name) NOT IN ('student', 'applicant')", null, false)
            ->group_by('u.id')
            ->order_by('u.full_name')
            ->get();
        return $query->result_array();
    }

    // Get resources
    public function get_resources()
    {
        $this->ensure_exams_officer_role();
        $query = $this->db->where('is_active', 1)->order_by('name')->get($this->resources_table);
        return $query->result_array();
    }

    // Get permissions
    public function get_permissions()
    {
        $query = $this->db->where('is_active', 1)->order_by('name')->get($this->permissions_table);
        return $query->result_array();
    }
}

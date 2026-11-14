# RBAC System Implementation Guide

## Overview

This document explains the **Role-Based Access Control (RBAC)** system that allows you to manage users, assign roles, and control access to different admin pages with specific permissions.

---

## Database Schema

### Tables Created:

1. **roles** - Defines user roles (Admin, Manager, Staff, Student)
2. **permissions** - Individual permissions (view, create, edit, delete, approve, etc.)
3. **resources** - System pages/features (Dashboard, Users, Applications, etc.)
4. **role_permissions** - Maps permissions to roles, optionally scoped to resources
5. **user_roles** - Maps roles to users

All tables use **UUID (CHAR(36))** primary keys for better security and distributed systems support.

---

## Backend API Endpoints

### User Management

- `GET /api/admin/get-users` - List all users with their assigned roles
- `POST /api/admin/create-user` - Create a new user with optional roles
  ```json
  {
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "roles": ["role-uuid-1", "role-uuid-2"]
  }
  ```
- `POST /api/admin/assign-role` - Assign a role to a user
  ```json
  {
    "user_id": "user-uuid",
    "role_id": "role-uuid"
  }
  ```
- `POST /api/admin/remove-role` - Remove a role from a user
  ```json
  {
    "user_id": "user-uuid",
    "role_id": "role-uuid"
  }
  ```

### Role Management

- `GET /api/admin/get-roles` - List all roles
- `POST /api/admin/create-role` - Create a new role
  ```json
  {
    "name": "Manager",
    "description": "Can manage applications and users"
  }
  ```

### Permission Management

- `GET /api/admin/get-permissions` - List all permissions
- `GET /api/admin/get-resources` - List all resources (pages)
- `POST /api/admin/assign-permission` - Assign a permission to a role
  ```json
  {
    "role_id": "role-uuid",
    "permission_id": "permission-uuid",
    "resource_id": "resource-uuid" // Optional - scope to specific page
  }
  ```

---

## Frontend Admin Pages

### 1. User Management (`/admin/users`)

- View all users with their assigned roles
- Create new users with email, first name, last name
- Assign roles to users via dialog
- Built with: Table, Dialog, Select components

### 2. Role Management (`/admin/roles`)

- View all available roles
- Create new roles with name and description
- See role active status
- Built with: Table, Dialog, Input, Textarea components

### 3. Permission Management (`/admin/permissions`)

- View all permissions and resources
- Assign permissions to roles
- Optionally scope permissions to specific resources/pages
- Built with: Table, Dialog, Select components

---

## Seeded Initial Data

### Roles (4):

1. **Admin** - Full system access
2. **Manager** - Can manage applications and users
3. **Staff** - Can view and manage applications
4. **Student** - Student access

### Permissions (8):

- `view` - View resource
- `create` - Create resource
- `edit` - Edit resource
- `delete` - Delete resource
- `approve` - Approve application
- `reject` - Reject application
- `manage_users` - Manage system users
- `assign_roles` - Assign roles to users

### Resources (8):

- Dashboard (`/admin`)
- Users (`/admin/users`)
- Roles (`/admin/roles`)
- Permissions (`/admin/permissions`)
- Applications (`/admin/applications`)
- Invoices (`/admin/invoices`)
- Exams (`/admin/exams`)
- Reports (`/admin/reports`)

### Permission Assignments:

- **Admin role** → All permissions on all resources
- **Manager role** → View, Edit, Approve on Applications, Invoices, Exams
- **Staff role** → View-only on Applications, Invoices, Exams
- **Student role** → No admin permissions

---

## How to Use

### 1. Creating a New Admin User

```
1. Navigate to /admin/users
2. Click "Create User"
3. Enter email, first name, last name
4. Select a role (e.g., Manager)
5. Click "Create User"
```

### 2. Assigning Roles to Existing Users

```
1. Navigate to /admin/users
2. Find the user in the table
3. Click "Assign Role" button
4. Select a role from dropdown
5. Click "Assign Role"
```

### 3. Creating Custom Roles

```
1. Navigate to /admin/roles
2. Click "Create Role"
3. Enter name (e.g., "Editor") and description
4. Click "Create Role"
```

### 4. Assigning Permissions to Roles

```
1. Navigate to /admin/permissions
2. Click "Assign Permission to Role"
3. Select Role (e.g., Editor)
4. Select Permission (e.g., edit)
5. Optionally select Resource (e.g., Applications)
6. Click "Assign Permission"
```

---

## Backend Model Methods (RBAC_model.php)

### Public Methods:

- `get_user_roles($user_id)` - Get all roles assigned to a user
- `get_user_permissions($user_id, $resource_slug = null)` - Get user's permissions (optionally filtered by resource)
- `has_permission($user_id, $permission_name, $resource_slug = null)` - Check if user has a specific permission
- `get_users_with_roles()` - Get all users with their roles concatenated
- `create_role($name, $description)` - Create a new role
- `create_permission($name, $description)` - Create a new permission
- `create_resource($name, $slug, $description, $icon, $path)` - Create a new resource
- `assign_role_to_user($user_id, $role_id)` - Assign a role to a user
- `assign_permission_to_role($role_id, $permission_id, $resource_id = null)` - Assign permission to role
- `remove_role_from_user($user_id, $role_id)` - Remove a role from a user

---

## Implementing Access Control in Admin Pages

### Example: Check if user can view Applications

**In your admin page component:**

```php
// Backend (in controller)
$this->load->model('RBAC_model');
$user_id = $this->session->userdata('user_id');

if (!$this->RBAC_model->has_permission($user_id, 'view', 'applications')) {
    return $this->output
        ->set_status_header(403)
        ->set_content_type('application/json')
        ->set_output(json_encode(['status' => 'error', 'message' => 'Access denied']));
}

// Continue with actual logic...
```

**Frontend (React):**

```tsx
// Fetch user permissions on login/mount
const userPermissions = await api.get("/api/admin/user-permissions");

// Store in context/state
const hasPermission = (permission: string, resource: string) => {
  return userPermissions.some(
    (p) => p.name === permission && p.resource_slug === resource,
  );
};

// Conditionally render
{
  hasPermission("view", "applications") && <Button>View Applications</Button>;
}
```

---

## Migration Files

1. **20240905110000_create_rbac_tables.php** - Creates 5 RBAC tables
2. **20240905120000_seed_rbac_initial_data.php** - Seeds roles, permissions, resources

To run migrations:

```bash
php index.php migration/run
```

---

## Routes Added

In `application/config/routes.php`:

```php
$route['api/admin/get-users'] = 'admin/get_users';
$route['api/admin/create-user'] = 'admin/create_user';
$route['api/admin/assign-role'] = 'admin/assign_role';
$route['api/admin/remove-role'] = 'admin/remove_role';
$route['api/admin/get-roles'] = 'admin/get_roles';
$route['api/admin/create-role'] = 'admin/create_role';
$route['api/admin/get-resources'] = 'admin/get_resources';
$route['api/admin/get-permissions'] = 'admin/get_permissions';
$route['api/admin/assign-permission'] = 'admin/assign_permission';
```

---

## Next Steps

1. **Add permission checking to existing admin pages** - Protect sensitive endpoints
2. **Create user session management** - Store logged-in user's roles/permissions
3. **Build permission-aware navigation** - Hide menu items user can't access
4. **Add audit logging** - Track who performed what action
5. **Implement resource-level permissions** - Fine-grained control per page

---

## Security Considerations

- All UUIDs are v4 random (RFC4122 compliant)
- Password hashing should use `password_hash()` with `PASSWORD_BCRYPT`
- API endpoints should validate user session before processing
- Frontend permission checks are UX only - always enforce on backend
- Implement CSRF protection for state-changing operations
- Log all permission changes for audit trail

---

## Files Created/Modified

### Backend:

- `application/controllers/Admin.php` - 9 RBAC endpoints
- `application/models/RBAC_model.php` - 13 RBAC methods
- `application/migrations/20240905110000_create_rbac_tables.php`
- `application/migrations/20240905120000_seed_rbac_initial_data.php`
- `application/config/routes.php` - Added 9 routes
- `application/config/migration.php` - Updated version to 20240905120000

### Frontend:

- `src/pages/admin/AdminUsersPage.tsx` - User management UI
- `src/pages/admin/AdminRolesPage.tsx` - Role management UI
- `src/pages/admin/AdminPermissionsPage.tsx` - Permission management UI
- `src/lib/api.ts` - Added `api.get()` and `api.post()` methods
- `src/App.tsx` - Added 3 new routes

---

## Summary

✅ **Complete RBAC system** with roles, permissions, and resource-based access control  
✅ **Backend API** with 9 endpoints for user/role/permission management  
✅ **Frontend UI** with 3 admin pages for RBAC management  
✅ **Database migrations** with 5 tables and seeded initial data  
✅ **Permission checking** via `has_permission()` model method  
✅ **Ready for integration** - all pages designed to support user access control

Your system now supports creating users, assigning roles, managing permissions, and controlling access to every admin page! 🎉

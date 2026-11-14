-- Migration: Add admin RBAC permissions, page resources, and seed access roles
-- Purpose: Super Admin can assign registry, exam, finance, lecturer, and page access to administrators.

ALTER TABLE roles
  ADD COLUMN slug VARCHAR(100) DEFAULT NULL AFTER id,
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER description;

UPDATE roles
SET slug = LOWER(REPLACE(TRIM(name), ' ', '_'))
WHERE slug IS NULL OR slug = '';

ALTER TABLE roles
  MODIFY COLUMN slug VARCHAR(100) NOT NULL,
  ADD UNIQUE KEY uq_roles_slug (slug);

CREATE TABLE IF NOT EXISTS permissions (
  id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_permissions_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS resources (
  id CHAR(36) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  name VARCHAR(150) NOT NULL,
  module VARCHAR(50) NOT NULL,
  path VARCHAR(255) NOT NULL,
  description VARCHAR(255) DEFAULT NULL,
  icon VARCHAR(100) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_resources_slug (slug),
  UNIQUE KEY uq_resources_path (path),
  KEY idx_resources_module (module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id CHAR(36) NOT NULL,
  permission_id CHAR(36) NOT NULL,
  resource_id CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (role_id, permission_id, resource_id),
  KEY idx_role_permissions_permission (permission_id),
  KEY idx_role_permissions_resource (resource_id),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id),
  CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id),
  CONSTRAINT fk_role_permissions_resource FOREIGN KEY (resource_id) REFERENCES resources(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO roles (id, slug, name, description, is_active, created_at)
VALUES
  (UUID(), 'super_admin', 'Super Admin', 'Full system access and can assign administrator access', 1, NOW()),
  (UUID(), 'administrator', 'Administrator', 'Admin account with page access assigned by Super Admin', 1, NOW()),
  (UUID(), 'registry', 'Registry Officer', 'Registry and admissions access', 1, NOW()),
  (UUID(), 'exam', 'Exam Officer', 'Exam office and results access', 1, NOW()),
  (UUID(), 'finance', 'Finance Officer', 'Fees and payments access', 1, NOW()),
  (UUID(), 'lecturer', 'Lecturer', 'Lecturer academic workspace access', 1, NOW());

INSERT IGNORE INTO permissions (id, name, description, is_active, created_at)
VALUES
  (UUID(), 'view', 'View page or resource', 1, NOW()),
  (UUID(), 'create', 'Create records', 1, NOW()),
  (UUID(), 'edit', 'Edit records', 1, NOW()),
  (UUID(), 'delete', 'Delete records', 1, NOW()),
  (UUID(), 'approve', 'Approve or publish records', 1, NOW()),
  (UUID(), 'manage', 'Full management access', 1, NOW()),
  (UUID(), 'assign_roles', 'Assign roles and page access', 1, NOW());

INSERT IGNORE INTO resources (id, slug, name, module, path, description, icon, is_active, created_at)
VALUES
  (UUID(), 'dashboard', 'Dashboard', 'overview', '/admin/dashboard', 'Admin dashboard and operational summary', 'Home', 1, NOW()),
  (UUID(), 'students', 'Students', 'registry', '/admin/students', 'Student records and registry data', 'Users', 1, NOW()),
  (UUID(), 'applications', 'Applications', 'registry', '/admin/applications', 'Admission application review', 'FileText', 1, NOW()),
  (UUID(), 'programmes', 'Programmes', 'registry', '/admin/programmes', 'Departments and academic programmes', 'GraduationCap', 1, NOW()),
  (UUID(), 'courses', 'Courses', 'registry', '/admin/courses', 'Course catalogue and offerings', 'GraduationCap', 1, NOW()),
  (UUID(), 'exams', 'Exam Management', 'exam', '/admin/exams', 'Entrance exams, semester exams, and results', 'FileText', 1, NOW()),
  (UUID(), 'fees', 'Fee Management', 'finance', '/admin/fees', 'Fee setup and invoice rules', 'CreditCard', 1, NOW()),
  (UUID(), 'payments', 'Payments', 'finance', '/admin/payments', 'Payment monitoring and reconciliation', 'BarChart3', 1, NOW()),
  (UUID(), 'lecturers', 'Lecturer Access', 'lecturer', '/admin/lecturers', 'Lecturer workspace and course access', 'BookOpen', 1, NOW()),
  (UUID(), 'pro-news', 'News', 'pro', '/admin/pro/news', 'Public news publishing', 'Newspaper', 1, NOW()),
  (UUID(), 'pro-events', 'Events', 'pro', '/admin/pro/events', 'Public event publishing', 'FileText', 1, NOW()),
  (UUID(), 'pro-messages', 'Messages', 'pro', '/admin/pro/messages', 'Contact messages and enquiries', 'FileText', 1, NOW()),
  (UUID(), 'pro-contacts', 'Contact Channels', 'pro', '/admin/pro/contacts', 'Public contact channels', 'Settings', 1, NOW()),
  (UUID(), 'admin-users', 'User Management', 'system', '/admin/users', 'Create administrators and assign roles', 'Users', 1, NOW()),
  (UUID(), 'admin-roles', 'Roles', 'system', '/admin/roles', 'Role definitions', 'Shield', 1, NOW()),
  (UUID(), 'admin-permissions', 'Page Access', 'system', '/admin/permissions', 'Allow page access by role', 'Settings', 1, NOW());

INSERT IGNORE INTO role_permissions (role_id, permission_id, resource_id, created_at)
SELECT roles.id, permissions.id, resources.id, NOW()
FROM roles
CROSS JOIN permissions
CROSS JOIN resources
WHERE roles.slug = 'super_admin';

INSERT IGNORE INTO role_permissions (role_id, permission_id, resource_id, created_at)
SELECT roles.id, permissions.id, resources.id, NOW()
FROM roles
JOIN permissions ON permissions.name IN ('view', 'create', 'edit', 'approve')
JOIN resources ON resources.module = 'registry' OR resources.slug = 'dashboard'
WHERE roles.slug = 'registry';

INSERT IGNORE INTO role_permissions (role_id, permission_id, resource_id, created_at)
SELECT roles.id, permissions.id, resources.id, NOW()
FROM roles
JOIN permissions ON permissions.name IN ('view', 'create', 'edit', 'approve')
JOIN resources ON resources.module = 'exam' OR resources.slug = 'dashboard'
WHERE roles.slug = 'exam';

INSERT IGNORE INTO role_permissions (role_id, permission_id, resource_id, created_at)
SELECT roles.id, permissions.id, resources.id, NOW()
FROM roles
JOIN permissions ON permissions.name IN ('view', 'create', 'edit')
JOIN resources ON resources.module = 'finance' OR resources.slug = 'dashboard'
WHERE roles.slug = 'finance';

INSERT IGNORE INTO role_permissions (role_id, permission_id, resource_id, created_at)
SELECT roles.id, permissions.id, resources.id, NOW()
FROM roles
JOIN permissions ON permissions.name = 'view'
JOIN resources ON resources.module = 'lecturer' OR resources.slug IN ('dashboard', 'courses', 'exams')
WHERE roles.slug = 'lecturer';

-- 1. Get the existing 'super_admin' role ID (or create it if missing)
INSERT IGNORE INTO roles (id, slug, name, description, is_active, created_at)
VALUES (UUID(), 'super_admin', 'Super Administrator', 'Has access to all system modules and settings', 1, NOW());

SET @super_admin_role_id = (SELECT id FROM roles WHERE slug = 'super_admin' LIMIT 1);

-- 2. Link the super admin user to the 'super_admin' role safely
INSERT IGNORE INTO user_roles (user_id, role_id, created_at)
SELECT id, @super_admin_role_id, NOW()
FROM users 
WHERE email = 'superadmin@mcce.edu.ng'
LIMIT 1;

-- 3. Create the 'manage' permission (or ignore if it exists)
INSERT IGNORE INTO permissions (id, name, description, is_active, created_at)
VALUES (UUID(), 'manage', 'Full manage access', 1, NOW());

SET @manage_permission_id = (SELECT id FROM permissions WHERE name = 'manage' LIMIT 1);

-- 4. Seed all system resources (legacy-compatible: omitting module and path)
INSERT IGNORE INTO resources (id, slug, name, description, is_active, created_at) VALUES 
(UUID(), 'dashboard', 'Dashboard', 'Admin dashboard', 1, NOW()),
(UUID(), 'students', 'Students', 'Student records', 1, NOW()),
(UUID(), 'applications', 'Applications', 'Admissions', 1, NOW()),
(UUID(), 'programmes', 'Programmes', 'Academic programmes', 1, NOW()),
(UUID(), 'courses', 'Courses', 'Course catalogue', 1, NOW()),
(UUID(), 'exams', 'Exam Management', 'Exams and results', 1, NOW()),
(UUID(), 'fees', 'Fee Management', 'Fee setup', 1, NOW()),
(UUID(), 'payments', 'Payments', 'Payment monitoring', 1, NOW()),
(UUID(), 'lecturers', 'Lecturer Access', 'Lecturer workspace', 1, NOW()),
(UUID(), 'pro-news', 'News', 'Public news', 1, NOW()),
(UUID(), 'pro-events', 'Events', 'Public events', 1, NOW()),
(UUID(), 'pro-messages', 'Messages', 'Contact messages', 1, NOW()),
(UUID(), 'pro-contacts', 'Contact Channels', 'Public contact channels', 1, NOW()),
(UUID(), 'admin-users', 'User Management', 'User management', 1, NOW()),
(UUID(), 'admin-roles', 'Roles', 'Role definitions', 1, NOW()),
(UUID(), 'admin-permissions', 'Page Access', 'Page access control', 1, NOW()),
(UUID(), 'account-settings', 'Settings', 'Account settings', 1, NOW());

-- 5. Grant the 'manage' permission on ALL resources to the 'super_admin' role
INSERT IGNORE INTO role_permissions (role_id, permission_id, resource_id, created_at)
SELECT @super_admin_role_id, @manage_permission_id, id, NOW()
FROM resources;

-- MCCHST New System Schema (Fresh Database)
-- Target: MySQL/MariaDB (shared hosting, phpMyAdmin compatible)
-- Charset: utf8mb4

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- CREATE DATABASE IF NOT EXISTS mcchst_new
--   DEFAULT CHARACTER SET utf8mb4
--   DEFAULT COLLATE utf8mb4_unicode_ci;

-- USE mcchst_new;

-- =========================================================
-- Audit helpers (soft delete + actor references)
-- =========================================================

-- You may keep created_by/updated_by as user_id (UUID stored as CHAR(36))
-- If you prefer numeric IDs, adjust types accordingly.

-- =========================================================
-- Core identity and access
-- =========================================================

CREATE TABLE roles (
  id CHAR(36) NOT NULL,
  slug VARCHAR(100) NOT NULL,
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
  UNIQUE KEY uq_roles_slug (slug),
  UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id CHAR(36) NOT NULL,
  email VARCHAR(200) NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  phone VARCHAR(50) DEFAULT NULL,
  nin VARCHAR(11) DEFAULT NULL,
  password_hash VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_roles (
  user_id CHAR(36) NOT NULL,
  role_id CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (user_id, role_id),
  KEY idx_user_roles_role (role_id),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE permissions (
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

CREATE TABLE resources (
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

CREATE TABLE role_permissions (
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

CREATE TABLE staff_profiles (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  staff_no VARCHAR(50) DEFAULT NULL,
  office_role VARCHAR(100) DEFAULT NULL,
  department_id CHAR(36) DEFAULT NULL,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_staff_user (user_id),
  KEY idx_staff_department (department_id),
  CONSTRAINT fk_staff_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- Academic structure
-- =========================================================

CREATE TABLE departments (
  id CHAR(36) NOT NULL,
  name VARCHAR(200) NOT NULL,
  code VARCHAR(50) DEFAULT NULL,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_departments_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE programmes (
  id CHAR(36) NOT NULL,
  department_id CHAR(36) NOT NULL,
  name VARCHAR(200) NOT NULL,
  code VARCHAR(50) DEFAULT NULL,
  award VARCHAR(100) DEFAULT NULL,
  duration_years INT NOT NULL DEFAULT 2,
  programme_structure VARCHAR(30) NOT NULL DEFAULT 'semester',
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_programmes_department (department_id),
  UNIQUE KEY uq_programmes_code (code),
  CONSTRAINT fk_programmes_department FOREIGN KEY (department_id) REFERENCES departments(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE academic_sessions (
  id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE semesters (
  id CHAR(36) NOT NULL,
  name VARCHAR(50) NOT NULL,
  sort_order INT NOT NULL,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_semesters_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE courses (
  id CHAR(36) NOT NULL,
  programme_id CHAR(36) NOT NULL,
  code VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  credit_units INT NOT NULL,
  level VARCHAR(30) DEFAULT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'core',
  programme_structure VARCHAR(30) NOT NULL DEFAULT 'semester',
  contact_number TINYINT DEFAULT NULL,
  year_number TINYINT DEFAULT NULL,
  semester_name VARCHAR(50) DEFAULT NULL,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_courses_code (code, programme_id),
  KEY idx_courses_programme (programme_id),
  KEY idx_courses_structure (programme_structure, contact_number, year_number),
  CONSTRAINT fk_courses_programme FOREIGN KEY (programme_id) REFERENCES programmes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE course_offerings (
  id CHAR(36) NOT NULL,
  course_id CHAR(36) NOT NULL,
  session_id CHAR(36) NOT NULL,
  semester_id CHAR(36) NOT NULL,
  lecturer_name VARCHAR(200) DEFAULT NULL,
  schedule VARCHAR(100) DEFAULT NULL,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_course_offerings_course (course_id),
  KEY idx_course_offerings_session (session_id),
  KEY idx_course_offerings_semester (semester_id),
  CONSTRAINT fk_offerings_course FOREIGN KEY (course_id) REFERENCES courses(id),
  CONSTRAINT fk_offerings_session FOREIGN KEY (session_id) REFERENCES academic_sessions(id),
  CONSTRAINT fk_offerings_semester FOREIGN KEY (semester_id) REFERENCES semesters(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- Applicants, admissions, students
-- =========================================================

CREATE TABLE applicants (
  id CHAR(36) NOT NULL,
  email VARCHAR(200) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  other_name VARCHAR(100) DEFAULT NULL,
  phone VARCHAR(50) DEFAULT NULL,
  dob DATE DEFAULT NULL,
  gender VARCHAR(20) DEFAULT NULL,
  address TEXT DEFAULT NULL,
  state VARCHAR(100) DEFAULT NULL,
  lga VARCHAR(100) DEFAULT NULL,
  nin VARCHAR(50) DEFAULT NULL,
  passport_url VARCHAR(255) DEFAULT NULL,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_applicants_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE applications (
  id CHAR(36) NOT NULL,
  applicant_id CHAR(36) NOT NULL,
  application_no VARCHAR(50) NOT NULL,
  session_id CHAR(36) NOT NULL,
  programme_id CHAR(36) NOT NULL,
  entry_mode VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'submitted',
  test_score INT DEFAULT NULL,
  applied_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_applications_no (application_no),
  KEY idx_applications_applicant (applicant_id),
  KEY idx_applications_programme (programme_id),
  CONSTRAINT fk_applications_applicant FOREIGN KEY (applicant_id) REFERENCES applicants(id),
  CONSTRAINT fk_applications_programme FOREIGN KEY (programme_id) REFERENCES programmes(id),
  CONSTRAINT fk_applications_session FOREIGN KEY (session_id) REFERENCES academic_sessions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE admissions (
  id CHAR(36) NOT NULL,
  application_id CHAR(36) NOT NULL,
  admission_number VARCHAR(50) NOT NULL,
  matric_number VARCHAR(50) DEFAULT NULL,
  level VARCHAR(30) DEFAULT NULL,
  admission_date DATE DEFAULT NULL,
  acceptance_deadline DATE DEFAULT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'admitted',
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admissions_number (admission_number),
  UNIQUE KEY uq_admissions_matric (matric_number),
  KEY idx_admissions_application (application_id),
  CONSTRAINT fk_admissions_application FOREIGN KEY (application_id) REFERENCES applications(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE students (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  admission_id CHAR(36) NOT NULL,
  programme_id CHAR(36) NOT NULL,
  department_id CHAR(36) NOT NULL,
  current_level VARCHAR(30) DEFAULT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_students_user (user_id),
  UNIQUE KEY uq_students_admission (admission_id),
  CONSTRAINT fk_students_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_students_admission FOREIGN KEY (admission_id) REFERENCES admissions(id),
  CONSTRAINT fk_students_programme FOREIGN KEY (programme_id) REFERENCES programmes(id),
  CONSTRAINT fk_students_department FOREIGN KEY (department_id) REFERENCES departments(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- Course registration & exam cards
-- =========================================================

CREATE TABLE course_registrations (
  id CHAR(36) NOT NULL,
  student_id CHAR(36) NOT NULL,
  session_id CHAR(36) NOT NULL,
  semester_id CHAR(36) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'submitted',
  total_credits INT NOT NULL DEFAULT 0,
  submitted_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_course_reg_student (student_id),
  KEY idx_course_reg_session (session_id),
  KEY idx_course_reg_semester (semester_id),
  CONSTRAINT fk_course_reg_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_course_reg_session FOREIGN KEY (session_id) REFERENCES academic_sessions(id),
  CONSTRAINT fk_course_reg_semester FOREIGN KEY (semester_id) REFERENCES semesters(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE course_registration_items (
  id CHAR(36) NOT NULL,
  course_registration_id CHAR(36) NOT NULL,
  course_offering_id CHAR(36) NOT NULL,
  course_type VARCHAR(30) NOT NULL DEFAULT 'core',
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_reg_items_reg (course_registration_id),
  KEY idx_reg_items_offering (course_offering_id),
  CONSTRAINT fk_reg_items_reg FOREIGN KEY (course_registration_id) REFERENCES course_registrations(id),
  CONSTRAINT fk_reg_items_offering FOREIGN KEY (course_offering_id) REFERENCES course_offerings(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE exam_cards (
  id CHAR(36) NOT NULL,
  course_registration_id CHAR(36) NOT NULL,
  issued_at DATETIME NOT NULL,
  issued_by CHAR(36) DEFAULT NULL,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_exam_card_reg (course_registration_id),
  CONSTRAINT fk_exam_card_reg FOREIGN KEY (course_registration_id) REFERENCES course_registrations(id),
  CONSTRAINT fk_exam_card_issuer FOREIGN KEY (issued_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- Finance (fees, invoices, payments, wallet)
-- =========================================================

CREATE TABLE fee_items (
  id CHAR(36) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_fee_items_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invoice_templates (
  id CHAR(36) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description VARCHAR(255) DEFAULT NULL,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invoices (
  id CHAR(36) NOT NULL,
  student_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  total_amount DECIMAL(10,2) NOT NULL,
  due_date DATE DEFAULT NULL,
  issued_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_invoices_student (student_id),
  CONSTRAINT fk_invoices_student FOREIGN KEY (student_id) REFERENCES students(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invoice_items (
  id CHAR(36) NOT NULL,
  invoice_id CHAR(36) NOT NULL,
  fee_item_id CHAR(36) NOT NULL,
  description VARCHAR(255) DEFAULT NULL,
  amount DECIMAL(10,2) NOT NULL,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_invoice_items_invoice (invoice_id),
  KEY idx_invoice_items_fee (fee_item_id),
  CONSTRAINT fk_invoice_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  CONSTRAINT fk_invoice_items_fee FOREIGN KEY (fee_item_id) REFERENCES fee_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payments (
  id CHAR(36) NOT NULL,
  invoice_id CHAR(36) NOT NULL,
  reference VARCHAR(100) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  channel VARCHAR(50) DEFAULT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  paid_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payments_reference (reference),
  KEY idx_payments_invoice (invoice_id),
  CONSTRAINT fk_payments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE wallets (
  id CHAR(36) NOT NULL,
  student_id CHAR(36) NOT NULL,
  balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_wallets_student (student_id),
  CONSTRAINT fk_wallets_student FOREIGN KEY (student_id) REFERENCES students(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE wallet_transactions (
  id CHAR(36) NOT NULL,
  wallet_id CHAR(36) NOT NULL,
  reference VARCHAR(100) NOT NULL,
  type VARCHAR(30) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  description VARCHAR(255) DEFAULT NULL,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_wallet_tx_wallet (wallet_id),
  UNIQUE KEY uq_wallet_tx_reference (reference),
  CONSTRAINT fk_wallet_tx_wallet FOREIGN KEY (wallet_id) REFERENCES wallets(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- Clearance, documents, stationeries
-- =========================================================

CREATE TABLE document_requirements (
  id CHAR(36) NOT NULL,
  name VARCHAR(200) NOT NULL,
  deferrable TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE document_submissions (
  id CHAR(36) NOT NULL,
  student_id CHAR(36) NOT NULL,
  requirement_id CHAR(36) NOT NULL,
  submitted_at DATETIME NOT NULL,
  verified_by CHAR(36) DEFAULT NULL,
  verified_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_doc_sub_student (student_id),
  KEY idx_doc_sub_requirement (requirement_id),
  CONSTRAINT fk_doc_sub_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_doc_sub_requirement FOREIGN KEY (requirement_id) REFERENCES document_requirements(id),
  CONSTRAINT fk_doc_sub_verifier FOREIGN KEY (verified_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stationery_items (
  id CHAR(36) NOT NULL,
  name VARCHAR(200) NOT NULL,
  quantity_required INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stationery_receipts (
  id CHAR(36) NOT NULL,
  student_id CHAR(36) NOT NULL,
  stationery_id CHAR(36) NOT NULL,
  quantity_received INT NOT NULL DEFAULT 0,
  received_at DATETIME NOT NULL,
  received_by CHAR(36) DEFAULT NULL,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_stationery_receipts_student (student_id),
  KEY idx_stationery_receipts_item (stationery_id),
  CONSTRAINT fk_stationery_receipts_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_stationery_receipts_item FOREIGN KEY (stationery_id) REFERENCES stationery_items(id),
  CONSTRAINT fk_stationery_receipts_staff FOREIGN KEY (received_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE clearance_records (
  id CHAR(36) NOT NULL,
  student_id CHAR(36) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  expires_at DATE DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_clearance_student (student_id),
  CONSTRAINT fk_clearance_student FOREIGN KEY (student_id) REFERENCES students(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- Hostels
-- =========================================================

CREATE TABLE hostels (
  id CHAR(36) NOT NULL,
  name VARCHAR(200) NOT NULL,
  location VARCHAR(200) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  total_capacity INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE hostel_blocks (
  id CHAR(36) NOT NULL,
  hostel_id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  floor_number INT DEFAULT NULL,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_blocks_hostel (hostel_id),
  CONSTRAINT fk_blocks_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE hostel_rooms (
  id CHAR(36) NOT NULL,
  block_id CHAR(36) NOT NULL,
  room_number VARCHAR(50) NOT NULL,
  room_type VARCHAR(50) NOT NULL,
  description TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_rooms_block (block_id),
  CONSTRAINT fk_rooms_block FOREIGN KEY (block_id) REFERENCES hostel_blocks(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE hostel_bed_spaces (
  id CHAR(36) NOT NULL,
  room_id CHAR(36) NOT NULL,
  bed_number VARCHAR(50) NOT NULL,
  bunk_type VARCHAR(50) DEFAULT NULL,
  price_per_session DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_available TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_bed_spaces_room (room_id),
  CONSTRAINT fk_bed_spaces_room FOREIGN KEY (room_id) REFERENCES hostel_rooms(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE hostel_bookings (
  id CHAR(36) NOT NULL,
  student_id CHAR(36) NOT NULL,
  bed_space_id CHAR(36) NOT NULL,
  session_id CHAR(36) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  booking_date DATETIME NOT NULL,
  check_in_date DATE DEFAULT NULL,
  check_out_date DATE DEFAULT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_status VARCHAR(30) NOT NULL DEFAULT 'unpaid',
  created_at DATETIME NOT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_bookings_student (student_id),
  KEY idx_bookings_bed (bed_space_id),
  CONSTRAINT fk_bookings_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_bookings_bed FOREIGN KEY (bed_space_id) REFERENCES hostel_bed_spaces(id),
  CONSTRAINT fk_bookings_session FOREIGN KEY (session_id) REFERENCES academic_sessions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- Audit event log (optional but recommended)
-- =========================================================

CREATE TABLE audit_events (
  id CHAR(36) NOT NULL,
  actor_id CHAR(36) DEFAULT NULL,
  action VARCHAR(50) NOT NULL,
  entity VARCHAR(100) NOT NULL,
  entity_id CHAR(36) DEFAULT NULL,
  ip_address VARCHAR(50) DEFAULT NULL,
  user_agent VARCHAR(255) DEFAULT NULL,
  payload JSON DEFAULT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_audit_actor (actor_id),
  KEY idx_audit_entity (entity),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Phase 1: Result Management Domain Foundation

CREATE TABLE grading_schemes (
  id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME DEFAULT NULL,
  created_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE grading_ranges (
  id CHAR(36) NOT NULL,
  scheme_id CHAR(36) NOT NULL,
  min_score DECIMAL(5,2) NOT NULL,
  max_score DECIMAL(5,2) NOT NULL,
  letter_grade VARCHAR(5) NOT NULL,
  grade_point DECIMAL(4,2) NOT NULL,
  remark VARCHAR(50) DEFAULT NULL,
  is_pass TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME DEFAULT NULL,
  created_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_grading_range_scheme FOREIGN KEY (scheme_id) REFERENCES grading_schemes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE academic_settings (
  id CHAR(36) NOT NULL,
  setting_key VARCHAR(50) NOT NULL,
  setting_value VARCHAR(255) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_academic_setting_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE result_batches (
  id CHAR(36) NOT NULL,
  session_id CHAR(36) NOT NULL,
  semester_id CHAR(36) NOT NULL,
  department_id CHAR(36) DEFAULT NULL,
  programme_id CHAR(36) DEFAULT NULL,
  level VARCHAR(20) DEFAULT NULL,
  course_id CHAR(36) NOT NULL,
  lecturer_id CHAR(36) DEFAULT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'draft', -- draft, submitted, approved, published
  submitted_at DATETIME DEFAULT NULL,
  approved_at DATETIME DEFAULT NULL,
  published_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME DEFAULT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_result_batch_session FOREIGN KEY (session_id) REFERENCES academic_sessions(id),
  CONSTRAINT fk_result_batch_semester FOREIGN KEY (semester_id) REFERENCES semesters(id),
  CONSTRAINT fk_result_batch_dept FOREIGN KEY (department_id) REFERENCES departments(id),
  CONSTRAINT fk_result_batch_prog FOREIGN KEY (programme_id) REFERENCES programmes(id),
  CONSTRAINT fk_result_batch_course FOREIGN KEY (course_id) REFERENCES courses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE result_attempts (
  id CHAR(36) NOT NULL,
  batch_id CHAR(36) NOT NULL,
  student_id CHAR(36) NOT NULL,
  course_registration_id CHAR(36) DEFAULT NULL,
  ca_score DECIMAL(5,2) DEFAULT NULL,
  exam_score DECIMAL(5,2) DEFAULT NULL,
  total_score DECIMAL(5,2) DEFAULT NULL,
  grade VARCHAR(5) DEFAULT NULL,
  grade_point DECIMAL(4,2) DEFAULT NULL,
  quality_point DECIMAL(6,2) DEFAULT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active', -- active, withheld, incomplete
  is_locked TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME DEFAULT NULL,
  created_by CHAR(36) DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_result_attempt_batch FOREIGN KEY (batch_id) REFERENCES result_batches(id),
  CONSTRAINT fk_result_attempt_student FOREIGN KEY (student_id) REFERENCES students(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



-- =========================================================
-- Broadsheet Integrity, Snapshots, Governance & Auditing (Migration 020)
-- =========================================================

-- Added to result_attempts:
-- ALTER TABLE `result_attempts` ADD COLUMN `result_state` VARCHAR(20) NOT NULL DEFAULT 'pending' AFTER `status`;
-- ALTER TABLE `result_attempts` ADD COLUMN `credit_units_snapshot` TINYINT NULL AFTER `result_state`;
-- ALTER TABLE `result_attempts` ADD COLUMN `registration_type_snapshot` VARCHAR(20) NULL AFTER `credit_units_snapshot`;
-- ALTER TABLE `result_attempts` ADD COLUMN `contact_number` TINYINT NULL AFTER `registration_type_snapshot`;
-- ALTER TABLE `result_attempts` ADD COLUMN `grading_scheme_id` CHAR(36) NULL AFTER `contact_number`;
-- ALTER TABLE `result_attempts` ADD INDEX `idx_attempt_student_batch` (`student_id`, `batch_id`);
-- ALTER TABLE `result_attempts` ADD INDEX `idx_attempt_batch_state` (`batch_id`, `result_state`);

-- Added to result_batches:
-- ALTER TABLE `result_batches` ADD COLUMN `contact_number` TINYINT NULL AFTER `level`;
-- ALTER TABLE `result_batches` ADD COLUMN `session_name_snapshot` VARCHAR(30) NULL AFTER `session_id`;
-- ALTER TABLE `result_batches` ADD INDEX `idx_rb_scope_status` (`session_id`, `semester_id`, `programme_id`, `status`);

CREATE TABLE IF NOT EXISTS `broadsheet_snapshots` (
  `id` CHAR(36) NOT NULL,
  `session_id` VARCHAR(50) NOT NULL,
  `semester_id` VARCHAR(50) NOT NULL,
  `programme_id` VARCHAR(50) NOT NULL,
  `level` VARCHAR(30) NULL,
  `entry_mode` VARCHAR(30) NOT NULL DEFAULT 'all',
  `basis` VARCHAR(20) NOT NULL DEFAULT 'published',
  `version` INT NOT NULL DEFAULT 1,
  `status` VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, submitted, approved, superseded
  `payload_json` LONGTEXT NOT NULL,
  `payload_hash` CHAR(64) NOT NULL,
  `verification_code` VARCHAR(20) NOT NULL,
  `generated_by` CHAR(36) NULL,
  `generated_at` DATETIME NOT NULL,
  `submitted_at` DATETIME NULL,
  `approved_at` DATETIME NULL,
  `locked_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_snapshot_verification_code` (`verification_code`),
  INDEX `idx_snapshot_lookup` (`session_id`, `semester_id`, `programme_id`, `version`),
  INDEX `idx_snapshot_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `broadsheet_approvals` (
  `id` CHAR(36) NOT NULL,
  `snapshot_id` CHAR(36) NOT NULL,
  `role_key` VARCHAR(50) NOT NULL, -- e.g. 'course_coordinator', 'hod', 'dean', 'academic_board'
  `user_id` CHAR(36) NOT NULL,
  `action` VARCHAR(20) NOT NULL, -- 'approve', 'reject'
  `comment` TEXT NULL,
  `acted_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_approval_snapshot` (`snapshot_id`),
  INDEX `idx_approval_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `result_amendments` (
  `id` CHAR(36) NOT NULL,
  `attempt_id` CHAR(36) NULL,
  `batch_id` CHAR(36) NULL,
  `student_id` CHAR(36) NOT NULL,
  `field` VARCHAR(50) NOT NULL, -- e.g. 'grade', 'total_score', 'roster_drop', 'scheme_recalc'
  `old_value` TEXT NULL,
  `new_value` TEXT NULL,
  `reason` TEXT NOT NULL,
  `actor_id` CHAR(36) NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_amendment_student` (`student_id`),
  INDEX `idx_amendment_batch` (`batch_id`),
  INDEX `idx_amendment_attempt` (`attempt_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `broadsheet_audit_log` (
  `id` CHAR(36) NOT NULL,
  `snapshot_id` CHAR(36) NULL,
  `action` VARCHAR(30) NOT NULL, -- 'generate', 'export_pdf', 'export_xlsx', 'export_docx', 'print', 'approve', 'reject'
  `actor_id` CHAR(36) NULL,
  `meta_json` TEXT NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_audit_snapshot` (`snapshot_id`),
  INDEX `idx_audit_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

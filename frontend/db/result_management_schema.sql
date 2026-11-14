-- Phase 1: Result Management Domain Foundation

CREATE TABLE IF NOT EXISTS grading_schemes (
  id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME DEFAULT NULL,
  created_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS grading_ranges (
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

CREATE TABLE IF NOT EXISTS academic_settings (
  id CHAR(36) NOT NULL,
  setting_key VARCHAR(50) NOT NULL,
  setting_value TEXT DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by CHAR(36) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_academic_setting_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS result_batches (
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

CREATE TABLE IF NOT EXISTS result_attempts (
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

ALTER TABLE `result_attempts` ADD COLUMN IF NOT EXISTS `result_state` VARCHAR(20) NOT NULL DEFAULT 'pending' AFTER `status`;
ALTER TABLE `result_attempts` ADD COLUMN IF NOT EXISTS `credit_units_snapshot` TINYINT NULL AFTER `result_state`;
ALTER TABLE `result_attempts` ADD COLUMN IF NOT EXISTS `registration_type_snapshot` VARCHAR(20) NULL AFTER `credit_units_snapshot`;
ALTER TABLE `result_attempts` ADD COLUMN IF NOT EXISTS `contact_number` TINYINT NULL AFTER `registration_type_snapshot`;
ALTER TABLE `result_attempts` ADD COLUMN IF NOT EXISTS `grading_scheme_id` CHAR(36) NULL AFTER `contact_number`;
ALTER TABLE `result_attempts` ADD INDEX IF NOT EXISTS `idx_attempt_student_batch` (`student_id`, `batch_id`);
ALTER TABLE `result_attempts` ADD INDEX IF NOT EXISTS `idx_attempt_batch_state` (`batch_id`, `result_state`);

ALTER TABLE `result_batches` ADD COLUMN IF NOT EXISTS `contact_number` TINYINT NULL AFTER `level`;
ALTER TABLE `result_batches` ADD COLUMN IF NOT EXISTS `session_name_snapshot` VARCHAR(30) NULL AFTER `session_id`;
ALTER TABLE `result_batches` ADD INDEX IF NOT EXISTS `idx_rb_scope_status` (`session_id`, `semester_id`, `programme_id`, `status`);

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

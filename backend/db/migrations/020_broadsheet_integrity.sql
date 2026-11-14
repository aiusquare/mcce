-- Migration 020: Broadsheet Integrity, Snapshots, Governance, and Result State Tracking
-- Optimized for MariaDB 10.3+ and phpMyAdmin execution (no DELIMITER or stored procedures required)

-- ----------------------------------------------------------------------------
-- 1. Clean up any leftover helper procedures
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_add_col_if_missing`;
DROP PROCEDURE IF EXISTS `sp_add_idx_if_missing`;

-- ----------------------------------------------------------------------------
-- 2. Alter result_attempts: result_state, snapshot units, contact, scheme
-- ----------------------------------------------------------------------------
ALTER TABLE `result_attempts` ADD COLUMN IF NOT EXISTS `result_state` VARCHAR(20) NOT NULL DEFAULT 'pending' AFTER `status`;
ALTER TABLE `result_attempts` ADD COLUMN IF NOT EXISTS `credit_units_snapshot` TINYINT NULL AFTER `result_state`;
ALTER TABLE `result_attempts` ADD COLUMN IF NOT EXISTS `registration_type_snapshot` VARCHAR(20) NULL AFTER `credit_units_snapshot`;
ALTER TABLE `result_attempts` ADD COLUMN IF NOT EXISTS `contact_number` TINYINT NULL AFTER `registration_type_snapshot`;
ALTER TABLE `result_attempts` ADD COLUMN IF NOT EXISTS `grading_scheme_id` CHAR(36) NULL AFTER `contact_number`;

ALTER TABLE `result_attempts` ADD INDEX IF NOT EXISTS `idx_attempt_student_batch` (`student_id`, `batch_id`);
ALTER TABLE `result_attempts` ADD INDEX IF NOT EXISTS `idx_attempt_batch_state` (`batch_id`, `result_state`);

-- ----------------------------------------------------------------------------
-- 3. Alter result_batches: contact_number, session_name_snapshot
-- ----------------------------------------------------------------------------
ALTER TABLE `result_batches` ADD COLUMN IF NOT EXISTS `contact_number` TINYINT NULL AFTER `level`;
ALTER TABLE `result_batches` ADD COLUMN IF NOT EXISTS `session_name_snapshot` VARCHAR(30) NULL AFTER `session_id`;

ALTER TABLE `result_batches` ADD INDEX IF NOT EXISTS `idx_rb_scope_status` (`session_id`, `semester_id`, `programme_id`, `status`);

-- ----------------------------------------------------------------------------
-- 4. Create Tables for Broadsheet Governance & Auditing
-- ----------------------------------------------------------------------------

-- Table: broadsheet_snapshots
CREATE TABLE IF NOT EXISTS `broadsheet_snapshots` (
  `id` CHAR(36) NOT NULL,
  `session_id` VARCHAR(50) NOT NULL,
  `semester_id` VARCHAR(50) NOT NULL,
  `programme_id` VARCHAR(50) NOT NULL,
  `level` VARCHAR(30) NULL,
  `entry_mode` VARCHAR(30) NOT NULL DEFAULT 'all',
  `basis` VARCHAR(20) NOT NULL DEFAULT 'published',
  `version` INT NOT NULL DEFAULT 1,
  `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
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

-- Table: broadsheet_approvals
CREATE TABLE IF NOT EXISTS `broadsheet_approvals` (
  `id` CHAR(36) NOT NULL,
  `snapshot_id` CHAR(36) NOT NULL,
  `role_key` VARCHAR(50) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `action` VARCHAR(20) NOT NULL,
  `comment` TEXT NULL,
  `acted_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_approval_snapshot` (`snapshot_id`),
  INDEX `idx_approval_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: result_amendments
CREATE TABLE IF NOT EXISTS `result_amendments` (
  `id` CHAR(36) NOT NULL,
  `attempt_id` CHAR(36) NULL,
  `batch_id` CHAR(36) NULL,
  `student_id` CHAR(36) NOT NULL,
  `field` VARCHAR(50) NOT NULL,
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

-- Table: broadsheet_audit_log
CREATE TABLE IF NOT EXISTS `broadsheet_audit_log` (
  `id` CHAR(36) NOT NULL,
  `snapshot_id` CHAR(36) NULL,
  `action` VARCHAR(30) NOT NULL,
  `actor_id` CHAR(36) NULL,
  `meta_json` TEXT NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_audit_snapshot` (`snapshot_id`),
  INDEX `idx_audit_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. Seed Default Academic Policy Settings
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `academic_settings` (
  `id` CHAR(36) NOT NULL,
  `setting_key` VARCHAR(50) NOT NULL,
  `setting_value` TEXT NULL,
  `updated_at` DATETIME NULL,
  `updated_by` CHAR(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_academic_setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `academic_settings` (`id`, `setting_key`, `setting_value`, `updated_at`) VALUES
('set-basis', 'broadsheet_official_basis', 'published', NOW()),
('set-cgpa-den', 'cgpa_denominator', 'reported', NOW()),
('set-abs-pol', 'abs_policy', 'fail', NOW()),
('set-with-below', 'withdrawal_below_cgpa', '1.00', NOW()),
('set-prob-min', 'probation_min_cgpa', '1.00', NOW()),
('set-prob-up', 'probation_upper_cgpa', '1.50', NOW()),
('set-inst-name', 'institution_name', 'Maslaha Community College of Education', NOW()),
('set-fin-cont', 'final_contact_number', '6', NOW()),
('set-appr-chain', 'approval_chain', '[\"Course Coordinator\", \"Head of Department\", \"Dean / Director\"]', NOW()),
('set-class-bands', 'classification_bands', '[{\"label\": \"Distinction\", \"min\": 4.50, \"max\": 5.00}, {\"label\": \"Credit\", \"min\": 3.50, \"max\": 4.49}, {\"label\": \"Merit\", \"min\": 2.50, \"max\": 3.49}, {\"label\": \"Pass\", \"min\": 1.50, \"max\": 2.49}, {\"label\": \"Fail\", \"min\": 0.00, \"max\": 1.49}]', NOW());

-- ----------------------------------------------------------------------------
-- 6. Backfill Data: result_state, snapshot units, contact number
-- ----------------------------------------------------------------------------

-- Set result_state based on grade and score
UPDATE `result_attempts`
SET `result_state` = CASE
    WHEN `grade` = 'ABS' THEN 'absent'
    WHEN `total_score` IS NOT NULL OR (`grade` IS NOT NULL AND `grade` NOT IN ('', '-', '—')) THEN 'entered'
    ELSE 'pending'
END
WHERE `result_state` IS NULL OR `result_state` = 'pending';

-- Snapshot credit_units from courses
UPDATE `result_attempts` a
JOIN `result_batches` b ON b.id = a.batch_id
JOIN `courses` c ON c.id = b.course_id
SET a.`credit_units_snapshot` = c.`credit_units`
WHERE a.`credit_units_snapshot` IS NULL;

-- Snapshot contact_number from batches or semesters
UPDATE `result_batches` b
LEFT JOIN `semesters` s ON (s.id = b.semester_id OR s.name = b.semester_id)
SET b.`contact_number` = CASE
    WHEN b.`level` REGEXP '^[0-9]+$' THEN CAST(b.`level` AS UNSIGNED)
    WHEN b.`level` REGEXP 'Contact[[:space:]]*([0-9]+)' THEN CAST(SUBSTRING_INDEX(b.`level`, ' ', -1) AS UNSIGNED)
    WHEN s.`name` REGEXP 'Contact[[:space:]]*([0-9]+)' THEN CAST(SUBSTRING_INDEX(s.`name`, ' ', -1) AS UNSIGNED)
    ELSE NULL
END
WHERE b.`contact_number` IS NULL;

-- Copy batch contact_number to attempts
UPDATE `result_attempts` a
JOIN `result_batches` b ON b.id = a.batch_id
SET a.`contact_number` = b.`contact_number`
WHERE a.`contact_number` IS NULL AND b.`contact_number` IS NOT NULL;

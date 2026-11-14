-- Migration 035: Broadsheet Snapshot V2, Canonical Scopes, Dependency Chains, and Invalidation
-- Compatible with MySQL 5.7+ / MariaDB 10.3+

-- 1. Extend broadsheet_snapshots
ALTER TABLE `broadsheet_snapshots` 
  ADD COLUMN IF NOT EXISTS `scope_hash` CHAR(64) NOT NULL DEFAULT '' AFTER `verification_code`,
  ADD COLUMN IF NOT EXISTS `cohort` VARCHAR(50) NOT NULL DEFAULT 'all' AFTER `entry_mode`,
  ADD COLUMN IF NOT EXISTS `contact_number` TINYINT NULL AFTER `level`,
  ADD COLUMN IF NOT EXISTS `previous_snapshot_id` CHAR(36) NULL AFTER `contact_number`,
  ADD COLUMN IF NOT EXISTS `supersedes_snapshot_id` CHAR(36) NULL AFTER `previous_snapshot_id`,
  ADD COLUMN IF NOT EXISTS `source_watermark` DATETIME NULL AFTER `locked_at`,
  ADD COLUMN IF NOT EXISTS `stale_at` DATETIME NULL AFTER `source_watermark`,
  ADD COLUMN IF NOT EXISTS `stale_reason` VARCHAR(255) NULL AFTER `stale_at`,
  ADD COLUMN IF NOT EXISTS `rebuild_status` VARCHAR(20) NOT NULL DEFAULT 'ready' AFTER `stale_reason`,
  ADD COLUMN IF NOT EXISTS `revision_reason` TEXT NULL AFTER `rebuild_status`,
  ADD COLUMN IF NOT EXISTS `updated_at` DATETIME NULL AFTER `revision_reason`;

ALTER TABLE `broadsheet_snapshots` ADD INDEX IF NOT EXISTS `idx_snapshot_scope_ver` (`scope_hash`, `version`);
ALTER TABLE `broadsheet_snapshots` ADD INDEX IF NOT EXISTS `idx_snapshot_scope_status_stale` (`scope_hash`, `status`, `stale_at`);
ALTER TABLE `broadsheet_snapshots` ADD INDEX IF NOT EXISTS `idx_snapshot_prev` (`previous_snapshot_id`);
ALTER TABLE `broadsheet_snapshots` ADD INDEX IF NOT EXISTS `idx_snapshot_supersedes` (`supersedes_snapshot_id`);
ALTER TABLE `broadsheet_snapshots` ADD INDEX IF NOT EXISTS `idx_snapshot_prog_contact_basis` (`programme_id`, `contact_number`, `basis`);

-- 2. Create broadsheet_snapshot_students
CREATE TABLE IF NOT EXISTS `broadsheet_snapshot_students` (
  `id` CHAR(36) NOT NULL,
  `snapshot_id` CHAR(36) NOT NULL,
  `student_id` CHAR(36) NOT NULL,
  `matric_number_snapshot` VARCHAR(50) NULL,
  `full_name_snapshot` VARCHAR(255) NULL,
  `current_registered_credits` INT NOT NULL DEFAULT 0,
  `current_earned_credits` INT NOT NULL DEFAULT 0,
  `current_quality_points` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `current_gpa` DECIMAL(4,2) NOT NULL DEFAULT 0.00,
  `previous_registered_credits` INT NOT NULL DEFAULT 0,
  `previous_earned_credits` INT NOT NULL DEFAULT 0,
  `previous_quality_points` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `previous_cgpa` DECIMAL(4,2) NOT NULL DEFAULT 0.00,
  `cumulative_registered_credits` INT NOT NULL DEFAULT 0,
  `cumulative_earned_credits` INT NOT NULL DEFAULT 0,
  `cumulative_quality_points` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `cumulative_cgpa` DECIMAL(4,2) NOT NULL DEFAULT 0.00,
  `academic_standing` VARCHAR(50) NULL,
  `remark` VARCHAR(255) NULL,
  `is_complete` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_snapshot_student` (`snapshot_id`, `student_id`),
  INDEX `idx_student_snapshot` (`student_id`, `snapshot_id`),
  INDEX `idx_snapshot_complete` (`snapshot_id`, `is_complete`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create broadsheet_snapshot_invalidations
CREATE TABLE IF NOT EXISTS `broadsheet_snapshot_invalidations` (
  `id` CHAR(36) NOT NULL,
  `snapshot_id` CHAR(36) NOT NULL,
  `source_type` VARCHAR(50) NOT NULL,
  `source_id` VARCHAR(50) NULL,
  `reason` VARCHAR(255) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `created_by` CHAR(36) NULL,
  `created_at` DATETIME NOT NULL,
  `processed_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_invalidation_status` (`status`),
  INDEX `idx_invalidation_snapshot` (`snapshot_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

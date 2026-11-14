-- Migration 019: Registration soft-drop audit columns, registration source, and normalized types
-- Safe, idempotent migration for course_registration_items, course_registrations, and credit_load_rules

-- 1. Ensure DYNAMIC row format to eliminate InnoDB 8126-byte inline row size limits
ALTER TABLE `course_registration_items` ROW_FORMAT=DYNAMIC;

-- 2. Soft-drop audit columns on course_registration_items
-- Note: drop_reason uses TEXT to store off-page and prevent #1118 row size errors
ALTER TABLE `course_registration_items`
  ADD COLUMN IF NOT EXISTS `dropped_at` DATETIME NULL AFTER `status`,
  ADD COLUMN IF NOT EXISTS `dropped_by` VARCHAR(36) NULL AFTER `dropped_at`,
  ADD COLUMN IF NOT EXISTS `drop_reason` TEXT NULL AFTER `dropped_by`;

-- 3. Ensure DYNAMIC row format and add source tracking to course_registrations (student, admin, legacy)
ALTER TABLE `course_registrations` ROW_FORMAT=DYNAMIC;

ALTER TABLE `course_registrations`
  ADD COLUMN IF NOT EXISTS `source` VARCHAR(20) NOT NULL DEFAULT 'student' AFTER `status`;

-- 4. Credit load rules table (for BMAS min/max per programme & level)
CREATE TABLE IF NOT EXISTS `credit_load_rules` (
  `id` CHAR(36) NOT NULL,
  `programme_id` CHAR(36) NOT NULL,
  `level` VARCHAR(30) NOT NULL,
  `semester_id` CHAR(36) NULL,
  `min_credits` INT NOT NULL DEFAULT 15,
  `max_credits` INT NOT NULL DEFAULT 24,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_prog_level_sem` (`programme_id`, `level`, `semester_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Normalize registration_type to lowercase (core, elective, carryover)
UPDATE `course_registration_items`
SET `registration_type` = LOWER(`registration_type`)
WHERE `registration_type` IS NOT NULL;

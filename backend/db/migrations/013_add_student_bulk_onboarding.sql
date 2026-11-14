-- Bulk onboarding metadata and student-completed profile fields.

ALTER TABLE `users`
  ADD COLUMN `dob` DATE NULL,
  ADD COLUMN `gender` VARCHAR(20) NULL,
  ADD COLUMN `address` TEXT NULL,
  ADD COLUMN `state` VARCHAR(100) NULL,
  ADD COLUMN `lga` VARCHAR(100) NULL,
  ADD COLUMN `guardian_name` VARCHAR(200) NULL,
  ADD COLUMN `guardian_phone` VARCHAR(50) NULL,
  ADD COLUMN `guardian_relationship` VARCHAR(100) NULL,
  ADD COLUMN `guardian_address` TEXT NULL,
  ADD COLUMN `next_of_kin` VARCHAR(200) NULL,
  ADD COLUMN `next_of_kin_phone` VARCHAR(50) NULL;

ALTER TABLE `students`
  ADD COLUMN `session_name` VARCHAR(100) NULL,
  ADD COLUMN `entry_mode` VARCHAR(50) NULL,
  ADD COLUMN `onboarding_source` VARCHAR(50) NOT NULL DEFAULT 'application',
  ADD COLUMN `profile_completion_status` VARCHAR(30) NOT NULL DEFAULT 'complete',
  ADD COLUMN `account_update_required` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN `imported_at` DATETIME NULL,
  ADD COLUMN `imported_by` CHAR(36) NULL;

CREATE INDEX `idx_students_onboarding_source` ON `students` (`onboarding_source`);
CREATE INDEX `idx_students_profile_completion` ON `students` (`profile_completion_status`, `account_update_required`);

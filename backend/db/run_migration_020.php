<?php
/**
 * Runner for Migration 020
 */

$mysqli = new mysqli('127.0.0.1', 'aacasorg_main', 'Zb@+3C7]0Z;7RPcQ', 'aacasorg_main');
if ($mysqli->connect_error) {
    // Fall back to root if needed
    $mysqli = new mysqli('127.0.0.1', 'root', '', 'aacasorg_main');
}
if ($mysqli->connect_error) {
    die("DB connection failed: " . $mysqli->connect_error . "\n");
}

echo "Applying Migration 020 to aacasorg_main...\n";

// Helper for column
function ensure_column($mysqli, $table, $col, $def) {
    $r = $mysqli->query("SHOW COLUMNS FROM `$table` LIKE '$col'");
    if ($r && $r->num_rows == 0) {
        $sql = "ALTER TABLE `$table` ADD COLUMN `$col` $def";
        if ($mysqli->query($sql)) {
            echo " - Added `$table`.`$col`\n";
        } else {
            echo " - Error adding `$table`.`$col`: " . $mysqli->error . "\n";
        }
    } else {
        echo " - `$table`.`$col` already exists (ok)\n";
    }
}

// Helper for index
function ensure_index($mysqli, $table, $idx, $def) {
    $r = $mysqli->query("SHOW INDEX FROM `$table` WHERE Key_name = '$idx'");
    if ($r && $r->num_rows == 0) {
        $sql = "ALTER TABLE `$table` ADD INDEX `$idx` $def";
        if ($mysqli->query($sql)) {
            echo " - Added index `$idx` on `$table`\n";
        } else {
            echo " - Error adding index `$idx`: " . $mysqli->error . "\n";
        }
    } else {
        echo " - Index `$idx` on `$table` already exists (ok)\n";
    }
}

// 1. Columns on result_attempts
ensure_column($mysqli, 'result_attempts', 'result_state', "VARCHAR(20) NOT NULL DEFAULT 'pending' AFTER `status`");
ensure_column($mysqli, 'result_attempts', 'credit_units_snapshot', "TINYINT NULL AFTER `result_state`");
ensure_column($mysqli, 'result_attempts', 'registration_type_snapshot', "VARCHAR(20) NULL AFTER `credit_units_snapshot`");
ensure_column($mysqli, 'result_attempts', 'contact_number', "TINYINT NULL AFTER `registration_type_snapshot`");
ensure_column($mysqli, 'result_attempts', 'grading_scheme_id', "CHAR(36) NULL AFTER `contact_number`");

ensure_index($mysqli, 'result_attempts', 'idx_attempt_student_batch', '(`student_id`, `batch_id`)');
ensure_index($mysqli, 'result_attempts', 'idx_attempt_batch_state', '(`batch_id`, `result_state`)');

// 2. Columns on result_batches
ensure_column($mysqli, 'result_batches', 'contact_number', "TINYINT NULL AFTER `level`");
ensure_column($mysqli, 'result_batches', 'session_name_snapshot', "VARCHAR(30) NULL AFTER `session_id`");

ensure_index($mysqli, 'result_batches', 'idx_rb_scope_status', '(`session_id`, `semester_id`, `programme_id`, `status`)');

// 3. New Tables
$mysqli->query("
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

$mysqli->query("
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

$mysqli->query("
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

$mysqli->query("
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

// 4. Default Academic Settings
$mysqli->query("
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
('set-class-bands', 'classification_bands', '[{\"label\": \"Distinction\", \"min\": 4.50, \"max\": 5.00}, {\"label\": \"Credit\", \"min\": 3.50, \"max\": 4.49}, {\"label\": \"Merit\", \"min\": 2.50, \"max\": 3.49}, {\"label\": \"Pass\", \"min\": 1.50, \"max\": 2.49}, {\"label\": \"Fail\", \"min\": 0.00, \"max\": 1.49}]', NOW())
");

// 5. Backfill result_state
$mysqli->query("
UPDATE `result_attempts`
SET `result_state` = CASE
    WHEN `grade` = 'ABS' THEN 'absent'
    WHEN `total_score` IS NOT NULL OR (`grade` IS NOT NULL AND `grade` NOT IN ('', '-', '—')) THEN 'entered'
    ELSE 'pending'
END
WHERE `result_state` IS NULL OR `result_state` = 'pending'
");

// 6. Backfill credit_units_snapshot
$mysqli->query("
UPDATE `result_attempts` a
JOIN `result_batches` b ON b.id = a.batch_id
JOIN `courses` c ON c.id = b.course_id
SET a.`credit_units_snapshot` = c.`credit_units`
WHERE a.`credit_units_snapshot` IS NULL
");

echo "Migration 020 completed successfully!\n";

-- 1. Alter course_offerings to add status
ALTER TABLE `course_offerings` 
ADD COLUMN IF NOT EXISTS `status` VARCHAR(20) NOT NULL DEFAULT 'open';

-- 2. Course Registration Settings
CREATE TABLE IF NOT EXISTS `course_registration_settings` (
  `id` CHAR(36) NOT NULL,
  `session_id` CHAR(36) NOT NULL,
  `semester_id` CHAR(36) NOT NULL,
  `opens_at` DATETIME NULL,
  `closes_at` DATETIME NULL,
  `late_closes_at` DATETIME NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'closed',
  `require_approval` TINYINT(1) NOT NULL DEFAULT 1,
  `require_financial_clearance` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_session_semester` (`session_id`, `semester_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Programme Level Credit Rules
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

-- 4. Course Registrations
CREATE TABLE IF NOT EXISTS `course_registrations` (
  `id` CHAR(36) NOT NULL,
  `student_id` CHAR(36) NOT NULL,
  `session_id` CHAR(36) NOT NULL,
  `semester_id` CHAR(36) NOT NULL,
  `programme_id` CHAR(36) NOT NULL,
  `level` VARCHAR(30) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
  `total_credits` INT NOT NULL DEFAULT 0,
  `submitted_at` DATETIME NULL,
  `approved_at` DATETIME NULL,
  `approved_by` CHAR(36) NULL,
  `returned_at` DATETIME NULL,
  `returned_by` CHAR(36) NULL,
  `return_reason` TEXT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_student_session_sem` (`student_id`, `session_id`, `semester_id`),
  KEY `idx_prog` (`programme_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Course Registration Items
CREATE TABLE IF NOT EXISTS `course_registration_items` (
  `id` CHAR(36) NOT NULL,
  `registration_id` CHAR(36) NOT NULL,
  `course_id` CHAR(36) NOT NULL,
  `course_offering_id` CHAR(36) NULL,
  `registration_type` VARCHAR(20) NOT NULL DEFAULT 'core',
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_reg_course` (`registration_id`, `course_id`),
  KEY `idx_reg` (`registration_id`),
  KEY `idx_course` (`course_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Registration Amendments (Audit trail)
CREATE TABLE IF NOT EXISTS `course_registration_amendments` (
  `id` CHAR(36) NOT NULL,
  `registration_id` CHAR(36) NOT NULL,
  `actor_id` CHAR(36) NOT NULL,
  `action_type` VARCHAR(50) NOT NULL,
  `course_id` CHAR(36) NULL,
  `old_value` TEXT NULL,
  `new_value` TEXT NULL,
  `reason` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_reg_audit` (`registration_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

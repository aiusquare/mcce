-- Session-owned fee settings
--
-- Run this once in phpMyAdmin. It is additive and safe to rerun.
-- No foreign key is added yet: apply foreign keys only after the session-data
-- reconciliation has no orphan references.

CREATE TABLE IF NOT EXISTS `session_fee_settings` (
  `id` CHAR(36) NOT NULL,
  `session_id` CHAR(36) NOT NULL,
  `application_fee` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `acceptance_fee` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `effective_from` DATETIME NULL,
  `effective_to` DATETIME NULL,
  `created_at` DATETIME NOT NULL,
  `created_by` CHAR(36) NULL,
  `updated_at` DATETIME NULL,
  `updated_by` CHAR(36) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_session_fee_settings_session` (`session_id`),
  KEY `idx_session_fee_settings_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'session_fee_settings'
  ) AS session_fee_settings_ready;

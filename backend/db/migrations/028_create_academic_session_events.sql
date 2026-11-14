-- Append-only academic-session lifecycle audit log
--
-- Run in phpMyAdmin. It is additive and safe to rerun. The table deliberately
-- has no foreign keys yet so historical session correction/deletion can be
-- audited without blocking reconciliation.

CREATE TABLE IF NOT EXISTS `academic_session_events` (
  `id` CHAR(36) NOT NULL,
  `session_id` CHAR(36) NOT NULL,
  `event_type` VARCHAR(50) NOT NULL,
  `reason` VARCHAR(500) NULL,
  `actor_id` CHAR(36) NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_academic_session_events_session_created` (`session_id`, `created_at`),
  KEY `idx_academic_session_events_actor_created` (`actor_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'academic_session_events'
) AS academic_session_events_ready;

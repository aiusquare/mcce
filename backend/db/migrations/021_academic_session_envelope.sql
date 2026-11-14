-- =============================================================================
-- Migration 021: Academic Session Envelope & Cohort Disambiguation
-- Target Database: mcceorgn_main / aacasorg_main
-- Fully idempotent schema migration for MySQL 5.7+ / MariaDB 10.3+
-- Zero-downtime, additive only, 100% backward-compatible
-- =============================================================================

-- 1. Ensure DYNAMIC row format on affected core tables
ALTER TABLE `course_registrations` ROW_FORMAT=DYNAMIC;
ALTER TABLE `result_batches` ROW_FORMAT=DYNAMIC;
ALTER TABLE `students` ROW_FORMAT=DYNAMIC;

-- 2. Enrich `course_registrations` with explicit Academic Session Envelope and Entry Cohort columns
-- Keeps legacy `session_id` intact for seamless dual-read fallback during transition.
ALTER TABLE `course_registrations`
  ADD COLUMN IF NOT EXISTS `academic_session_id` CHAR(36) NULL AFTER `student_id`,
  ADD COLUMN IF NOT EXISTS `entry_session_id` CHAR(36) NULL AFTER `academic_session_id`;

ALTER TABLE `course_registrations`
  ADD INDEX IF NOT EXISTS `idx_cr_academic_envelope` (`academic_session_id`, `semester_id`),
  ADD INDEX IF NOT EXISTS `idx_cr_entry_cohort` (`entry_session_id`);

-- 3. Enrich `result_batches` with explicit Academic Session Envelope and Target Cohort columns
-- Keeps legacy `session_id` intact for seamless dual-read fallback during transition.
ALTER TABLE `result_batches`
  ADD COLUMN IF NOT EXISTS `academic_session_id` CHAR(36) NULL AFTER `session_id`,
  ADD COLUMN IF NOT EXISTS `cohort_session_id` CHAR(36) NULL AFTER `academic_session_id`;

ALTER TABLE `result_batches`
  ADD INDEX IF NOT EXISTS `idx_rb_academic_envelope` (`academic_session_id`, `semester_id`, `course_id`),
  ADD INDEX IF NOT EXISTS `idx_rb_cohort` (`cohort_session_id`);

-- 4. Enrich `students` with direct foreign key `entry_session_id`
-- Anchors student's immutable entry cohort alongside string `session_name`.
ALTER TABLE `students`
  ADD COLUMN IF NOT EXISTS `entry_session_id` CHAR(36) NULL AFTER `admission_id`;

ALTER TABLE `students`
  ADD INDEX IF NOT EXISTS `idx_students_entry_session` (`entry_session_id`);


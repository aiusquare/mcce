-- =============================================================================
-- Reset Script: Wipe All Result Batches, Scores, Broadsheets & Course Registrations
-- Target Database: mcceorgn_main / aacasorg_main (MySQL / MariaDB)
--
-- Uses DELETE FROM in strict child-to-parent dependency order so MySQL/MariaDB
-- never raises #1701 (Cannot truncate a table referenced in a foreign key constraint).
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. Wipe Child Audit & Correction Tables First
-- -----------------------------------------------------------------------------
DELETE FROM `carryover_corrections`;
DELETE FROM `result_amendments`;
DELETE FROM `broadsheet_approvals`;
DELETE FROM `broadsheet_audit_log`;
DELETE FROM `broadsheet_snapshots`;
DELETE FROM `course_registration_amendments`;

-- -----------------------------------------------------------------------------
-- 2. Wipe Child Items & Attempts
-- -----------------------------------------------------------------------------
DELETE FROM `course_registration_items`;
DELETE FROM `result_attempts`;

-- -----------------------------------------------------------------------------
-- 3. Wipe Parent Envelopes & Batches
-- -----------------------------------------------------------------------------
DELETE FROM `result_batches`;
DELETE FROM `course_registrations`;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- Verification Query (All counts should be 0)
-- =============================================================================
SELECT 'result_batches' AS table_name, COUNT(*) AS remaining_rows FROM `result_batches`
UNION ALL
SELECT 'result_attempts', COUNT(*) FROM `result_attempts`
UNION ALL
SELECT 'carryover_corrections', COUNT(*) FROM `carryover_corrections`
UNION ALL
SELECT 'broadsheet_snapshots', COUNT(*) FROM `broadsheet_snapshots`
UNION ALL
SELECT 'course_registrations', COUNT(*) FROM `course_registrations`
UNION ALL
SELECT 'course_registration_items', COUNT(*) FROM `course_registration_items`;

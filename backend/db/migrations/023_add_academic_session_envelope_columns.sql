-- Academic-session envelope schema upgrade
--
-- Run this file ONCE against the application database in phpMyAdmin/cPanel.
-- It is safe to rerun: each statement checks whether the target exists first.
--
-- This script only adds nullable columns and indexes. It DOES NOT backfill
-- historical data, add foreign keys, or delete any records.
--
-- Requirements: MySQL/MariaDB account with ALTER and INDEX privileges.
-- Back up the database before running any schema change.

SET @session_schema := DATABASE();

-- students.entry_session_id
SET @ddl := (
    SELECT IF(
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = @session_schema AND table_name = 'students')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @session_schema AND table_name = 'students' AND column_name = 'entry_session_id'),
        'ALTER TABLE `students` ADD COLUMN `entry_session_id` CHAR(36) NULL AFTER `admission_id`',
        'SELECT ''students.entry_session_id already exists or students table is absent'' AS message'
    )
);
PREPARE session_stmt FROM @ddl;
EXECUTE session_stmt;
DEALLOCATE PREPARE session_stmt;

-- course_registrations.academic_session_id
SET @ddl := (
    SELECT IF(
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = @session_schema AND table_name = 'course_registrations')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @session_schema AND table_name = 'course_registrations' AND column_name = 'academic_session_id'),
        'ALTER TABLE `course_registrations` ADD COLUMN `academic_session_id` CHAR(36) NULL AFTER `student_id`',
        'SELECT ''course_registrations.academic_session_id already exists or table is absent'' AS message'
    )
);
PREPARE session_stmt FROM @ddl;
EXECUTE session_stmt;
DEALLOCATE PREPARE session_stmt;

-- course_registrations.entry_session_id
SET @ddl := (
    SELECT IF(
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = @session_schema AND table_name = 'course_registrations')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @session_schema AND table_name = 'course_registrations' AND column_name = 'entry_session_id'),
        'ALTER TABLE `course_registrations` ADD COLUMN `entry_session_id` CHAR(36) NULL AFTER `academic_session_id`',
        'SELECT ''course_registrations.entry_session_id already exists or table is absent'' AS message'
    )
);
PREPARE session_stmt FROM @ddl;
EXECUTE session_stmt;
DEALLOCATE PREPARE session_stmt;

-- result_batches.academic_session_id
SET @ddl := (
    SELECT IF(
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = @session_schema AND table_name = 'result_batches')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @session_schema AND table_name = 'result_batches' AND column_name = 'academic_session_id'),
        'ALTER TABLE `result_batches` ADD COLUMN `academic_session_id` CHAR(36) NULL AFTER `session_id`',
        'SELECT ''result_batches.academic_session_id already exists or table is absent'' AS message'
    )
);
PREPARE session_stmt FROM @ddl;
EXECUTE session_stmt;
DEALLOCATE PREPARE session_stmt;

-- result_batches.cohort_session_id
SET @ddl := (
    SELECT IF(
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = @session_schema AND table_name = 'result_batches')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @session_schema AND table_name = 'result_batches' AND column_name = 'cohort_session_id'),
        'ALTER TABLE `result_batches` ADD COLUMN `cohort_session_id` CHAR(36) NULL AFTER `academic_session_id`',
        'SELECT ''result_batches.cohort_session_id already exists or table is absent'' AS message'
    )
);
PREPARE session_stmt FROM @ddl;
EXECUTE session_stmt;
DEALLOCATE PREPARE session_stmt;

-- Supporting indexes. These make the new canonical session filters efficient.
SET @ddl := (
    SELECT IF(
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = @session_schema AND table_name = 'students')
        AND NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = @session_schema AND table_name = 'students' AND index_name = 'idx_students_entry_session'),
        'CREATE INDEX `idx_students_entry_session` ON `students` (`entry_session_id`)',
        'SELECT ''idx_students_entry_session already exists or students table is absent'' AS message'
    )
);
PREPARE session_stmt FROM @ddl;
EXECUTE session_stmt;
DEALLOCATE PREPARE session_stmt;

SET @ddl := (
    SELECT IF(
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = @session_schema AND table_name = 'course_registrations')
        AND NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = @session_schema AND table_name = 'course_registrations' AND index_name = 'idx_cr_academic_envelope'),
        'CREATE INDEX `idx_cr_academic_envelope` ON `course_registrations` (`academic_session_id`, `semester_id`)',
        'SELECT ''idx_cr_academic_envelope already exists or course_registrations table is absent'' AS message'
    )
);
PREPARE session_stmt FROM @ddl;
EXECUTE session_stmt;
DEALLOCATE PREPARE session_stmt;

SET @ddl := (
    SELECT IF(
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = @session_schema AND table_name = 'course_registrations')
        AND NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = @session_schema AND table_name = 'course_registrations' AND index_name = 'idx_cr_entry_cohort'),
        'CREATE INDEX `idx_cr_entry_cohort` ON `course_registrations` (`entry_session_id`)',
        'SELECT ''idx_cr_entry_cohort already exists or course_registrations table is absent'' AS message'
    )
);
PREPARE session_stmt FROM @ddl;
EXECUTE session_stmt;
DEALLOCATE PREPARE session_stmt;

SET @ddl := (
    SELECT IF(
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = @session_schema AND table_name = 'result_batches')
        AND NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = @session_schema AND table_name = 'result_batches' AND index_name = 'idx_rb_academic_envelope'),
        'CREATE INDEX `idx_rb_academic_envelope` ON `result_batches` (`academic_session_id`, `semester_id`, `course_id`)',
        'SELECT ''idx_rb_academic_envelope already exists or result_batches table is absent'' AS message'
    )
);
PREPARE session_stmt FROM @ddl;
EXECUTE session_stmt;
DEALLOCATE PREPARE session_stmt;

SET @ddl := (
    SELECT IF(
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = @session_schema AND table_name = 'result_batches')
        AND NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = @session_schema AND table_name = 'result_batches' AND index_name = 'idx_rb_cohort'),
        'CREATE INDEX `idx_rb_cohort` ON `result_batches` (`cohort_session_id`)',
        'SELECT ''idx_rb_cohort already exists or result_batches table is absent'' AS message'
    )
);
PREPARE session_stmt FROM @ddl;
EXECUTE session_stmt;
DEALLOCATE PREPARE session_stmt;

-- Post-run verification. All listed values should be 1.
SELECT
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @session_schema AND table_name = 'students' AND column_name = 'entry_session_id') AS students_entry_session_ready,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @session_schema AND table_name = 'course_registrations' AND column_name = 'academic_session_id') AS registrations_academic_session_ready,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @session_schema AND table_name = 'course_registrations' AND column_name = 'entry_session_id') AS registrations_entry_session_ready,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @session_schema AND table_name = 'result_batches' AND column_name = 'academic_session_id') AS batches_academic_session_ready,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @session_schema AND table_name = 'result_batches' AND column_name = 'cohort_session_id') AS batches_cohort_session_ready;

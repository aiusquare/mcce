-- Academic-session archival metadata
--
-- Run in phpMyAdmin. This script only adds nullable archival/audit columns;
-- it does not archive, delete, or rename any existing session.

SET @session_schema := DATABASE();

SET @ddl := (
    SELECT IF(
        NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @session_schema AND table_name = 'academic_sessions' AND column_name = 'archived_at'),
        'ALTER TABLE `academic_sessions` ADD COLUMN `archived_at` DATETIME NULL',
        'SELECT ''academic_sessions.archived_at already exists'' AS message'
    )
);
PREPARE session_stmt FROM @ddl;
EXECUTE session_stmt;
DEALLOCATE PREPARE session_stmt;

SET @ddl := (
    SELECT IF(
        NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @session_schema AND table_name = 'academic_sessions' AND column_name = 'archived_by'),
        'ALTER TABLE `academic_sessions` ADD COLUMN `archived_by` CHAR(36) NULL',
        'SELECT ''academic_sessions.archived_by already exists'' AS message'
    )
);
PREPARE session_stmt FROM @ddl;
EXECUTE session_stmt;
DEALLOCATE PREPARE session_stmt;

SET @ddl := (
    SELECT IF(
        NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @session_schema AND table_name = 'academic_sessions' AND column_name = 'archive_reason'),
        'ALTER TABLE `academic_sessions` ADD COLUMN `archive_reason` VARCHAR(500) NULL',
        'SELECT ''academic_sessions.archive_reason already exists'' AS message'
    )
);
PREPARE session_stmt FROM @ddl;
EXECUTE session_stmt;
DEALLOCATE PREPARE session_stmt;

SELECT
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @session_schema AND table_name = 'academic_sessions' AND column_name = 'archived_at') AS archived_at_ready,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @session_schema AND table_name = 'academic_sessions' AND column_name = 'archived_by') AS archived_by_ready,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @session_schema AND table_name = 'academic_sessions' AND column_name = 'archive_reason') AS archive_reason_ready;

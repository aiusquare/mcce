-- Enforce one active academic session
--
-- Run this once in phpMyAdmin AFTER resolving any duplicate active sessions
-- reported by 024_audit_academic_session_envelopes.sql.
--
-- The script adds a generated guard column and a unique index. MySQL/MariaDB
-- permit multiple NULLs in a unique index, but only one row can have guard=1.
-- It therefore permits any number of inactive sessions and at most one active
-- session. No business records are updated or deleted.
--
-- Requirements: MySQL 5.7+ or MariaDB 10.3+, with ALTER and INDEX privileges.
-- Back up the database before applying it.

SET @session_schema := DATABASE();
SET @active_session_count := (
    SELECT COUNT(*)
    FROM academic_sessions
    WHERE is_active = 1
);

-- Preflight: this must be 0 or 1. If it is greater than 1, resolve the
-- duplicate active rows deliberately before rerunning this file.
SELECT @active_session_count AS active_session_count_before_enforcement;

-- Add a generated value of 1 only for the active row. The statement is
-- skipped (with an explanatory result) if duplicates still exist.
SET @ddl := (
    SELECT IF(
        NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = @session_schema
              AND table_name = 'academic_sessions'
              AND column_name = 'active_session_guard'
        ),
        IF(
            @active_session_count <= 1,
            'ALTER TABLE `academic_sessions` ADD COLUMN `active_session_guard` TINYINT GENERATED ALWAYS AS (CASE WHEN `is_active` = 1 THEN 1 ELSE NULL END) STORED',
            'SELECT ''Not applied: resolve duplicate active sessions before adding active_session_guard.'' AS message'
        ),
        'SELECT ''active_session_guard already exists.'' AS message'
    )
);
PREPARE session_stmt FROM @ddl;
EXECUTE session_stmt;
DEALLOCATE PREPARE session_stmt;

-- Add the unique constraint only when the generated column exists and there
-- is no duplicate active data.
SET @ddl := (
    SELECT IF(
        EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = @session_schema
              AND table_name = 'academic_sessions'
              AND column_name = 'active_session_guard'
        )
        AND NOT EXISTS (
            SELECT 1 FROM information_schema.statistics
            WHERE table_schema = @session_schema
              AND table_name = 'academic_sessions'
              AND index_name = 'uq_academic_sessions_one_active'
        )
        AND @active_session_count <= 1,
        'CREATE UNIQUE INDEX `uq_academic_sessions_one_active` ON `academic_sessions` (`active_session_guard`)',
        'SELECT ''Unique active-session constraint already exists or could not be applied; inspect the preflight count.'' AS message'
    )
);
PREPARE session_stmt FROM @ddl;
EXECUTE session_stmt;
DEALLOCATE PREPARE session_stmt;

-- Verification: both readiness values must be 1 and the active count no
-- greater than 1. The unique index prevents future concurrent duplicates.
SELECT
    (SELECT COUNT(*) FROM academic_sessions WHERE is_active = 1) AS active_session_count,
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = @session_schema
          AND table_name = 'academic_sessions'
          AND column_name = 'active_session_guard'
    ) AS guard_column_ready,
    EXISTS (
        SELECT 1 FROM information_schema.statistics
        WHERE table_schema = @session_schema
          AND table_name = 'academic_sessions'
          AND index_name = 'uq_academic_sessions_one_active'
    ) AS one_active_constraint_ready;

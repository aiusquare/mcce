-- =============================================================================
-- Migration 034: Stabilize Student Levels System-Wide by Entry Session & Active Session
-- =============================================================================

-- 0. Ensure required columns exist on students and admissions (MariaDB idempotent)
ALTER TABLE `students`
  ADD COLUMN IF NOT EXISTS `entry_session_id` CHAR(36) NULL AFTER `admission_id`,
  ADD COLUMN IF NOT EXISTS `session_name` VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS `entry_mode` VARCHAR(50) NULL;

ALTER TABLE `admissions`
  ADD COLUMN IF NOT EXISTS `session_id` CHAR(36) NULL AFTER `application_id`,
  ADD COLUMN IF NOT EXISTS `mode_of_entry` VARCHAR(50) NULL AFTER `matric_number`;

-- 1. Backfill missing entry_session_id and session_name on students
UPDATE `students` s
LEFT JOIN `admissions` adm ON adm.id = s.admission_id
LEFT JOIN `applications` app ON app.id = adm.application_id
LEFT JOIN `academic_sessions` es ON (
    es.id = COALESCE(
        NULLIF(s.entry_session_id, ''),
        NULLIF(adm.session_id, ''),
        NULLIF(app.session_id, '')
    )
    OR es.name = NULLIF(TRIM(s.session_name), '')
)
SET
    s.entry_session_id = COALESCE(NULLIF(s.entry_session_id, ''), es.id),
    s.session_name = COALESCE(NULLIF(TRIM(s.session_name), ''), es.name)
WHERE es.id IS NOT NULL
  AND (
    s.session_name IS NULL OR TRIM(s.session_name) = ''
    OR s.entry_session_id IS NULL OR s.entry_session_id = ''
  );

-- 2. Capture the start year of the currently active session (e.g. 2025 for 2025/2026)
SET @active_year = COALESCE(
    (SELECT CAST(SUBSTRING(name, 1, 4) AS SIGNED)
     FROM `academic_sessions`
     WHERE is_active = 1
     ORDER BY start_date DESC, name DESC
     LIMIT 1),
    2025
);

-- 3. Normalize entry_mode ('Fresh' vs 'Direct Entry') on students
UPDATE `students` s
LEFT JOIN `admissions` adm ON adm.id = s.admission_id
SET s.entry_mode = CASE
    WHEN LOWER(TRIM(COALESCE(adm.mode_of_entry, ''))) IN ('direct-entry', 'direct entry', 'direct_entry', 'de') THEN 'Direct Entry'
    WHEN LOWER(TRIM(COALESCE(adm.mode_of_entry, ''))) IN ('fresh', 'utme', 'regular', '100') THEN 'Fresh'
    WHEN LOWER(TRIM(COALESCE(s.entry_mode, ''))) IN ('fresh', 'utme', 'regular', '100') THEN 'Fresh'
    WHEN LOWER(TRIM(COALESCE(adm.level, ''))) IN ('contact 1', 'contact1', 'contact-one', 'contact one', '100', '100 level', 'year 1', '1') THEN 'Fresh'
    WHEN LOWER(TRIM(COALESCE(adm.level, ''))) IN ('contact 2', 'contact2', 'contact-two', 'contact two', '200', '200 level', 'year 2', '2') THEN 'Direct Entry'
    WHEN TRIM(COALESCE(adm.matric_number, '')) REGEXP '/[0-9]{2}/10[0-9]{3}$' THEN 'Fresh'
    WHEN TRIM(COALESCE(adm.matric_number, '')) REGEXP '/[0-9]{2}/20[0-9]{3}$' THEN 'Direct Entry'
    WHEN LOWER(TRIM(COALESCE(s.entry_mode, ''))) IN ('direct-entry', 'direct entry', 'direct_entry', 'de') THEN 'Direct Entry'
    ELSE 'Fresh'
END;

-- 4. Recalculate current_level from (Session of Entry, Entry Mode, Active Session)
--    Fresh base = 1, Direct Entry base = 2
--    Offset = GREATEST(0, @active_year - entry_start_year)
UPDATE `students` s
LEFT JOIN `admissions` adm ON adm.id = s.admission_id
LEFT JOIN `programmes` p ON p.id = s.programme_id
LEFT JOIN `academic_sessions` es ON (es.id = s.entry_session_id OR es.id = adm.session_id)
SET s.current_level = CASE
    WHEN LOWER(TRIM(COALESCE(p.programme_structure, 'contact'))) IN ('contact', 'contact_based')
    THEN CONCAT(
        'Contact ',
        LEAST(
            6,
            GREATEST(
                1,
                (CASE WHEN s.entry_mode = 'Direct Entry' THEN 2 ELSE 1 END)
                + GREATEST(
                    0,
                    @active_year - CAST(
                        SUBSTRING(COALESCE(NULLIF(TRIM(s.session_name), ''), es.name, '2021/2022'), 1, 4)
                        AS SIGNED
                    )
                )
            )
        )
    )
    ELSE CAST(
        LEAST(
            COALESCE(NULLIF(p.duration_years, 0), 4),
            GREATEST(
                1,
                (CASE WHEN s.entry_mode = 'Direct Entry' THEN 2 ELSE 1 END)
                + GREATEST(
                    0,
                    @active_year - CAST(
                        SUBSTRING(COALESCE(NULLIF(TRIM(s.session_name), ''), es.name, '2021/2022'), 1, 4)
                        AS SIGNED
                    )
                )
            )
        ) * 100 AS CHAR
    )
END;

-- 5. Sync canonical admission level ('Contact 1' / 'Contact 2' or '100' / '200') on admissions
UPDATE `admissions` adm
INNER JOIN `students` s ON s.admission_id = adm.id
LEFT JOIN `programmes` p ON p.id = s.programme_id
SET
    adm.level = CASE
        WHEN LOWER(TRIM(COALESCE(p.programme_structure, 'contact'))) IN ('contact', 'contact_based')
        THEN CASE WHEN s.entry_mode = 'Direct Entry' THEN 'Contact 2' ELSE 'Contact 1' END
        ELSE CASE WHEN s.entry_mode = 'Direct Entry' THEN '200' ELSE '100' END
    END,
    adm.mode_of_entry = s.entry_mode;

-- 6. Verification summary by Session of Entry, Entry Mode, and Current Level
SELECT
    s.session_name AS session_of_entry,
    s.entry_mode,
    s.current_level,
    COUNT(*) AS student_count
FROM `students` s
GROUP BY s.session_name, s.entry_mode, s.current_level
ORDER BY s.session_name ASC, s.entry_mode ASC, s.current_level ASC;

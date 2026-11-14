-- =============================================================================
-- MASLAHA PRODUCTION DATABASE CLEANUP & DEDUPLICATION SUITE (MARIADB NATIVE)
-- Target Database: mcceorgn_main
-- Uses MariaDB ROW_NUMBER() window functions + pure PRIMARY KEY (id = id) joins
-- so column types/collations match 100% natively and every step runs in < 0.2s.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- BLOCK 1: Normalize `level` and `semester_id` on `course_registrations` & `result_batches`
-- -----------------------------------------------------------------------------

UPDATE course_registrations cr
INNER JOIN semesters sem ON sem.id = cr.semester_id
SET cr.level = sem.name
WHERE sem.name LIKE 'Contact %'
  AND (cr.level IS NULL OR cr.level != sem.name);

UPDATE course_registrations cr
INNER JOIN semesters sem_curr ON sem_curr.id = cr.semester_id
INNER JOIN semesters sem_target ON sem_target.name = cr.level
SET cr.semester_id = sem_target.id
WHERE sem_curr.name NOT LIKE 'Contact %'
  AND cr.level LIKE 'Contact %'
  AND cr.semester_id != sem_target.id;

UPDATE result_batches rb
INNER JOIN semesters sem ON sem.id = rb.semester_id
SET rb.level = sem.name
WHERE sem.name LIKE 'Contact %'
  AND (rb.level IS NULL OR rb.level = '' OR rb.level != sem.name);

-- -----------------------------------------------------------------------------
-- BLOCK 2: Merge Duplicate `result_batches` & Deduplicate `result_attempts`
-- -----------------------------------------------------------------------------

DROP TABLE IF EXISTS _cleanup_batch_scores;
CREATE TABLE _cleanup_batch_scores (
    PRIMARY KEY (batch_id)
)
SELECT
    ra.batch_id,
    SUM(CASE WHEN ra.total_score IS NOT NULL THEN 1 ELSE 0 END) AS scored_count
FROM result_attempts ra
GROUP BY ra.batch_id;

DROP TABLE IF EXISTS _cleanup_ranked_batches;
CREATE TABLE _cleanup_ranked_batches (
    PRIMARY KEY (id),
    KEY idx_scope_rn (course_id, session_id, semester_id, rn)
)
SELECT
    rb.id,
    rb.course_id,
    rb.session_id,
    rb.semester_id,
    ROW_NUMBER() OVER (
        PARTITION BY rb.course_id, rb.session_id, rb.semester_id
        ORDER BY
            FIELD(rb.status, 'published', 'approved', 'submitted', 'draft'),
            COALESCE(bs.scored_count, 0) DESC,
            rb.created_at ASC,
            rb.id ASC
    ) AS rn
FROM result_batches rb
LEFT JOIN _cleanup_batch_scores bs ON bs.batch_id = rb.id;

DROP TABLE IF EXISTS _cleanup_ranked_attempts;
CREATE TABLE _cleanup_ranked_attempts (
    PRIMARY KEY (id),
    KEY idx_keep_lookup (course_id, session_id, semester_id, student_id, rn)
)
SELECT
    ra.id,
    ra.batch_id,
    ra.student_id,
    rb.course_id,
    rb.session_id,
    rb.semester_id,
    rb_keep.id AS keep_batch_id,
    ROW_NUMBER() OVER (
        PARTITION BY rb.course_id, rb.session_id, rb.semester_id, ra.student_id
        ORDER BY
            (ra.total_score IS NOT NULL) DESC,
            (ra.grade IS NOT NULL AND ra.grade NOT IN ('', '-', 'ABS')) DESC,
            COALESCE(ra.total_score, -1) DESC,
            COALESCE(ra.updated_at, ra.created_at) DESC,
            ra.id ASC
    ) AS rn
FROM result_attempts ra
INNER JOIN _cleanup_ranked_batches rb ON rb.id = ra.batch_id
INNER JOIN _cleanup_ranked_batches rb_keep
  ON rb_keep.course_id = rb.course_id
 AND rb_keep.session_id = rb.session_id
 AND rb_keep.semester_id = rb.semester_id
 AND rb_keep.rn = 1;

-- Re-point carryover_corrections to the winning attempt (rn = 1)
UPDATE carryover_corrections cc
INNER JOIN _cleanup_ranked_attempts r_old ON r_old.id = cc.source_result_attempt_id AND r_old.rn > 1
INNER JOIN _cleanup_ranked_attempts r_keep
  ON r_keep.course_id = r_old.course_id
 AND r_keep.session_id = r_old.session_id
 AND r_keep.semester_id = r_old.semester_id
 AND r_keep.student_id = r_old.student_id
 AND r_keep.rn = 1
SET cc.source_result_attempt_id = r_keep.id;

UPDATE carryover_corrections cc
INNER JOIN _cleanup_ranked_attempts r_old ON r_old.id = cc.result_attempt_id AND r_old.rn > 1
INNER JOIN _cleanup_ranked_attempts r_keep
  ON r_keep.course_id = r_old.course_id
 AND r_keep.session_id = r_old.session_id
 AND r_keep.semester_id = r_old.semester_id
 AND r_keep.student_id = r_old.student_id
 AND r_keep.rn = 1
SET cc.result_attempt_id = r_keep.id;

-- Delete duplicate attempts (rn > 1) via pure PRIMARY KEY join
DELETE ra
FROM result_attempts ra
INNER JOIN _cleanup_ranked_attempts r ON r.id = ra.id
WHERE r.rn > 1;

-- Move surviving winning attempts (rn = 1) into keep_batch_id via pure PRIMARY KEY join
UPDATE result_attempts ra
INNER JOIN _cleanup_ranked_attempts r ON r.id = ra.id
SET ra.batch_id = r.keep_batch_id
WHERE r.rn = 1 AND ra.batch_id != r.keep_batch_id;

-- Delete empty duplicate result_batches (rn > 1) via pure PRIMARY KEY join
DELETE rb
FROM result_batches rb
INNER JOIN _cleanup_ranked_batches r ON r.id = rb.id
WHERE r.rn > 1;

DROP TABLE IF EXISTS _cleanup_ranked_attempts;
DROP TABLE IF EXISTS _cleanup_ranked_batches;
DROP TABLE IF EXISTS _cleanup_batch_scores;

-- -----------------------------------------------------------------------------
-- BLOCK 3: Merge Duplicate `course_registrations` & Align `session_id` with Cohort
-- -----------------------------------------------------------------------------

DROP TABLE IF EXISTS _cleanup_ranked_regs;
CREATE TABLE _cleanup_ranked_regs (
    PRIMARY KEY (id),
    KEY idx_student_sem_rn (student_id, semester_id, rn)
)
SELECT
    cr.id,
    cr.student_id,
    cr.semester_id,
    ROW_NUMBER() OVER (
        PARTITION BY cr.student_id, cr.semester_id
        ORDER BY
            (sess.name = s.session_name) DESC,
            FIELD(cr.status, 'approved', 'submitted', 'draft'),
            cr.created_at ASC,
            cr.id ASC
    ) AS rn
FROM course_registrations cr
INNER JOIN students s ON s.id = cr.student_id
INNER JOIN semesters sem ON sem.id = cr.semester_id AND sem.name LIKE 'Contact %'
LEFT JOIN academic_sessions sess ON sess.id = cr.session_id;

DROP TABLE IF EXISTS _cleanup_ranked_reg_items;
CREATE TABLE _cleanup_ranked_reg_items (
    PRIMARY KEY (id)
)
SELECT
    cri.id,
    r_keep.id AS keep_reg_id,
    ROW_NUMBER() OVER (
        PARTITION BY r_old.student_id, r_old.semester_id, cri.course_id
        ORDER BY
            (cri.status = 'active') DESC,
            (LOWER(COALESCE(cri.registration_type, 'normal')) NOT IN ('carryover', 'repeat')) DESC,
            r_old.rn ASC,
            cri.id ASC
    ) AS rn
FROM course_registration_items cri
INNER JOIN _cleanup_ranked_regs r_old ON r_old.id = cri.registration_id
INNER JOIN _cleanup_ranked_regs r_keep
  ON r_keep.student_id = r_old.student_id
 AND r_keep.semester_id = r_old.semester_id
 AND r_keep.rn = 1;

-- Delete duplicate course_registration_items (rn > 1) via pure PRIMARY KEY join
DELETE cri
FROM course_registration_items cri
INNER JOIN _cleanup_ranked_reg_items r ON r.id = cri.id
WHERE r.rn > 1;

-- Move surviving winning items (rn = 1) into keep_reg_id via pure PRIMARY KEY join
UPDATE course_registration_items cri
INNER JOIN _cleanup_ranked_reg_items r ON r.id = cri.id
SET cri.registration_id = r.keep_reg_id
WHERE r.rn = 1 AND cri.registration_id != r.keep_reg_id;

-- Delete duplicate course_registrations headers (rn > 1) via pure PRIMARY KEY join
DELETE cr
FROM course_registrations cr
INNER JOIN _cleanup_ranked_regs r ON r.id = cr.id
WHERE r.rn > 1;

-- Align cr.session_id with student's cohort session (s.session_name)
UPDATE course_registrations cr
INNER JOIN students s ON s.id = cr.student_id
INNER JOIN academic_sessions sess ON sess.name = TRIM(s.session_name)
SET cr.session_id = sess.id
WHERE cr.session_id != sess.id;

-- Recalculate total_credits on course_registrations via pure PRIMARY KEY join
DROP TABLE IF EXISTS _cleanup_reg_credit_sums;
CREATE TABLE _cleanup_reg_credit_sums (
    PRIMARY KEY (registration_id)
)
SELECT
    cri.registration_id,
    COALESCE(SUM(c.credit_units), 0) AS calc_credits
FROM course_registration_items cri
INNER JOIN courses c ON c.id = cri.course_id
WHERE cri.status = 'active'
GROUP BY cri.registration_id;

UPDATE course_registrations cr
INNER JOIN _cleanup_reg_credit_sums sums ON sums.registration_id = cr.id
SET cr.total_credits = sums.calc_credits
WHERE cr.total_credits != sums.calc_credits;

DROP TABLE IF EXISTS _cleanup_reg_credit_sums;
DROP TABLE IF EXISTS _cleanup_ranked_reg_items;
DROP TABLE IF EXISTS _cleanup_ranked_regs;

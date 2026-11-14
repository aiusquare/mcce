CREATE TABLE IF NOT EXISTS `carryover_corrections` (
  `id` CHAR(36) NOT NULL,
  `result_attempt_id` CHAR(36) NOT NULL,
  `source_result_attempt_id` CHAR(36) NULL,
  `student_id` CHAR(36) NOT NULL,
  `course_id` CHAR(36) NOT NULL,
  `session_id` CHAR(36) NOT NULL,
  `semester_id` CHAR(36) NOT NULL,
  `ca_score` DECIMAL(5,2) NULL,
  `exam_score` DECIMAL(5,2) NULL,
  `total_score` DECIMAL(5,2) NULL,
  `grade` VARCHAR(5) NULL,
  `grade_point` DECIMAL(4,2) NULL,
  `quality_point` DECIMAL(6,2) NULL,
  `corrected_by` CHAR(36) NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_carryover_correction_attempt` (`result_attempt_id`),
  KEY `idx_carryover_correction_student_course` (`student_id`, `course_id`),
  KEY `idx_carryover_correction_period` (`session_id`, `semester_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `carryover_corrections` (
  `id`, `result_attempt_id`, `source_result_attempt_id`, `student_id`, `course_id`,
  `session_id`, `semester_id`, `ca_score`, `exam_score`, `total_score`, `grade`,
  `grade_point`, `quality_point`, `created_at`, `updated_at`
)
SELECT
  UUID(),
  a.id,
  (
    SELECT source.id
    FROM result_attempts source
    JOIN result_batches source_batch ON source_batch.id = source.batch_id
    JOIN academic_sessions source_session ON source_session.id = source_batch.session_id
    JOIN semesters source_semester ON source_semester.id = source_batch.semester_id
    WHERE source.student_id = a.student_id
      AND source_batch.course_id = target_batch.course_id
      AND UPPER(source.grade) IN ('F', 'ABS')
      AND (
        source_session.name < target_session.name
        OR (
          source_session.name = target_session.name
          AND source_semester.name < target_semester.name
        )
      )
    ORDER BY source_session.name DESC, source_semester.name DESC,
             COALESCE(source.updated_at, source.created_at) DESC
    LIMIT 1
  ),
  a.student_id,
  target_batch.course_id,
  target_batch.session_id,
  target_batch.semester_id,
  a.ca_score,
  a.exam_score,
  a.total_score,
  a.grade,
  a.grade_point,
  a.quality_point,
  COALESCE(a.created_at, NOW()),
  a.updated_at
FROM result_attempts a
JOIN result_batches target_batch ON target_batch.id = a.batch_id
JOIN academic_sessions target_session ON target_session.id = target_batch.session_id
JOIN semesters target_semester ON target_semester.id = target_batch.semester_id
WHERE a.status = 'active'
  AND a.grade IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM result_attempts source
    JOIN result_batches source_batch ON source_batch.id = source.batch_id
    JOIN academic_sessions source_session ON source_session.id = source_batch.session_id
    JOIN semesters source_semester ON source_semester.id = source_batch.semester_id
    WHERE source.student_id = a.student_id
      AND source_batch.course_id = target_batch.course_id
      AND UPPER(source.grade) IN ('F', 'ABS')
      AND (
        source_session.name < target_session.name
        OR (
          source_session.name = target_session.name
          AND source_semester.name < target_semester.name
        )
      )
  );
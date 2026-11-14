<?php
$m = new mysqli('127.0.0.1', 'root', '', 'aacasorg_main');

// Columns on course_registrations
$cr_cols = [
    'level' => "ALTER TABLE course_registrations ADD COLUMN `level` VARCHAR(50) NULL AFTER `semester_id`",
    'programme_id' => "ALTER TABLE course_registrations ADD COLUMN `programme_id` CHAR(36) NULL AFTER `level`",
    'approved_at' => "ALTER TABLE course_registrations ADD COLUMN `approved_at` DATETIME NULL AFTER `submitted_at`",
    'approved_by' => "ALTER TABLE course_registrations ADD COLUMN `approved_by` CHAR(36) NULL AFTER `approved_at`",
    'source' => "ALTER TABLE course_registrations ADD COLUMN `source` VARCHAR(20) NOT NULL DEFAULT 'student' AFTER `status`",
];

foreach ($cr_cols as $col => $sql) {
    $chk = $m->query("SHOW COLUMNS FROM course_registrations LIKE '$col'");
    if ($chk && $chk->num_rows == 0) {
        $m->query($sql);
        echo "Added $col to course_registrations\n";
    }
}

// Columns on course_registration_items
$cri_cols = [
    'status' => "ALTER TABLE course_registration_items ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'active'",
    'source' => "ALTER TABLE course_registration_items ADD COLUMN `source` VARCHAR(50) DEFAULT 'MANUAL'",
    'origin_result_attempt_id' => "ALTER TABLE course_registration_items ADD COLUMN `origin_result_attempt_id` CHAR(36) NULL",
    'origin_session_id' => "ALTER TABLE course_registration_items ADD COLUMN `origin_session_id` CHAR(36) NULL",
    'origin_semester_id' => "ALTER TABLE course_registration_items ADD COLUMN `origin_semester_id` CHAR(36) NULL",
    'origin_level' => "ALTER TABLE course_registration_items ADD COLUMN `origin_level` VARCHAR(50) NULL",
    'origin_score' => "ALTER TABLE course_registration_items ADD COLUMN `origin_score` DECIMAL(5,2) NULL",
    'origin_grade' => "ALTER TABLE course_registration_items ADD COLUMN `origin_grade` VARCHAR(5) NULL",
    'last_synced_at' => "ALTER TABLE course_registration_items ADD COLUMN `last_synced_at` DATETIME NULL",
    'sync_run_id' => "ALTER TABLE course_registration_items ADD COLUMN `sync_run_id` CHAR(36) NULL",
    'sync_status' => "ALTER TABLE course_registration_items ADD COLUMN `sync_status` VARCHAR(50) NULL",
    'dropped_at' => "ALTER TABLE course_registration_items ADD COLUMN `dropped_at` DATETIME NULL",
    'dropped_by' => "ALTER TABLE course_registration_items ADD COLUMN `dropped_by` VARCHAR(36) NULL",
    'drop_reason' => "ALTER TABLE course_registration_items ADD COLUMN `drop_reason` TEXT NULL",
];

foreach ($cri_cols as $col => $sql) {
    $chk = $m->query("SHOW COLUMNS FROM course_registration_items LIKE '$col'");
    if ($chk && $chk->num_rows == 0) {
        $m->query($sql);
        echo "Added $col to course_registration_items\n";
    }
}

echo "Done ensuring columns.\n";

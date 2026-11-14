<?php
$m = new mysqli('127.0.0.1', 'root', '', 'aacasorg_main');

$cri_cols = [
    'registration_id' => "ALTER TABLE course_registration_items ADD COLUMN `registration_id` CHAR(36) NULL AFTER `id`",
    'course_id' => "ALTER TABLE course_registration_items ADD COLUMN `course_id` CHAR(36) NULL AFTER `registration_id`",
    'registration_type' => "ALTER TABLE course_registration_items ADD COLUMN `registration_type` VARCHAR(30) NOT NULL DEFAULT 'core' AFTER `course_id`",
];

foreach ($cri_cols as $col => $sql) {
    $chk = $m->query("SHOW COLUMNS FROM course_registration_items LIKE '$col'");
    if ($chk && $chk->num_rows == 0) {
        $m->query($sql);
        echo "Added $col to course_registration_items\n";
    }
}

// In case course_registration_id was populated, copy over
$m->query("UPDATE course_registration_items SET registration_id = course_registration_id WHERE registration_id IS NULL AND course_registration_id IS NOT NULL");
$m->query("UPDATE course_registration_items SET registration_type = course_type WHERE registration_type IS NULL OR registration_type = ''");

echo "Done ensuring cri columns.\n";

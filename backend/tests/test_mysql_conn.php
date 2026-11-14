<?php
$mysqli = @new mysqli('127.0.0.1', 'root', '');
foreach (['mcchst_new', 'mcchst', 'aac_database'] as $db) {
    if ($mysqli->select_db($db)) {
        $r1 = $mysqli->query("SHOW TABLES LIKE 'courses'");
        $r2 = $mysqli->query("SHOW TABLES LIKE 'result_attempts'");
        $r3 = $mysqli->query("SHOW TABLES LIKE 'course_registrations'");
        $has_courses = $r1 && $r1->num_rows > 0;
        $has_attempts = $r2 && $r2->num_rows > 0;
        $has_regs = $r3 && $r3->num_rows > 0;
        $count_students = 0;
        if ($mysqli->query("SHOW TABLES LIKE 'students'")->num_rows > 0) {
            $count_students = $mysqli->query("SELECT count(*) FROM students")->fetch_row()[0];
        }
        $count_results = 0;
        if ($has_attempts) {
            $count_results = $mysqli->query("SELECT count(*) FROM result_attempts")->fetch_row()[0];
        }
        echo "DB '$db': courses=$has_courses, attempts=$has_attempts ($count_results rows), regs=$has_regs, students=$count_students\n";
    }
}

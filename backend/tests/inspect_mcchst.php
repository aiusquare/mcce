<?php
$mysqli = new mysqli('127.0.0.1', 'root', '', 'mcchst_new');
$res = $mysqli->query("SHOW TABLES");
$tables = [];
while ($r = $res->fetch_row()) $tables[] = $r[0];
echo "Tables in mcchst_new: " . implode(', ', $tables) . "\n";

foreach (['academic_sessions', 'semesters', 'programmes', 'students', 'courses', 'course_registrations', 'result_batches', 'result_attempts', 'grading_schemes'] as $tbl) {
    if (in_array($tbl, $tables)) {
        $c = $mysqli->query("SELECT count(*) FROM `$tbl`")->fetch_row()[0];
        echo " - $tbl: $c rows\n";
    } else {
        echo " - $tbl: DOES NOT EXIST\n";
    }
}

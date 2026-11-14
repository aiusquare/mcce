<?php
$m = new mysqli('localhost', 'aacasorg_main', 'Zb@+3C7]0Z;7RPcQ', 'aacasorg_main');
if ($m->connect_error) die("DB error: " . $m->connect_error . "\n");

$needed = [
    'academic_sessions', 'semesters', 'programmes', 'students', 'users',
    'admissions', 'course_registrations', 'course_registration_items',
    'result_attempts', 'result_batches', 'courses', 'carryover_corrections'
];

$res = $m->query("SHOW TABLES");
$tables = [];
while ($r = $res->fetch_row()) $tables[] = $r[0];

echo "Checking tables in aacasorg_main:\n";
$missing = [];
foreach ($needed as $t) {
    if (in_array($t, $tables)) {
        $cnt = $m->query("SELECT count(*) FROM `$t`")->fetch_row()[0];
        echo " - [OK] $t ($cnt rows)\n";
    } else {
        echo " - [MISSING] $t\n";
        $missing[] = $t;
    }
}

if (!empty($missing)) {
    echo "MISSING TABLES: " . implode(', ', $missing) . "\n";
} else {
    echo "ALL 12 REQUIRED TABLES EXIST IN aacasorg_main!\n";
}

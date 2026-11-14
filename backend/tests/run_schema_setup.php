<?php
$mysqli = new mysqli('127.0.0.1', 'root', '', 'aacasorg_main');
if ($mysqli->connect_error) {
    die("Connect failed: " . $mysqli->connect_error . "\n");
}

$mysqli->query("SET FOREIGN_KEY_CHECKS=0");

$files = [
    'c:/DEV/Reatjs/maslaha/frontend/db/result_management_schema.sql',
    'c:/DEV/Reatjs\maslaha/backend/db/migrations/017_create_course_registration_tables.sql',
    'c:/DEV/Reatjs/maslaha/backend/db/migrations/018_create_carryover_corrections.sql',
    'c:/DEV/Reatjs/maslaha/backend/db/migrations/019_registration_soft_drop_and_source.sql',
];

foreach ($files as $file) {
    echo "Running " . basename($file) . "...\n";
    $sql = file_get_contents($file);
    // Split by semicolons, ignoring semicolons within comments
    $queries = explode(";\n", $sql);
    foreach ($queries as $q) {
        $q = trim($q);
        if ($q === '' || strpos($q, '--') === 0) continue;
        if (!$mysqli->query($q)) {
            // Ignore table already exists
            if ($mysqli->errno != 1050 && $mysqli->errno != 1060) {
                echo "Warning on query (" . $mysqli->errno . "): " . $mysqli->error . "\n";
            }
        }
    }
}

$mysqli->query("SET FOREIGN_KEY_CHECKS=1");

$res = $mysqli->query("SHOW TABLES");
echo "Total tables in aacasorg_main: " . $res->num_rows . "\n";

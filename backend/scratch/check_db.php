<?php
define('BASEPATH', 'dummy');
define('ENVIRONMENT', 'development');
require_once __DIR__ . '/../application/config/database.php';

$m = new mysqli($db['default']['hostname'], $db['default']['username'], $db['default']['password'], $db['default']['database']);

$res = $m->query("SELECT COUNT(*) as cnt FROM students");
$row = $res->fetch_assoc();
echo "Total students: " . $row['cnt'] . "\n";

$res = $m->query("SELECT s.id, ad.matric_number, u.full_name FROM students s JOIN users u ON u.id = s.user_id LEFT JOIN admissions ad ON ad.id = s.admission_id LIMIT 10");
while ($r = $res->fetch_assoc()) {
    echo "{$r['matric_number']} - {$r['full_name']}\n";
}

<?php
define('ENVIRONMENT', 'development');
$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
define('BASEPATH', '1');
require 'application/config/database.php';
$db = $db['default']; 
$mysqli = new mysqli($db['hostname'], $db['username'], $db['password'], $db['database']);
if ($mysqli->connect_error) die($mysqli->connect_error);
$res = $mysqli->query("SELECT * FROM grading_schemes WHERE is_active = 1");
print_r($res->fetch_assoc());
$res2 = $mysqli->query("SELECT * FROM grading_ranges");
while($row = $res2->fetch_assoc()) { print_r($row); }

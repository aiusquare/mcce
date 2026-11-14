<?php
$mysqli = new mysqli('127.0.0.1', 'root', '');
$res = $mysqli->query("SELECT user, host FROM mysql.user");
while ($r = $res->fetch_assoc()) {
    echo "User: " . $r['user'] . "@" . $r['host'] . "\n";
}

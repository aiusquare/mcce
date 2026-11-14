<?php
$mysqli = new mysqli("127.0.0.1", "aacasorg_main", "Zb@+3C7]0Z;7RPcQ", "aacasorg_main", 3306);
if ($mysqli->connect_error) {
    die("Connection failed: " . $mysqli->connect_error);
}

$res = $mysqli->query("SELECT * FROM users WHERE email='superadmin@mcce.edu.ng'");
if ($res) {
    echo "USER:\n";
    print_r($res->fetch_assoc());
}

$res = $mysqli->query("SELECT * FROM roles");
if ($res) {
    echo "\nROLES:\n";
    while ($row = $res->fetch_assoc()) {
        print_r($row);
    }
}

$res = $mysqli->query("SELECT * FROM user_roles");
if ($res) {
    echo "\nUSER_ROLES:\n";
    while ($row = $res->fetch_assoc()) {
        print_r($row);
    }
}

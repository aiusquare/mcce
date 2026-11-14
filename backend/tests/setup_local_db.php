<?php
$mysqli = new mysqli('127.0.0.1', 'root', '');
if ($mysqli->connect_error) {
    die("Root connect error: " . $mysqli->connect_error . "\n");
}

echo "Creating database aacasorg_main if not exists...\n";
$mysqli->query("CREATE DATABASE IF NOT EXISTS `aacasorg_main` CHARACTER SET utf8 COLLATE utf8_general_ci");

echo "Creating user aacasorg_main...\n";
$mysqli->query("CREATE USER IF NOT EXISTS 'aacasorg_main'@'localhost' IDENTIFIED BY 'Zb@+3C7]0Z;7RPcQ'");
$mysqli->query("CREATE USER IF NOT EXISTS 'aacasorg_main'@'127.0.0.1' IDENTIFIED BY 'Zb@+3C7]0Z;7RPcQ'");
$mysqli->query("GRANT ALL PRIVILEGES ON `aacasorg_main`.* TO 'aacasorg_main'@'localhost'");
$mysqli->query("GRANT ALL PRIVILEGES ON `aacasorg_main`.* TO 'aacasorg_main'@'127.0.0.1'");
$mysqli->query("FLUSH PRIVILEGES");

echo "Testing connection as aacasorg_main...\n";
$m2 = new mysqli('localhost', 'aacasorg_main', 'Zb@+3C7]0Z;7RPcQ', 'aacasorg_main');
if ($m2->connect_error) {
    echo "Connection error: " . $m2->connect_error . "\n";
} else {
    echo "SUCCESS! User aacasorg_main connected to local database aacasorg_main!\n";
    $m2->close();
}
$mysqli->close();

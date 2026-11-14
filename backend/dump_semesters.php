<?php
$mysqli = new mysqli('localhost', 'root', '', 'mcceorgn_main');
if ($mysqli->connect_error) {
    die("Connection failed: " . $mysqli->connect_error);
}
$res = $mysqli->query('SELECT * FROM semesters');
if ($res) {
    while($row = $res->fetch_assoc()) {
        print_r($row);
    }
} else {
    echo "Error: " . $mysqli->error;
}

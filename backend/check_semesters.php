<?php
$mysqli = new mysqli('127.0.0.1', 'root', '', 'maslaha');
if ($mysqli->connect_error) {
    die('Connect Error (' . $mysqli->connect_errno . ') ' . $mysqli->connect_error);
}
$result = $mysqli->query('SELECT * FROM semesters');
while ($row = $result->fetch_assoc()) {
    print_r($row);
}

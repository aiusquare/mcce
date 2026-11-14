<?php
$conn = @mysqli_connect('127.0.0.1', 'root', '', 'maslaha');
if (!$conn) {
    echo "Local maslaha connection failed: " . mysqli_connect_error() . "\n";
    $conn2 = @mysqli_connect('localhost', 'aacasorg_main', 'Zb@+3C7]0Z;7RPcQ', 'aacasorg_main');
    if (!$conn2) {
        echo "aacasorg_main connection failed: " . mysqli_connect_error() . "\n";
    } else {
        echo "Connected to aacasorg_main!\n";
    }
} else {
    echo "Connected to local maslaha!\n";
}

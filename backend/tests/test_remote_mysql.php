<?php
$hosts = ['app.mcce.org.ng', 'mcce.org.ng', 'mail.mcce.org.ng'];
foreach ($hosts as $h) {
    echo "Testing $h...\n";
    try {
        $m = @new mysqli($h, 'aacasorg_main', 'Zb@+3C7]0Z;7RPcQ', 'aacasorg_main', 3306);
        if (!$m->connect_error) {
            echo "SUCCESS connected to $h!\n";
            $res = $m->query("SELECT count(*) FROM result_attempts");
            echo "result_attempts count: " . $res->fetch_row()[0] . "\n";
            $m->close();
            break;
        } else {
            echo "Connect error for $h: " . $m->connect_error . "\n";
        }
    } catch (Exception $e) {
        echo "Exception for $h: " . $e->getMessage() . "\n";
    }
}

<?php
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['SERVER_NAME'] = 'localhost';
$_SERVER['SERVER_PORT'] = '80';

chdir(__DIR__ . '/..');

ob_start();
require_once 'index.php';
ob_end_clean();

$CI = &get_instance();
if ($CI) {
    echo "SUCCESS: CodeIgniter bootstrapped. Loaded model test...\n";
    $CI->load->model('Broadsheet_model');
    echo "Broadsheet_model loaded: " . (is_object($CI->Broadsheet_model) ? "YES" : "NO") . "\n";
} else {
    echo "FAILED to get CI instance\n";
}

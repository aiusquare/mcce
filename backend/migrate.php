<?php
$_SERVER['argv'] = array('index.php', 'migrate');
define('ENVIRONMENT', 'development');
chdir(__DIR__);
require_once 'index.php';

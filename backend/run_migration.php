<?php
define('ENVIRONMENT', 'development');
$system_path = 'system';
$application_folder = 'application';
$view_folder = '';

define('BASEPATH', str_replace('\\', '/', $system_path));
define('FCPATH', __DIR__ . '/');
define('APPPATH', $application_folder . '/');
define('VIEWPATH', $view_folder . '/');

require_once BASEPATH . 'core/CodeIgniter.php';
// Wait, loading CodeIgniter.php will execute the whole application lifecycle.
// Let's just create a controller and curl it.

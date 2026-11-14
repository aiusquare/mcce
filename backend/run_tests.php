<?php
define('ENVIRONMENT', 'development');
$system_path = 'system';
$application_folder = 'application';
$view_folder = '';
define('BASEPATH', str_replace('\\', '/', realpath($system_path)).'/');
define('APPPATH', realpath($application_folder).'/');
define('VIEWPATH', __DIR__ . '/');

require_once BASEPATH . 'core/CodeIgniter.php';
// We can't easily bootstrap CI CLI this way because CI 3 CLI routing requires passing arguments.


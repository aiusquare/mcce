<?php
defined('BASEPATH') OR exit('No direct script access allowed');

// Enable CORS for all requests
$hook['pre_system'][] = array(
	'class'    => 'CorsHook',
	'function' => 'enable_cors',
	'filename' => 'CorsHook.php',
	'filepath' => 'hooks',
	'params'   => array()
);
/*
| -------------------------------------------------------------------------
| Hooks
| -------------------------------------------------------------------------
| This file lets you define "hooks" to extend CI without hacking the core
| files.  Please see the user guide for info:
|
|	https://codeigniter.com/userguide3/general/hooks.html
|
*/

$hook['post_controller_constructor'][] = array(
	'class'    => 'MaintenanceHook',
	'function' => 'check_maintenance',
	'filename' => 'MaintenanceHook.php',
	'filepath' => 'hooks',
	'params'   => array()
);

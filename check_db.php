<?php
// Load codeigniter silently to run db queries
define('ENVIRONMENT', 'development');
chdir('c:/DEV/Reatjs/maslaha/backend');
require_once 'index.php'; // This might execute things, let's just use raw PDO to connect to mysql.

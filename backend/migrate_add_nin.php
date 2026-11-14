<?php
// Quick migration script to add NIN column to users table
// Run this in Laragon: php db/migrate_add_nin.php

require_once __DIR__ . '/../www/mcchst-new-updated-backend/system/core/CodeIgniter.php';

// This file initializes CodeIgniter - but for a simple migration, you can use raw SQL instead.
// Alternatively, execute via phpMyAdmin or command line:
// ALTER TABLE `users` ADD COLUMN `nin` VARCHAR(11) DEFAULT NULL AFTER `phone`;

echo "Migration: To add NIN column, run the following SQL in phpMyAdmin:\n\n";
echo "ALTER TABLE \`users\` ADD COLUMN \`nin\` VARCHAR(11) DEFAULT NULL AFTER \`phone\`;\n\n";
echo "Or run db/migrations/001_add_nin_to_users.sql file.\n";
?>

-- Migration: Add NIN column to users table
-- Purpose: Store National Identification Number during student registration

ALTER TABLE `users` 
ADD COLUMN `nin` VARCHAR(11) DEFAULT NULL AFTER `phone`;

-- Add unique index on NIN for faster lookups (optional, useful if NIN becomes a login method)
-- ALTER TABLE `users` ADD UNIQUE INDEX `uq_users_nin` (`nin`);

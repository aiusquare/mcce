-- Create responsibility_allowance table
-- Run in MySQL (e.g., phpMyAdmin or mysql CLI) after selecting the target database

CREATE TABLE IF NOT EXISTS `responsibility_allowance` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `staff_group` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `updated_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

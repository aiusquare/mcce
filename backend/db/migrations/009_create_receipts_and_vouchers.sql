-- Receipts table
CREATE TABLE IF NOT EXISTS `receipts` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `receipt_date` DATE NOT NULL,
  `payer` VARCHAR(255) NOT NULL,
  `amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `payment_method` VARCHAR(50) NOT NULL,
  `reference` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_receipts_reference` (`reference`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Payment vouchers table
CREATE TABLE IF NOT EXISTS `payment_vouchers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `voucher_date` DATE NOT NULL,
  `payee` VARCHAR(255) NOT NULL,
  `amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `payment_method` VARCHAR(50) NOT NULL,
  `reference` VARCHAR(100) NOT NULL,
  `purpose` TEXT NULL,
  `prepared_by` VARCHAR(150) NULL,
  `approved_by` VARCHAR(150) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_vouchers_reference` (`reference`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

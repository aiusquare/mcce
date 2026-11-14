-- Create chart of accounts tables (account_groups, control_accounts, accounts)
-- Run in MySQL after selecting the target database

CREATE TABLE IF NOT EXISTS `account_groups` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_account_groups_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `control_accounts` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `account_group_id` int(11) unsigned NOT NULL,
  `code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_control_code_group` (`account_group_id`, `code`),
  KEY `idx_control_group` (`account_group_id`),
  CONSTRAINT `fk_control_group` FOREIGN KEY (`account_group_id`) REFERENCES `account_groups` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `accounts` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `account_group_id` int(11) unsigned NOT NULL,
  `control_account_id` int(11) unsigned NOT NULL,
  `account_number` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `account_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_account_number` (`account_number`),
  KEY `idx_account_group` (`account_group_id`),
  KEY `idx_account_control` (`control_account_id`),
  CONSTRAINT `fk_account_group` FOREIGN KEY (`account_group_id`) REFERENCES `account_groups` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_account_control` FOREIGN KEY (`control_account_id`) REFERENCES `control_accounts` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed the four base groups if they are missing
INSERT INTO `account_groups` (`code`, `name`, `created_at`)
SELECT * FROM (
    SELECT '1' AS code, 'Assets' AS name, NOW() AS created_at UNION ALL
    SELECT '2', 'Liabilities', NOW() UNION ALL
    SELECT '3', 'Revenue', NOW() UNION ALL
    SELECT '4', 'Expenses', NOW()
) AS src
WHERE NOT EXISTS (
    SELECT 1 FROM account_groups g WHERE g.code = src.code
);

-- Optional seed control accounts (one per group) if missing
INSERT INTO `control_accounts` (`account_group_id`, `code`, `name`, `created_at`)
SELECT g.id, src.code, src.name, NOW()
FROM account_groups g
JOIN (
    SELECT '1' AS group_code, '01' AS code, 'Cash/Bank' AS name
    UNION ALL SELECT '2', '01', 'Payables'
    UNION ALL SELECT '3', '01', 'Tuition/Income'
    UNION ALL SELECT '4', '01', 'Operating Expenses'
) src ON g.code = src.group_code
WHERE NOT EXISTS (
    SELECT 1 FROM control_accounts c WHERE c.account_group_id = g.id AND c.code = src.code
);

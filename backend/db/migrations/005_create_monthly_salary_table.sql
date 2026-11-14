-- Create monthly_salary table to store monthly payroll snapshots
-- Run in MySQL (e.g., phpMyAdmin or mysql CLI) after selecting the target database

CREATE TABLE IF NOT EXISTS `monthly_salary` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `month` varchar(7) COLLATE utf8mb4_unicode_ci NOT NULL,
  `staff_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `staff_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rank` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `division` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `grade` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fixed_allowance` decimal(12,2) NOT NULL DEFAULT 0.00,
  `basic_salary` decimal(12,2) NOT NULL DEFAULT 0.00,
  `housing_allowance` decimal(12,2) NOT NULL DEFAULT 0.00,
  `transport_allowance` decimal(12,2) NOT NULL DEFAULT 0.00,
  `utility_allowance` decimal(12,2) NOT NULL DEFAULT 0.00,
  `employer_pension` decimal(12,2) NOT NULL DEFAULT 0.00,
  `arrears` decimal(12,2) NOT NULL DEFAULT 0.00,
  `gross` decimal(12,2) NOT NULL DEFAULT 0.00,
  `penalty` decimal(12,2) NOT NULL DEFAULT 0.00,
  `employer_pension_deduction` decimal(12,2) NOT NULL DEFAULT 0.00,
  `employee_pension_deduction` decimal(12,2) NOT NULL DEFAULT 0.00,
  `paye` decimal(12,2) NOT NULL DEFAULT 0.00,
  `standing_order` decimal(12,2) NOT NULL DEFAULT 0.00,
  `loan_repayment` decimal(12,2) NOT NULL DEFAULT 0.00,
  `cooperative_deduction` decimal(12,2) NOT NULL DEFAULT 0.00,
  `total_deduction` decimal(12,2) NOT NULL DEFAULT 0.00,
  `net_pay` decimal(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_staff_month` (`staff_id`,`month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

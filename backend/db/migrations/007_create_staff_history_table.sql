-- Track staff changes with effectation dates
-- Run in MySQL after selecting the target database

CREATE TABLE IF NOT EXISTS `staff_history` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `staff_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `effective_from` date NOT NULL,
  `staff_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `staff_group` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `grade` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rank` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `designation` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `division` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `basic_salary` decimal(12,2) DEFAULT NULL,
  `housing_allowance` decimal(12,2) DEFAULT NULL,
  `transport_allowance` decimal(12,2) DEFAULT NULL,
  `utility_allowance` decimal(12,2) DEFAULT NULL,
  `employer_pension` decimal(12,2) DEFAULT NULL,
  `leave_allowance` decimal(12,2) DEFAULT NULL,
  `teaching_allowance` decimal(12,2) DEFAULT NULL,
  `arrears` decimal(12,2) DEFAULT NULL,
  `penalty` decimal(12,2) DEFAULT NULL,
  `paye` decimal(12,2) DEFAULT NULL,
  `standing_order` decimal(12,2) DEFAULT NULL,
  `loan_repayment` decimal(12,2) DEFAULT NULL,
  `cooperative_deduction` decimal(12,2) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_staff_eff` (`staff_id`, `effective_from`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

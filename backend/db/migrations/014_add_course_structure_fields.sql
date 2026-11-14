-- Course catalogue placement for contact-based and semester-based programmes.

ALTER TABLE `courses`
  ADD COLUMN `programme_structure` VARCHAR(30) NOT NULL DEFAULT 'semester' AFTER `type`,
  ADD COLUMN `contact_number` TINYINT NULL AFTER `programme_structure`,
  ADD COLUMN `year_number` TINYINT NULL AFTER `contact_number`,
  ADD COLUMN `semester_name` VARCHAR(50) NULL AFTER `year_number`;

CREATE INDEX `idx_courses_structure` ON `courses` (`programme_structure`, `contact_number`, `year_number`);

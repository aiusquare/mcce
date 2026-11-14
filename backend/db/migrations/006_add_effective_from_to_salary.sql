-- Add effective_from date to salary records for effectation tracking
-- Run in MySQL after selecting the target database

ALTER TABLE `salary`
  ADD COLUMN IF NOT EXISTS `effective_from` date DEFAULT NULL AFTER `teaching_allowance`;

-- Programme-level academic structure used during admission.

ALTER TABLE `programmes`
  ADD COLUMN `programme_structure` VARCHAR(30) NOT NULL DEFAULT 'semester' AFTER `duration_years`;

-- Add account numbers and confirmation account names for receipts
ALTER TABLE `receipts`
  ADD COLUMN `bank_account_number` VARCHAR(100) NULL AFTER `payment_method`,
  ADD COLUMN `credit_account_number` VARCHAR(100) NULL AFTER `bank_account_number`,
  ADD COLUMN `credit_account_name` VARCHAR(255) NULL AFTER `credit_account_number`;

-- Add account numbers and confirmation account names for payment vouchers
ALTER TABLE `payment_vouchers`
  ADD COLUMN `bank_account_number` VARCHAR(100) NULL AFTER `payment_method`,
  ADD COLUMN `debit_account_number` VARCHAR(100) NULL AFTER `bank_account_number`,
  ADD COLUMN `debit_account_name` VARCHAR(255) NULL AFTER `debit_account_number`;

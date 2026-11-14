-- Add bank and account fields to receipts
ALTER TABLE `receipts`
  ADD COLUMN `bank` VARCHAR(150) NULL AFTER `payment_method`,
  ADD COLUMN `credit_account` VARCHAR(150) NULL AFTER `bank_name`;

-- Add bank and account fields to payment vouchers
ALTER TABLE `payment_vouchers`
  ADD COLUMN `bank` VARCHAR(150) NULL AFTER `payment_method`,
  ADD COLUMN `debit_account` VARCHAR(150) NULL AFTER `bank_name`;

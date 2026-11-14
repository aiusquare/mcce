-- Remove legacy bank/name columns now superseded by account number fields
ALTER TABLE `receipts`
  DROP COLUMN `bank`,
  DROP COLUMN `bank_name`,
  DROP COLUMN `credit_account`,
  DROP COLUMN `account_to_credit`;

ALTER TABLE `payment_vouchers`
  DROP COLUMN `bank`,
  DROP COLUMN `debit_account`;

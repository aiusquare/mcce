<?php
if (!defined('BASEPATH')) exit('No direct script access allowed');

class PaymentVoucher_model extends CI_Model {
    private $table = 'payment_vouchers';

    public function list_all($limit = 500)
    {
        $this->db->order_by('created_at', 'DESC');
        $this->db->limit($limit);
        return $this->db->get($this->table)->result_array();
    }

    public function create($payload)
    {
        $date = isset($payload['voucher_date']) && $payload['voucher_date'] ? $payload['voucher_date'] : date('Y-m-d');
        $payee = isset($payload['payee']) ? trim((string)$payload['payee']) : '';
        $amount = isset($payload['amount']) ? (float)$payload['amount'] : 0.00;
        $payment_method = isset($payload['payment_method']) ? trim((string)$payload['payment_method']) : '';
        $bank_account_number = isset($payload['bank_account_number']) ? trim((string)$payload['bank_account_number']) : null;
        $debit_account_number = isset($payload['debit_account_number']) ? trim((string)$payload['debit_account_number']) : null;
        $debit_account_name = isset($payload['debit_account_name']) ? trim((string)$payload['debit_account_name']) : null;
        $reference = isset($payload['reference']) ? trim((string)$payload['reference']) : '';
        $purpose = isset($payload['purpose']) ? trim((string)$payload['purpose']) : null;
        $prepared_by = isset($payload['prepared_by']) ? trim((string)$payload['prepared_by']) : null;
        $approved_by = isset($payload['approved_by']) ? trim((string)$payload['approved_by']) : null;

        if ($payee === '' || $amount <= 0 || $payment_method === '') {
            return array('error' => 'payee, amount, and payment_method are required');
        }

        if ($reference === '') {
            $reference = $this->generate_ref('PV');
        }

        $this->db->where('reference', $reference);
        $this->db->limit(1);
        $exists = $this->db->get($this->table)->row_array();
        if ($exists) {
            return array('error' => 'Reference already exists');
        }

        $data = array(
            'voucher_date' => $date,
            'payee' => $payee,
            'amount' => $amount,
            'payment_method' => $payment_method,
            'reference' => $reference,
            'purpose' => $purpose,
            'prepared_by' => $prepared_by,
            'approved_by' => $approved_by,
            'bank_account_number' => $bank_account_number,
            'debit_account_number' => $debit_account_number,
            'debit_account_name' => $debit_account_name,
            'created_at' => date('Y-m-d H:i:s'),
        );

        $this->db->insert($this->table, $data);
        if ($this->db->affected_rows() <= 0) {
            return array('error' => 'Failed to create payment voucher');
        }

        $data['id'] = $this->db->insert_id();
        return $data;
    }

    private function generate_ref($prefix)
    {
        return $prefix . '-' . date('Ymd-His');
    }
}

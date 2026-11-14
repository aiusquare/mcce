<?php
if (!defined('BASEPATH')) exit('No direct script access allowed');

class Receipt_model extends CI_Model {
    private $table = 'receipts';

    public function list_all($limit = 500)
    {
        $this->db->order_by('created_at', 'DESC');
        $this->db->limit($limit);
        return $this->db->get($this->table)->result_array();
    }

    public function create($payload)
    {
        $date = isset($payload['receipt_date']) && $payload['receipt_date'] ? $payload['receipt_date'] : date('Y-m-d');
        $payer = isset($payload['payer']) ? trim((string)$payload['payer']) : '';
        $amount = isset($payload['amount']) ? (float)$payload['amount'] : 0.00;
        $payment_method = isset($payload['payment_method']) ? trim((string)$payload['payment_method']) : '';
        $bank_account_number = isset($payload['bank_account_number']) ? trim((string)$payload['bank_account_number']) : null;
        $credit_account_number = isset($payload['credit_account_number']) ? trim((string)$payload['credit_account_number']) : null;
        $credit_account_name = isset($payload['credit_account_name']) ? trim((string)$payload['credit_account_name']) : null;
        $reference = isset($payload['reference']) ? trim((string)$payload['reference']) : '';
        $description = isset($payload['description']) ? trim((string)$payload['description']) : null;

        if ($payer === '' || $amount <= 0 || $payment_method === '') {
            return array('error' => 'payer, amount, and payment_method are required');
        }

        if ($reference === '') {
            $reference = $this->generate_ref('RCPT');
        }

        // Prevent duplicate reference
        $this->db->where('reference', $reference);
        $this->db->limit(1);
        $exists = $this->db->get($this->table)->row_array();
        if ($exists) {
            return array('error' => 'Reference already exists');
        }

        $data = array(
            'receipt_date' => $date,
            'payer' => $payer,
            'amount' => $amount,
            'payment_method' => $payment_method,
            'reference' => $reference,
            'description' => $description,
            'bank_account_number' => $bank_account_number,
            'credit_account_number' => $credit_account_number,
            'credit_account_name' => $credit_account_name,
            'created_at' => date('Y-m-d H:i:s'),
        );

        $this->db->insert($this->table, $data);
        if ($this->db->affected_rows() <= 0) {
            return array('error' => 'Failed to create receipt');
        }

        $data['id'] = $this->db->insert_id();
        return $data;
    }

    private function generate_ref($prefix)
    {
        return $prefix . '-' . date('Ymd-His');
    }
}

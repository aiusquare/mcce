<?php
if (!defined('BASEPATH')) exit('No direct script access allowed');

class Fee_model extends CI_Model
{
    private $rules_table = 'fee_invoice_rules';
    private $items_table = 'fee_invoice_rule_items';
    private $payments_table = 'student_fee_payments';
    private $wallet_table = 'student_wallet_transactions';
    private $session_settings_table = 'session_fee_settings';

    public function list_session_fee_settings()
    {
        if (!$this->db->table_exists($this->session_settings_table)) {
            return array();
        }

        $this->db->select('f.*, s.name AS session_name, s.is_active AS academic_session_is_active');
        $this->db->from($this->session_settings_table . ' f');
        $this->db->join('academic_sessions s', 's.id = f.session_id');
        $this->db->order_by('s.start_date', 'DESC');
        $this->db->order_by('s.name', 'DESC');
        $rows = $this->db->get()->result_array();

        return array_map(array($this, 'format_session_fee_setting'), $rows);
    }

    public function save_session_fee_setting($payload, $user_id = null)
    {
        if (!$this->db->table_exists($this->session_settings_table)) {
            return array('error' => 'Session fee settings are not installed. Run db/migrations/026_create_session_fee_settings.sql first.', 'code' => 503);
        }

        $session_id = trim((string) $this->value($payload, array('session_id', 'sessionId'), ''));
        $application_fee = $this->value($payload, array('application_fee', 'applicationFee'), null);
        $acceptance_fee = $this->value($payload, array('acceptance_fee', 'acceptanceFee'), null);
        if ($session_id === '' || !is_numeric($application_fee) || !is_numeric($acceptance_fee)
            || (float) $application_fee < 0 || (float) $acceptance_fee < 0) {
            return array('error' => 'A valid session ID and non-negative fee amounts are required.', 'code' => 422);
        }

        $session = $this->db->get_where('academic_sessions', array('id' => $session_id), 1)->row_array();
        if (!$session) {
            return array('error' => 'Selected academic session does not exist.', 'code' => 422);
        }

        $status_input = strtolower(trim((string) $this->value($payload, array('status'), '')));
        $is_active_input = $this->value($payload, array('is_active', 'isActive'), null);
        $status = ($status_input === 'inactive' || $is_active_input === 0 || $is_active_input === '0' || $is_active_input === false)
            ? 'inactive'
            : 'active';
        $now = date('Y-m-d H:i:s');
        $data = array(
            'application_fee' => number_format((float) $application_fee, 2, '.', ''),
            'acceptance_fee' => number_format((float) $acceptance_fee, 2, '.', ''),
            'status' => $status,
            'updated_at' => $now,
            'updated_by' => $user_id,
        );

        $existing = $this->db->get_where($this->session_settings_table, array('session_id' => $session_id), 1)->row_array();
        if ($existing) {
            $this->db->where('id', $existing['id']);
            $this->db->update($this->session_settings_table, $data);
            $row_id = $existing['id'];
        } else {
            $row_id = $this->generate_uuid();
            $data['id'] = $row_id;
            $data['session_id'] = $session_id;
            $data['created_at'] = $now;
            $data['created_by'] = $user_id;
            $this->db->insert($this->session_settings_table, $data);
        }

        if ($this->db->trans_status() === false) {
            return array('error' => 'Unable to save session fee settings.', 'code' => 500);
        }

        $row = $this->db->select('f.*, s.name AS session_name, s.is_active AS academic_session_is_active')
            ->from($this->session_settings_table . ' f')
            ->join('academic_sessions s', 's.id = f.session_id')
            ->where('f.id', $row_id)
            ->get()->row_array();
        return array('data' => $this->format_session_fee_setting($row));
    }

    public function get_public_session_fee_setting($reference = null)
    {
        if (!$this->db->table_exists($this->session_settings_table)) {
            return null;
        }

        $this->db->select('f.*, s.name AS session_name, s.is_active AS academic_session_is_active');
        $this->db->from($this->session_settings_table . ' f');
        $this->db->join('academic_sessions s', 's.id = f.session_id');
        $this->db->where('f.status', 'active');
        $reference = trim((string) $reference);
        if ($reference !== '') {
            $this->db->group_start();
            $this->db->where('s.id', $reference);
            $this->db->or_where('s.name', $reference);
            $this->db->group_end();
        } else {
            $this->db->where('s.is_active', 1);
        }
        $row = $this->db->get('', 1)->row_array();
        return $row ? $this->format_session_fee_setting($row) : null;
    }

    public function ensure_tables()
    {
        $this->db->query("
            CREATE TABLE IF NOT EXISTS `fee_invoice_rules` (
              `id` CHAR(36) NOT NULL,
              `invoice_code` VARCHAR(50) NOT NULL,
              `invoice_type` VARCHAR(20) NOT NULL DEFAULT 'general',
              `title` VARCHAR(255) NOT NULL,
              `description` TEXT NULL,
              `amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
              `due_date` DATE NULL,
              `status` VARCHAR(30) NOT NULL DEFAULT 'draft',
              `target_programs` TEXT NULL,
              `target_levels` TEXT NULL,
              `semester` VARCHAR(100) NULL,
              `academic_year` VARCHAR(50) NULL,
              `target_program` VARCHAR(200) NULL,
              `target_level` VARCHAR(50) NULL,
              `target_department` VARCHAR(200) NULL,
              `student_id` CHAR(36) NULL,
              `student_name` VARCHAR(255) NULL,
              `student_email` VARCHAR(255) NULL,
              `program` VARCHAR(200) NULL,
              `level` VARCHAR(50) NULL,
              `students_affected` INT NOT NULL DEFAULT 0,
              `created_at` DATETIME NOT NULL,
              `created_by` CHAR(36) NULL,
              `updated_at` DATETIME NULL,
              `updated_by` CHAR(36) NULL,
              `deleted_at` DATETIME NULL,
              `deleted_by` CHAR(36) NULL,
              PRIMARY KEY (`id`),
              UNIQUE KEY `uq_fee_invoice_rules_code` (`invoice_code`),
              KEY `idx_fee_invoice_rules_type` (`invoice_type`),
              KEY `idx_fee_invoice_rules_status` (`status`),
              KEY `idx_fee_invoice_rules_student` (`student_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $this->db->query("
            CREATE TABLE IF NOT EXISTS `fee_invoice_rule_items` (
              `id` CHAR(36) NOT NULL,
              `rule_id` CHAR(36) NOT NULL,
              `description` VARCHAR(255) NOT NULL,
              `amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
              `sort_order` INT NOT NULL DEFAULT 0,
              `created_at` DATETIME NOT NULL,
              `created_by` CHAR(36) NULL,
              PRIMARY KEY (`id`),
              KEY `idx_fee_invoice_rule_items_rule` (`rule_id`),
              CONSTRAINT `fk_fee_invoice_rule_items_rule` FOREIGN KEY (`rule_id`) REFERENCES `fee_invoice_rules` (`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        return $this->db->table_exists($this->rules_table);
    }

    public function list_invoices($type = null)
    {
        $this->ensure_tables();

        $this->db->where('deleted_at IS NULL', null, false);
        if ($type) {
            $this->db->where('invoice_type', $this->normalize_type($type));
        }
        $this->db->order_by('created_at', 'DESC');
        $rows = $this->db->get($this->rules_table)->result_array();

        $result = array();
        foreach ($rows as $row) {
            $row['students_affected'] = $this->count_affected_students($row);
            $result[] = $this->format_invoice($row);
        }

        return $result;
    }

    public function get_invoice($id)
    {
        $this->ensure_tables();
        $row = $this->find_rule($id);
        if (!$row) {
            return null;
        }

        $row['students_affected'] = $this->count_affected_students($row);
        return $this->format_invoice($row);
    }

    public function create_invoice($payload, $user_id = null)
    {
        $this->ensure_tables();

        $type = $this->normalize_type($this->value($payload, array('type', 'invoice_type'), 'general'));
        $title = trim((string) $this->value($payload, array('title'), ''));
        $items = $this->normalize_items($this->value($payload, array('items', 'invoice_items'), array()));
        $amount = $this->items_total($items);
        $due_date = $this->value($payload, array('due_date', 'dueDate'), null);

        if ($title === '' || empty($items) || $amount <= 0 || !$due_date) {
            return array('error' => 'title, due date, and at least one invoice item are required', 'code' => 400);
        }

        $student_id = $this->value($payload, array('student_id', 'studentId'), null);
        $student = $student_id ? $this->get_student($student_id) : null;

        $row = array(
            'id' => $this->generate_uuid(),
            'invoice_code' => $this->next_invoice_code($type),
            'invoice_type' => $type,
            'title' => $title,
            'description' => $this->value($payload, array('description'), ''),
            'amount' => $amount,
            'due_date' => $due_date,
            'status' => $this->normalize_status($this->value($payload, array('status'), 'draft')),
            'target_programs' => $type === 'general' ? null : $this->encode_list($this->value($payload, array('target_programs', 'targetPrograms'), null)),
            'target_levels' => $type === 'general' ? null : $this->encode_list($this->value($payload, array('target_levels', 'targetLevels'), null)),
            'semester' => $type === 'general' ? null : $this->value($payload, array('semester'), null),
            'academic_year' => $type === 'general' ? null : $this->value($payload, array('academic_year', 'academicYear'), null),
            'target_program' => $type === 'general' ? null : $this->value($payload, array('target_program', 'targetProgram'), null),
            'target_level' => $type === 'general' ? null : $this->value($payload, array('target_level', 'targetLevel'), null),
            'target_department' => $type === 'general' ? null : $this->value($payload, array('target_department', 'targetDepartment'), null),
            'student_id' => $student_id,
            'student_name' => $this->value($payload, array('student_name', 'studentName'), $student ? $student['full_name'] : null),
            'student_email' => $this->value($payload, array('student_email', 'studentEmail'), $student ? $student['email'] : null),
            'program' => $this->value($payload, array('program', 'programme'), $student ? $student['programme_name'] : null),
            'level' => $this->value($payload, array('level'), $student ? $student['current_level'] : null),
            'created_at' => date('Y-m-d H:i:s'),
            'created_by' => $user_id,
        );

        $row['students_affected'] = $this->count_affected_students($row);
        $this->db->insert($this->rules_table, $row);

        if ($this->db->affected_rows() <= 0) {
            return array('error' => 'Unable to create invoice', 'code' => 500);
        }

        $this->replace_items($row['id'], $items, $user_id);
        return array('data' => $this->format_invoice($row));
    }

    public function update_invoice($id, $payload, $user_id = null)
    {
        $this->ensure_tables();
        $existing = $this->find_rule($id);
        if (!$existing) {
            return array('error' => 'Invoice not found', 'code' => 404);
        }

        $updates = array();
        $map = array(
            'type' => 'invoice_type',
            'invoice_type' => 'invoice_type',
            'title' => 'title',
            'description' => 'description',
            'amount' => 'amount',
            'due_date' => 'due_date',
            'dueDate' => 'due_date',
            'status' => 'status',
            'semester' => 'semester',
            'academic_year' => 'academic_year',
            'academicYear' => 'academic_year',
            'target_program' => 'target_program',
            'targetProgram' => 'target_program',
            'target_level' => 'target_level',
            'targetLevel' => 'target_level',
            'target_department' => 'target_department',
            'targetDepartment' => 'target_department',
            'student_id' => 'student_id',
            'studentId' => 'student_id',
            'student_name' => 'student_name',
            'studentName' => 'student_name',
            'student_email' => 'student_email',
            'studentEmail' => 'student_email',
            'program' => 'program',
            'programme' => 'program',
            'level' => 'level',
        );

        foreach ($map as $input => $column) {
            if (array_key_exists($input, $payload)) {
                $updates[$column] = $payload[$input];
            }
        }

        if (array_key_exists('target_programs', $payload)) {
            $updates['target_programs'] = $this->encode_list($payload['target_programs']);
        }
        if (array_key_exists('targetPrograms', $payload)) {
            $updates['target_programs'] = $this->encode_list($payload['targetPrograms']);
        }
        if (array_key_exists('target_levels', $payload)) {
            $updates['target_levels'] = $this->encode_list($payload['target_levels']);
        }
        if (array_key_exists('targetLevels', $payload)) {
            $updates['target_levels'] = $this->encode_list($payload['targetLevels']);
        }

        if (isset($updates['invoice_type'])) {
            $updates['invoice_type'] = $this->normalize_type($updates['invoice_type']);
        }
        if (isset($updates['status'])) {
            $updates['status'] = $this->normalize_status($updates['status']);
        }
        if (isset($updates['amount'])) {
            $updates['amount'] = (float) $updates['amount'];
        }
        $items = null;
        if (array_key_exists('items', $payload) || array_key_exists('invoice_items', $payload)) {
            $items = $this->normalize_items($this->value($payload, array('items', 'invoice_items'), array()));
            if (empty($items)) {
                return array('error' => 'At least one invoice item is required', 'code' => 400);
            }
            $updates['amount'] = $this->items_total($items);
        }
        if (isset($updates['invoice_type']) && $updates['invoice_type'] === 'general') {
            $updates['target_programs'] = null;
            $updates['target_levels'] = null;
            $updates['semester'] = null;
            $updates['academic_year'] = null;
            $updates['target_program'] = null;
            $updates['target_level'] = null;
            $updates['target_department'] = null;
        }

        $merged = array_merge($existing, $updates);
        $updates['students_affected'] = $this->count_affected_students($merged);
        $updates['updated_at'] = date('Y-m-d H:i:s');
        $updates['updated_by'] = $user_id;

        $this->db->where('id', $existing['id']);
        $ok = $this->db->update($this->rules_table, $updates);
        if (!$ok) {
            return array('error' => 'Unable to update invoice', 'code' => 500);
        }
        if (is_array($items)) {
            $this->replace_items($existing['id'], $items, $user_id);
        }

        return array('data' => $this->get_invoice($existing['invoice_code']));
    }

    public function publish_invoice($id, $user_id = null)
    {
        return $this->update_invoice($id, array('status' => 'published'), $user_id);
    }

    public function delete_invoice($id, $user_id = null)
    {
        $this->ensure_tables();
        $existing = $this->find_rule($id);
        if (!$existing) {
            return array('error' => 'Invoice not found', 'code' => 404);
        }

        $this->db->where('id', $existing['id']);
        $ok = $this->db->update($this->rules_table, array(
            'deleted_at' => date('Y-m-d H:i:s'),
            'deleted_by' => $user_id,
        ));

        if (!$ok) {
            return array('error' => 'Unable to delete invoice', 'code' => 500);
        }

        return array('success' => true);
    }

    public function summary()
    {
        $this->ensure_tables();
        $this->ensure_payment_tables();

        $total_revenue = 0.0;
        $students_paid = 0;
        if ($this->db->table_exists($this->payments_table)) {
            $this->db->select('COALESCE(SUM(amount), 0) as total_revenue, COUNT(DISTINCT student_id) as students_paid', false);
            $this->db->where_in('status', array('completed', 'success', 'successful', 'paid'));
            $row = $this->db->get($this->payments_table)->row_array();
            $total_revenue = isset($row['total_revenue']) ? (float) $row['total_revenue'] : 0.0;
            $students_paid = isset($row['students_paid']) ? (int) $row['students_paid'] : 0;
        }

        $pending = 0.0;
        $this->db->where('deleted_at IS NULL', null, false);
        $this->db->where_in('status', array('draft', 'published', 'pending', 'overdue'));
        $rules = $this->db->get($this->rules_table)->result_array();
        foreach ($rules as $rule) {
            $affected = $this->count_affected_students($rule);
            $pending += ((float) $rule['amount']) * max(1, $affected);
        }

        $total_rules = count($rules);
        $collection_rate = $total_rules > 0
            ? round(($students_paid / max(1, $total_rules)) * 100, 1)
            : 0;

        return array(
            'totalRevenue' => $total_revenue,
            'pendingPayments' => $pending,
            'studentsPaid' => $students_paid,
            'collectionRate' => $collection_rate,
        );
    }

    public function admin_payment_dashboard($filters = array())
    {
        return array(
            'stats' => $this->admin_payment_stats(),
            'payments' => $this->admin_payments($filters),
        );
    }

    public function admin_payments($filters = array())
    {
        $this->ensure_tables();
        $this->ensure_payment_tables();

        $this->db->select('pay.*');
        $this->db->select('r.title as invoice_title, r.invoice_type, r.program as rule_program');
        if ($this->db->table_exists('students')) {
            $this->db->select('s.current_level');
        }
        if ($this->db->table_exists('users')) {
            $this->db->select('u.full_name, u.email');
        }
        if ($this->db->table_exists('programmes')) {
            $this->db->select('p.name as programme_name');
        }
        if ($this->db->table_exists('admissions')) {
            $this->db->select('a.matric_number, a.admission_number');
        }

        $this->db->from($this->payments_table . ' pay');
        $this->db->join($this->rules_table . ' r', 'r.id = pay.invoice_rule_id', 'left');
        if ($this->db->table_exists('students')) {
            $this->db->join('students s', 's.id = pay.student_id', 'left');
        }
        if ($this->db->table_exists('users')) {
            $this->db->join('users u', 'u.id = pay.user_id', 'left');
        }
        if ($this->db->table_exists('programmes')) {
            $this->db->join('programmes p', 'p.id = s.programme_id', 'left');
        }
        if ($this->db->table_exists('admissions')) {
            $this->db->join('admissions a', 'a.id = s.admission_id', 'left');
        }

        $status = $this->value($filters, array('status'), null);
        if ($status && strtolower((string) $status) !== 'all') {
            $this->db->where('pay.status', $this->normalize_admin_payment_status($status));
        }

        $search = trim((string) $this->value($filters, array('search', 'q'), ''));
        if ($search !== '') {
            $like = $this->db->escape_like_str($search);
            $this->db->group_start();
            $this->db->like('pay.reference', $like, 'both');
            $this->db->or_like('pay.receipt_no', $like, 'both');
            $this->db->or_like('pay.invoice_code', $like, 'both');
            if ($this->db->table_exists('users')) {
                $this->db->or_like('u.full_name', $like, 'both');
                $this->db->or_like('u.email', $like, 'both');
            }
            if ($this->db->table_exists('admissions')) {
                $this->db->or_like('a.matric_number', $like, 'both');
                $this->db->or_like('a.admission_number', $like, 'both');
            }
            $this->db->group_end();
        }

        $this->db->order_by('COALESCE(pay.paid_at, pay.created_at)', 'DESC', false);
        $this->db->order_by('pay.created_at', 'DESC');

        $limit = (int) $this->value($filters, array('limit'), 200);
        if ($limit > 0) {
            $this->db->limit(min($limit, 1000));
        }

        $rows = $this->db->get()->result_array();
        $payments = array();
        foreach ($rows as $row) {
            $payments[] = $this->format_admin_payment($row);
        }

        return $payments;
    }

    public function update_admin_payment_status($id, $status, $user_id = null)
    {
        $this->ensure_tables();
        $this->ensure_payment_tables();

        $payment = $this->find_payment($id);
        if (!$payment) {
            return array('error' => 'Payment not found', 'code' => 404);
        }

        $normalized = $this->normalize_admin_payment_status($status);
        $updates = array('status' => $normalized);
        if ($normalized === 'completed' && empty($payment['paid_at'])) {
            $updates['paid_at'] = date('Y-m-d H:i:s');
        }
        if ($this->db->field_exists('reviewed_at', $this->payments_table)) {
            $updates['reviewed_at'] = date('Y-m-d H:i:s');
        }
        if ($this->db->field_exists('reviewed_by', $this->payments_table)) {
            $updates['reviewed_by'] = $user_id;
        }
        if ($this->db->field_exists('updated_at', $this->payments_table)) {
            $updates['updated_at'] = date('Y-m-d H:i:s');
        }

        $this->db->where('id', $payment['id']);
        $ok = $this->db->update($this->payments_table, $updates);
        if (!$ok) {
            return array('error' => 'Unable to update payment', 'code' => 500);
        }

        return array('data' => $this->find_payment($payment['id']));
    }

    public function export_payment_rows($filters = array())
    {
        $filters['limit'] = 0;
        return $this->admin_payments($filters);
    }

    public function student_options()
    {
        if (!$this->db->table_exists('students') || !$this->db->table_exists('users')) {
            return array();
        }
        $this->load->model('Student_model');
        if (isset($this->Student_model) && method_exists($this->Student_model, 'ensure_student_levels_synced')) {
            $this->Student_model->ensure_student_levels_synced();
        }

        $this->db->select('s.id, s.current_level, u.full_name, u.email');
        if ($this->db->table_exists('programmes')) {
            $this->db->select('p.name as programme_name');
        }
        $this->db->from('students s');
        $this->db->join('users u', 'u.id = s.user_id', 'left');
        if ($this->db->table_exists('programmes')) {
            $this->db->join('programmes p', 'p.id = s.programme_id', 'left');
        }
        $this->db->where('s.status', 'active');
        $this->db->order_by('u.full_name', 'ASC');
        $rows = $this->db->get()->result_array();

        $students = array();
        foreach ($rows as $row) {
            $students[] = array(
                'id' => $row['id'],
                'name' => isset($row['full_name']) ? $row['full_name'] : '',
                'email' => isset($row['email']) ? $row['email'] : '',
                'program' => isset($row['programme_name']) ? $row['programme_name'] : '',
                'level' => isset($row['current_level']) ? $row['current_level'] : '',
            );
        }

        return $students;
    }

    public function export_rows()
    {
        return $this->list_invoices();
    }

    public function student_portal($user)
    {
        $this->ensure_tables();
        $this->ensure_payment_tables();

        $student = $this->get_student_for_user($user);
        if (!$student) {
            return array(
                'walletBalance' => 0,
                'invoices' => array(),
                'transactions' => array(),
                'receipts' => array(),
                'summary' => array(
                    'outstandingAmount' => 0,
                    'totalPaid' => 0,
                    'netBalance' => 0,
                ),
            );
        }

        $payments = $this->completed_payments_by_rule($student);
        $invoices = array();
        $outstanding = 0.0;
        $total_paid = 0.0;

        $this->db->where('deleted_at IS NULL', null, false);
        $this->db->where_in('status', array('published', 'pending', 'overdue', 'paid'));
        $this->db->order_by('due_date', 'ASC');
        $rules = $this->db->get($this->rules_table)->result_array();

        foreach ($rules as $rule) {
            if (!$this->invoice_applies_to_student($rule, $student)) {
                continue;
            }

            $is_paid = isset($payments[$rule['id']]);
            if ($is_paid) {
                $total_paid += (float) $rule['amount'];
            } else {
                $outstanding += (float) $rule['amount'];
            }

            $invoices[] = $this->format_student_invoice($rule, $is_paid);
        }

        $wallet = $this->student_wallet_balance($student);

        return array(
            'walletBalance' => $wallet,
            'invoices' => $invoices,
            'transactions' => $this->student_transactions($student),
            'receipts' => $this->student_receipts($student),
            'summary' => array(
                'outstandingAmount' => $outstanding,
                'totalPaid' => $total_paid,
                'netBalance' => $wallet - $outstanding,
            ),
        );
    }

    public function pay_student_invoice($user, $payload)
    {
        $this->ensure_tables();
        $this->ensure_payment_tables();

        $student = $this->get_student_for_user($user);
        if (!$student) {
            return array('error' => 'Student record not found', 'code' => 404);
        }

        $invoice_id = $this->value($payload, array('invoice_id', 'invoiceId', 'id'), null);
        if (!$invoice_id) {
            return array('error' => 'Invoice id is required', 'code' => 400);
        }

        $rule = $this->find_rule($invoice_id);
        if (!$rule || !$this->invoice_applies_to_student($rule, $student)) {
            return array('error' => 'Invoice not found for this student', 'code' => 404);
        }

        if (!in_array($this->normalize_status($rule['status']), array('published', 'pending', 'overdue', 'paid'), true)) {
            return array('error' => 'Invoice is not available for payment', 'code' => 400);
        }

        $existing = $this->completed_payment_for_rule($student, $rule['id']);
        if ($existing) {
            return array('error' => 'Invoice has already been paid', 'code' => 409);
        }

        $method = $this->normalize_payment_method($this->value($payload, array('method', 'payment_method', 'paymentMethod'), 'wallet'));
        $amount = (float) $rule['amount'];
        $reference = trim((string) $this->value($payload, array('reference'), ''));
        if ($reference === '') {
            $reference = $this->payment_reference($method);
        }

        $wallet = $this->student_wallet_balance($student);
        if ($method === 'wallet' && $wallet < $amount) {
            return array('error' => 'Insufficient wallet balance', 'code' => 400);
        }

        $this->db->trans_begin();

        if ($method !== 'wallet') {
            $this->record_wallet_transaction($student, 'credit', $amount, $reference, 'External payment funding for ' . $rule['title'], $method, $rule['invoice_code']);
        }

        $this->record_wallet_transaction($student, 'debit', $amount, $reference, 'Payment for ' . $rule['title'], $method, $rule['invoice_code']);

        $receipt_no = $this->next_receipt_no();
        $this->db->insert($this->payments_table, array(
            'id' => $this->generate_uuid(),
            'student_id' => $student['id'],
            'user_id' => isset($student['user_id']) ? $student['user_id'] : null,
            'invoice_rule_id' => $rule['id'],
            'invoice_code' => $rule['invoice_code'],
            'amount' => $amount,
            'method' => $method,
            'reference' => $reference,
            'receipt_no' => $receipt_no,
            'status' => 'completed',
            'paid_at' => date('Y-m-d H:i:s'),
            'created_at' => date('Y-m-d H:i:s'),
            'raw_payload' => json_encode($payload),
        ));

        if ($this->db->trans_status() === false) {
            $this->db->trans_rollback();
            return array('error' => 'Unable to record payment', 'code' => 500);
        }

        $this->db->trans_commit();
        return array('data' => $this->student_portal($user));
    }

    public function credit_student_wallet($user, $payload)
    {
        $this->ensure_payment_tables();

        $student = $this->get_student_for_user($user);
        if (!$student) {
            return array('error' => 'Student record not found', 'code' => 404);
        }

        $amount = (float) $this->value($payload, array('amount'), 0);
        if ($amount <= 0) {
            return array('error' => 'Amount must be greater than zero', 'code' => 400);
        }

        $method = $this->normalize_payment_method($this->value($payload, array('method', 'payment_method', 'paymentMethod'), 'bank'));
        $reference = trim((string) $this->value($payload, array('reference'), ''));
        if ($reference === '') {
            $reference = $this->payment_reference($method);
        }

        $this->record_wallet_transaction($student, 'credit', $amount, $reference, 'Wallet top-up', $method, null);
        return array('data' => $this->student_portal($user));
    }

    private function find_rule($id)
    {
        $this->db->where('deleted_at IS NULL', null, false);
        $this->db->group_start();
        $this->db->where('id', $id);
        $this->db->or_where('invoice_code', $id);
        $this->db->group_end();
        return $this->db->get($this->rules_table, 1)->row_array();
    }

    private function format_invoice($row)
    {
        $type = $this->normalize_type(isset($row['invoice_type']) ? $row['invoice_type'] : 'general');
        $base = array(
            'id' => isset($row['invoice_code']) ? $row['invoice_code'] : $row['id'],
            'rule_id' => $row['id'],
            'type' => $type,
            'title' => $row['title'],
            'description' => isset($row['description']) ? $row['description'] : '',
            'amount' => (float) $row['amount'],
            'items' => $this->get_items($row['id']),
            'dueDate' => isset($row['due_date']) ? $row['due_date'] : null,
            'due_date' => isset($row['due_date']) ? $row['due_date'] : null,
            'status' => $this->normalize_status(isset($row['status']) ? $row['status'] : 'draft'),
            'createdAt' => isset($row['created_at']) ? $row['created_at'] : null,
            'created_at' => isset($row['created_at']) ? $row['created_at'] : null,
        );

        if ($type === 'individual') {
            return array_merge($base, array(
                'studentId' => isset($row['student_id']) ? $row['student_id'] : null,
                'studentName' => isset($row['student_name']) ? $row['student_name'] : null,
                'studentEmail' => isset($row['student_email']) ? $row['student_email'] : null,
                'program' => isset($row['program']) ? $row['program'] : null,
                'level' => isset($row['level']) ? $row['level'] : null,
            ));
        }

        if ($type === 'specific') {
            return array_merge($base, array(
                'targetProgram' => isset($row['target_program']) ? $row['target_program'] : null,
                'targetLevel' => isset($row['target_level']) ? $row['target_level'] : null,
                'targetDepartment' => isset($row['target_department']) ? $row['target_department'] : null,
                'semester' => isset($row['semester']) ? $row['semester'] : null,
                'studentsAffected' => isset($row['students_affected']) ? (int) $row['students_affected'] : 0,
            ));
        }

        return array_merge($base, array(
            'targetPrograms' => array('All active students'),
            'targetLevels' => array('All Levels'),
            'semester' => null,
            'academicYear' => null,
            'studentsAffected' => isset($row['students_affected']) ? (int) $row['students_affected'] : 0,
        ));
    }

    private function format_session_fee_setting($row)
    {
        if (!$row) {
            return null;
        }

        return array(
            'id' => isset($row['id']) ? $row['id'] : null,
            'session_id' => isset($row['session_id']) ? $row['session_id'] : null,
            'session_name' => isset($row['session_name']) ? $row['session_name'] : null,
            'application_fee' => isset($row['application_fee']) ? (float) $row['application_fee'] : 0.0,
            'acceptance_fee' => isset($row['acceptance_fee']) ? (float) $row['acceptance_fee'] : 0.0,
            'status' => isset($row['status']) ? $row['status'] : 'inactive',
            'is_active' => isset($row['status']) && $row['status'] === 'active',
            'academic_session_is_active' => !empty($row['academic_session_is_active']),
            'effective_from' => isset($row['effective_from']) ? $row['effective_from'] : null,
            'effective_to' => isset($row['effective_to']) ? $row['effective_to'] : null,
        );
    }

    private function admin_payment_stats()
    {
        $this->ensure_payment_tables();

        $today_start = date('Y-m-d 00:00:00');
        $tomorrow_start = date('Y-m-d 00:00:00', strtotime('+1 day'));
        $yesterday_start = date('Y-m-d 00:00:00', strtotime('-1 day'));
        $week_start = date('Y-m-d 00:00:00', strtotime('-6 days'));
        $previous_week_start = date('Y-m-d 00:00:00', strtotime('-13 days'));

        $today = $this->sum_payments_between($today_start, $tomorrow_start);
        $yesterday = $this->sum_payments_between($yesterday_start, $today_start);
        $weekly = $this->sum_payments_between($week_start, $tomorrow_start);
        $previous_week = $this->sum_payments_between($previous_week_start, $week_start);

        $pending = $this->count_payments_by_status('pending');
        $previous_pending = $this->count_pending_before($today_start);

        $total = $this->count_all_payments();
        $completed = $this->count_payments_by_status('completed');
        $success_rate = $total > 0 ? round(($completed / $total) * 100, 1) : 0;

        return array(
            'todayRevenue' => $today,
            'todayRevenueChange' => $this->percentage_change($today, $yesterday),
            'weeklyRevenue' => $weekly,
            'weeklyRevenueChange' => $this->percentage_change($weekly, $previous_week),
            'pendingApprovals' => $pending,
            'pendingApprovalsChange' => $this->percentage_change($pending, $previous_pending),
            'successRate' => $success_rate,
            'successRateChange' => 0,
        );
    }

    private function sum_payments_between($start, $end)
    {
        $row = $this->db->query(
            "SELECT COALESCE(SUM(amount), 0) AS total
             FROM `{$this->payments_table}`
             WHERE `status` IN ('completed', 'success', 'successful', 'paid')
               AND COALESCE(`paid_at`, `created_at`) >= ?
               AND COALESCE(`paid_at`, `created_at`) < ?",
            array($start, $end)
        )->row_array();

        return $row && isset($row['total']) ? (float) $row['total'] : 0.0;
    }

    private function count_payments_by_status($status)
    {
        $status = $this->normalize_admin_payment_status($status);
        $this->db->where('status', $status);
        return (int) $this->db->count_all_results($this->payments_table);
    }

    private function count_pending_before($date)
    {
        $this->db->where('status', 'pending');
        $this->db->where('created_at <', $date);
        return (int) $this->db->count_all_results($this->payments_table);
    }

    private function count_all_payments()
    {
        return (int) $this->db->count_all($this->payments_table);
    }

    private function percentage_change($current, $previous)
    {
        $current = (float) $current;
        $previous = (float) $previous;
        if ($previous == 0.0) {
            return $current == 0.0 ? 0.0 : 100.0;
        }
        return round((($current - $previous) / abs($previous)) * 100, 1);
    }

    private function find_payment($id)
    {
        $this->db->group_start();
        $this->db->where('id', $id);
        $this->db->or_where('reference', $id);
        $this->db->or_where('receipt_no', $id);
        $this->db->group_end();
        return $this->db->get($this->payments_table, 1)->row_array();
    }

    private function format_admin_payment($row)
    {
        $student_id = $this->first_non_empty(array(
            isset($row['matric_number']) ? $row['matric_number'] : null,
            isset($row['admission_number']) ? $row['admission_number'] : null,
            isset($row['student_id']) ? $row['student_id'] : null,
        ));
        $program = $this->first_non_empty(array(
            isset($row['programme_name']) ? $row['programme_name'] : null,
            isset($row['rule_program']) ? $row['rule_program'] : null,
        ));
        $date = $this->first_non_empty(array(
            isset($row['paid_at']) ? $row['paid_at'] : null,
            isset($row['created_at']) ? $row['created_at'] : null,
        ));

        return array(
            'id' => isset($row['id']) ? $row['id'] : '',
            'studentId' => $student_id ?: '',
            'student_id' => $student_id ?: '',
            'studentName' => isset($row['full_name']) && $row['full_name'] ? $row['full_name'] : 'Unknown Student',
            'student_name' => isset($row['full_name']) ? $row['full_name'] : '',
            'studentEmail' => isset($row['email']) ? $row['email'] : '',
            'program' => $program ?: 'N/A',
            'programme' => $program ?: 'N/A',
            'type' => isset($row['invoice_title']) && $row['invoice_title'] ? $row['invoice_title'] : (isset($row['invoice_code']) ? $row['invoice_code'] : 'Fee Payment'),
            'amount' => isset($row['amount']) ? (float) $row['amount'] : 0,
            'method' => $this->format_payment_method(isset($row['method']) ? $row['method'] : ''),
            'reference' => isset($row['reference']) ? $row['reference'] : '',
            'receiptNo' => isset($row['receipt_no']) ? $row['receipt_no'] : '',
            'invoiceId' => isset($row['invoice_code']) ? $row['invoice_code'] : '',
            'status' => $this->normalize_admin_payment_status(isset($row['status']) ? $row['status'] : 'pending'),
            'date' => $date ? substr($date, 0, 10) : null,
            'createdAt' => isset($row['created_at']) ? $row['created_at'] : null,
            'paidAt' => isset($row['paid_at']) ? $row['paid_at'] : null,
        );
    }

    private function count_affected_students($rule)
    {
        if (!$this->db->table_exists('students')) {
            return 0;
        }

        $type = $this->normalize_type(isset($rule['invoice_type']) ? $rule['invoice_type'] : 'general');
        if ($type === 'individual') {
            return !empty($rule['student_id']) ? 1 : 0;
        }

        $this->db->from('students s');
        if ($this->db->table_exists('programmes')) {
            $this->db->join('programmes p', 'p.id = s.programme_id', 'left');
        }
        if ($this->db->table_exists('departments')) {
            $this->db->join('departments d', 'd.id = s.department_id', 'left');
        }
        $this->db->where('s.status', 'active');

        if ($type === 'specific') {
            if (!empty($rule['target_program']) && strtolower($rule['target_program']) !== 'all programs') {
                $this->db->group_start();
                $this->db->where('p.name', $rule['target_program']);
                $this->db->or_where('p.code', $rule['target_program']);
                $this->db->group_end();
            }
            if (!empty($rule['target_department'])) {
                $this->db->group_start();
                $this->db->where('d.name', $rule['target_department']);
                $this->db->or_where('d.code', $rule['target_department']);
                $this->db->group_end();
            }
            if (!empty($rule['target_level']) && strtolower($rule['target_level']) !== 'all levels') {
                $this->db->where('s.current_level', $rule['target_level']);
            }
        }

        return (int) $this->db->count_all_results();
    }

    private function ensure_payment_tables()
    {
        $this->db->query("
            CREATE TABLE IF NOT EXISTS `student_fee_payments` (
              `id` CHAR(36) NOT NULL,
              `student_id` CHAR(36) NULL,
              `user_id` CHAR(36) NULL,
              `invoice_rule_id` CHAR(36) NULL,
              `invoice_code` VARCHAR(50) NOT NULL,
              `amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
              `method` VARCHAR(30) NOT NULL DEFAULT 'wallet',
              `reference` VARCHAR(100) NOT NULL,
              `receipt_no` VARCHAR(50) NOT NULL,
              `status` VARCHAR(30) NOT NULL DEFAULT 'completed',
              `paid_at` DATETIME NOT NULL,
              `created_at` DATETIME NOT NULL,
              `raw_payload` MEDIUMTEXT NULL,
              PRIMARY KEY (`id`),
              UNIQUE KEY `uq_student_fee_payments_reference` (`reference`),
              UNIQUE KEY `uq_student_fee_payments_receipt` (`receipt_no`),
              KEY `idx_student_fee_payments_student` (`student_id`),
              KEY `idx_student_fee_payments_rule` (`invoice_rule_id`),
              KEY `idx_student_fee_payments_code` (`invoice_code`),
              KEY `idx_student_fee_payments_status` (`status`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        if (!$this->db->field_exists('updated_at', $this->payments_table)) {
            $this->db->query("ALTER TABLE `{$this->payments_table}` ADD COLUMN `updated_at` DATETIME NULL AFTER `created_at`");
        }
        if (!$this->db->field_exists('reviewed_at', $this->payments_table)) {
            $this->db->query("ALTER TABLE `{$this->payments_table}` ADD COLUMN `reviewed_at` DATETIME NULL AFTER `updated_at`");
        }
        if (!$this->db->field_exists('reviewed_by', $this->payments_table)) {
            $this->db->query("ALTER TABLE `{$this->payments_table}` ADD COLUMN `reviewed_by` CHAR(36) NULL AFTER `reviewed_at`");
        }

        $this->db->query("
            CREATE TABLE IF NOT EXISTS `student_wallet_transactions` (
              `id` CHAR(36) NOT NULL,
              `student_id` CHAR(36) NULL,
              `user_id` CHAR(36) NULL,
              `transaction_type` VARCHAR(20) NOT NULL,
              `amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
              `reference` VARCHAR(100) NOT NULL,
              `description` VARCHAR(255) NOT NULL,
              `method` VARCHAR(30) NULL,
              `invoice_code` VARCHAR(50) NULL,
              `status` VARCHAR(30) NOT NULL DEFAULT 'completed',
              `created_at` DATETIME NOT NULL,
              PRIMARY KEY (`id`),
              KEY `idx_student_wallet_transactions_student` (`student_id`),
              KEY `idx_student_wallet_transactions_reference` (`reference`),
              KEY `idx_student_wallet_transactions_invoice` (`invoice_code`),
              KEY `idx_student_wallet_transactions_type` (`transaction_type`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    private function get_student_for_user($user)
    {
        if (!$user || !$this->db->table_exists('students')) {
            return null;
        }
        $this->load->model('Student_model');
        if (isset($this->Student_model) && method_exists($this->Student_model, 'ensure_student_levels_synced')) {
            $this->Student_model->ensure_student_levels_synced();
        }

        $this->db->select('s.id, s.user_id, s.admission_id, s.programme_id, s.department_id, s.current_level, s.status');
        if ($this->db->table_exists('users')) {
            $this->db->select('u.full_name, u.email');
        }
        if ($this->db->table_exists('programmes')) {
            $this->db->select('p.name as programme_name, p.code as programme_code');
        }
        if ($this->db->table_exists('departments')) {
            $this->db->select('d.name as department_name, d.code as department_code');
        }
        if ($this->db->table_exists('admissions')) {
            $this->db->select('a.matric_number, a.admission_number');
        }

        $this->db->from('students s');
        if ($this->db->table_exists('users')) {
            $this->db->join('users u', 'u.id = s.user_id', 'left');
        }
        if ($this->db->table_exists('programmes')) {
            $this->db->join('programmes p', 'p.id = s.programme_id', 'left');
        }
        if ($this->db->table_exists('departments')) {
            $this->db->join('departments d', 'd.id = s.department_id', 'left');
        }
        if ($this->db->table_exists('admissions')) {
            $this->db->join('admissions a', 'a.id = s.admission_id', 'left');
        }

        if (!empty($user['id'])) {
            $this->db->where('s.user_id', $user['id']);
        } elseif (!empty($user['email']) && $this->db->table_exists('users')) {
            $this->db->where('u.email', $user['email']);
        } else {
            return null;
        }

        return $this->db->get()->row_array();
    }

    private function invoice_applies_to_student($rule, $student)
    {
        if (!$student) {
            return false;
        }

        $type = $this->normalize_type(isset($rule['invoice_type']) ? $rule['invoice_type'] : 'general');
        $student_status = strtolower((string) (isset($student['status']) ? $student['status'] : ''));
        if ($type !== 'individual' && $student_status !== 'active') {
            return false;
        }

        if ($type === 'general') {
            return true;
        }

        if ($type === 'individual') {
            $student_id = isset($student['id']) ? $student['id'] : null;
            $student_email = isset($student['email']) ? strtolower((string) $student['email']) : '';
            $rule_student_id = isset($rule['student_id']) ? $rule['student_id'] : null;
            $rule_student_email = isset($rule['student_email']) ? strtolower((string) $rule['student_email']) : '';
            return ($rule_student_id && $student_id && $rule_student_id === $student_id)
                || ($rule_student_email !== '' && $student_email !== '' && $rule_student_email === $student_email);
        }

        $program = isset($rule['target_program']) ? $rule['target_program'] : null;
        $department = isset($rule['target_department']) ? $rule['target_department'] : null;
        $level = isset($rule['target_level']) ? $rule['target_level'] : null;

        return $this->matches_target($program, array(
            isset($student['programme_name']) ? $student['programme_name'] : null,
            isset($student['programme_code']) ? $student['programme_code'] : null,
        ), array('all programs', 'all programme', 'all programmes'))
            && $this->matches_target($department, array(
                isset($student['department_name']) ? $student['department_name'] : null,
                isset($student['department_code']) ? $student['department_code'] : null,
            ), array('all departments', 'all department'))
            && $this->matches_target($level, array(
                isset($student['current_level']) ? $student['current_level'] : null,
            ), array('all levels', 'all level'));
    }

    private function matches_target($target, $values, $all_values)
    {
        $target = strtolower(trim((string) $target));
        if ($target === '' || in_array($target, $all_values, true)) {
            return true;
        }

        foreach ($values as $value) {
            if ($value !== null && strtolower(trim((string) $value)) === $target) {
                return true;
            }
        }

        return false;
    }

    private function completed_payments_by_rule($student)
    {
        $payments = array();
        $this->db->where('student_id', $student['id']);
        $this->db->where_in('status', array('completed', 'success', 'successful', 'paid'));
        $rows = $this->db->get($this->payments_table)->result_array();
        foreach ($rows as $row) {
            if (!empty($row['invoice_rule_id'])) {
                $payments[$row['invoice_rule_id']] = $row;
            }
        }
        return $payments;
    }

    private function completed_payment_for_rule($student, $rule_id)
    {
        $this->db->where('student_id', $student['id']);
        $this->db->where('invoice_rule_id', $rule_id);
        $this->db->where_in('status', array('completed', 'success', 'successful', 'paid'));
        return $this->db->get($this->payments_table, 1)->row_array();
    }

    private function student_wallet_balance($student)
    {
        $this->db->select("
            COALESCE(SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE -amount END), 0) as balance
        ", false);
        $this->db->where('student_id', $student['id']);
        $this->db->where_in('status', array('completed', 'success', 'successful', 'paid'));
        $row = $this->db->get($this->wallet_table)->row_array();
        return $row && isset($row['balance']) ? (float) $row['balance'] : 0.0;
    }

    private function student_transactions($student)
    {
        $this->db->where('student_id', $student['id']);
        $this->db->order_by('created_at', 'DESC');
        $rows = $this->db->get($this->wallet_table)->result_array();
        $transactions = array();
        foreach ($rows as $row) {
            $transactions[] = array(
                'id' => $row['id'],
                'type' => $row['transaction_type'],
                'amount' => (float) $row['amount'],
                'date' => isset($row['created_at']) ? substr($row['created_at'], 0, 10) : null,
                'reference' => $row['reference'],
                'description' => $row['description'],
                'status' => $this->normalize_payment_status($row['status']),
            );
        }
        return $transactions;
    }

    private function student_receipts($student)
    {
        $this->db->where('student_id', $student['id']);
        $this->db->where_in('status', array('completed', 'success', 'successful', 'paid'));
        $this->db->order_by('paid_at', 'DESC');
        $rows = $this->db->get($this->payments_table)->result_array();
        $receipts = array();
        foreach ($rows as $row) {
            $receipts[] = array(
                'id' => $row['receipt_no'],
                'invoiceId' => $row['invoice_code'],
                'title' => $this->receipt_title($row['invoice_rule_id'], $row['invoice_code']),
                'amount' => (float) $row['amount'],
                'date' => isset($row['paid_at']) ? substr($row['paid_at'], 0, 10) : null,
                'reference' => $row['reference'],
                'method' => ucfirst($row['method']),
            );
        }
        return $receipts;
    }

    private function format_student_invoice($rule, $is_paid)
    {
        $status = $is_paid ? 'paid' : 'pending';
        if (!$is_paid && !empty($rule['due_date']) && $rule['due_date'] < date('Y-m-d')) {
            $status = 'overdue';
        }

        return array(
            'id' => $rule['invoice_code'],
            'ruleId' => $rule['id'],
            'title' => $rule['title'],
            'description' => isset($rule['description']) ? $rule['description'] : '',
            'amount' => (float) $rule['amount'],
            'items' => $this->get_items($rule['id']),
            'dueDate' => isset($rule['due_date']) ? $rule['due_date'] : null,
            'status' => $status,
        );
    }

    private function receipt_title($rule_id, $fallback)
    {
        if ($rule_id) {
            $row = $this->db->get_where($this->rules_table, array('id' => $rule_id), 1)->row_array();
            if ($row && isset($row['title'])) {
                return $row['title'];
            }
        }
        return $fallback;
    }

    private function record_wallet_transaction($student, $type, $amount, $reference, $description, $method, $invoice_code)
    {
        $this->db->insert($this->wallet_table, array(
            'id' => $this->generate_uuid(),
            'student_id' => $student['id'],
            'user_id' => isset($student['user_id']) ? $student['user_id'] : null,
            'transaction_type' => $type,
            'amount' => $amount,
            'reference' => $reference,
            'description' => $description,
            'method' => $method,
            'invoice_code' => $invoice_code,
            'status' => 'completed',
            'created_at' => date('Y-m-d H:i:s'),
        ));
    }

    private function normalize_payment_method($method)
    {
        $method = strtolower(trim((string) $method));
        return in_array($method, array('wallet', 'bank', 'card'), true) ? $method : 'wallet';
    }

    private function normalize_payment_status($status)
    {
        $status = strtolower(trim((string) $status));
        return in_array($status, array('completed', 'success', 'successful', 'paid'), true) ? 'completed' : 'pending';
    }

    private function payment_reference($method)
    {
        return 'MCCAS/' . strtoupper($method) . '/' . date('YmdHis') . mt_rand(100, 999);
    }

    private function next_receipt_no()
    {
        $this->db->like('receipt_no', 'RCPT-' . date('Y') . '-', 'after');
        $count = $this->db->count_all_results($this->payments_table);
        return 'RCPT-' . date('Y') . '-' . str_pad((string) ($count + 1), 5, '0', STR_PAD_LEFT);
    }

    private function normalize_items($items)
    {
        if (!is_array($items)) {
            return array();
        }

        $normalized = array();
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            $description = trim((string) $this->value($item, array('description', 'name', 'title'), ''));
            $amount = (float) $this->value($item, array('amount'), 0);
            if ($description !== '' && $amount > 0) {
                $normalized[] = array(
                    'description' => $description,
                    'amount' => $amount,
                );
            }
        }

        return $normalized;
    }

    private function items_total($items)
    {
        $total = 0.0;
        foreach ($items as $item) {
            $total += (float) $item['amount'];
        }
        return $total;
    }

    private function replace_items($rule_id, $items, $user_id = null)
    {
        $this->db->delete($this->items_table, array('rule_id' => $rule_id));
        foreach ($items as $index => $item) {
            $this->db->insert($this->items_table, array(
                'id' => $this->generate_uuid(),
                'rule_id' => $rule_id,
                'description' => $item['description'],
                'amount' => $item['amount'],
                'sort_order' => $index + 1,
                'created_at' => date('Y-m-d H:i:s'),
                'created_by' => $user_id,
            ));
        }
    }

    private function get_items($rule_id)
    {
        if (!$this->db->table_exists($this->items_table)) {
            return array();
        }
        $this->db->where('rule_id', $rule_id);
        $this->db->order_by('sort_order', 'ASC');
        $rows = $this->db->get($this->items_table)->result_array();
        $items = array();
        foreach ($rows as $row) {
            $items[] = array(
                'description' => $row['description'],
                'amount' => (float) $row['amount'],
            );
        }
        return $items;
    }

    private function get_student($student_id)
    {
        if (!$this->db->table_exists('students')) {
            return null;
        }
        $this->db->select('s.id, s.current_level, u.full_name, u.email, p.name as programme_name');
        $this->db->from('students s');
        $this->db->join('users u', 'u.id = s.user_id', 'left');
        $this->db->join('programmes p', 'p.id = s.programme_id', 'left');
        $this->db->where('s.id', $student_id);
        return $this->db->get()->row_array();
    }

    private function next_invoice_code($type)
    {
        $prefix = $type === 'specific' ? 'SPC' : ($type === 'individual' ? 'IND' : 'GEN');
        $this->db->like('invoice_code', $prefix . '-', 'after');
        $count = $this->db->count_all_results($this->rules_table);
        return $prefix . '-' . str_pad((string) ($count + 1), 3, '0', STR_PAD_LEFT);
    }

    private function normalize_type($type)
    {
        $type = strtolower(trim((string) $type));
        return in_array($type, array('general', 'specific', 'individual'), true) ? $type : 'general';
    }

    private function normalize_status($status)
    {
        $status = strtolower(trim((string) $status));
        if ($status === 'active' || $status === 'sent') {
            return 'published';
        }
        return in_array($status, array('draft', 'published', 'paid', 'overdue', 'pending'), true) ? $status : 'draft';
    }

    private function normalize_admin_payment_status($status)
    {
        $status = strtolower(trim((string) $status));
        if (in_array($status, array('completed', 'complete', 'success', 'successful', 'paid', 'approved', 'approve'), true)) {
            return 'completed';
        }
        if (in_array($status, array('failed', 'fail', 'rejected', 'reject', 'cancelled', 'canceled'), true)) {
            return 'failed';
        }
        return 'pending';
    }

    private function format_payment_method($method)
    {
        $method = strtolower(trim((string) $method));
        if ($method === 'bank') {
            return 'Bank Transfer';
        }
        if ($method === 'card') {
            return 'Card Payment';
        }
        if ($method === 'wallet') {
            return 'Wallet';
        }
        return $method ? ucwords(str_replace('_', ' ', $method)) : 'N/A';
    }

    private function first_non_empty($values)
    {
        if (!is_array($values)) {
            return null;
        }

        foreach ($values as $value) {
            if ($value !== null && $value !== '') {
                return $value;
            }
        }

        return null;
    }

    private function encode_list($value)
    {
        if (is_array($value)) {
            return json_encode(array_values($value));
        }
        if ($value === null || $value === '') {
            return null;
        }
        return json_encode(array_map('trim', explode(',', (string) $value)));
    }

    private function decode_list($value, $fallback = array())
    {
        if (!$value) {
            return $fallback;
        }
        $decoded = json_decode($value, true);
        if (is_array($decoded)) {
            return $decoded;
        }
        return array_map('trim', explode(',', (string) $value));
    }

    private function value($payload, $keys, $default = null)
    {
        foreach ($keys as $key) {
            if (is_array($payload) && array_key_exists($key, $payload) && $payload[$key] !== '') {
                return $payload[$key];
            }
        }
        return $default;
    }

    private function generate_uuid()
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}

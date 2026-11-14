<?php
if (!defined('BASEPATH')) exit('No direct script access allowed');

class MonthlySalary extends CI_Controller {
    public function __construct()
    {
        parent::__construct();
        $this->load->database();
        $this->load->model('MonthlySalary_model');
        $this->load->model('Staff_model');
    }

    public function list()
    {
        $this->send_cors_headers();
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            return $this->json_response(200, array('status' => 'success', 'message' => 'Preflight OK'));
        }

        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        $month = $this->input->get('month');
        if ($month) {
            $month_value = $this->normalize_month($month);
            if ($month_value === null) {
                return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid month. Use YYYY-MM.' ));
            }
            $this->db->where('month', $month_value);
        }

        $query = $this->db->get('monthly_salary');
        $rows = $query->result_array();

        return $this->json_response(200, array('status' => 'success', 'data' => $rows));
    }

    public function generate()
    {
        $this->send_cors_headers();
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            return $this->json_response(200, array('status' => 'success', 'message' => 'Preflight OK'));
        }

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }

        $input = json_decode($this->input->raw_input_stream, true);
        if (!is_array($input)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid JSON payload.'));
        }

        $month_value = isset($input['month']) ? $this->normalize_month($input['month']) : null;
        if ($month_value === null) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Missing or invalid month. Use YYYY-MM.' ));
        }

        $deductions_map = isset($input['deductions']) && is_array($input['deductions']) ? $input['deductions'] : array();

        $staff_rows = $this->db->get('staff')->result_array();
        if (empty($staff_rows)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'No staff records found.'));
        }

        $staff_ids = array();
        foreach ($staff_rows as $row) {
            if (isset($row['staff_id'])) {
                $staff_ids[] = $row['staff_id'];
            }
        }

        $month_date = $month_value . '-01';
        $history_by_staff = $this->Staff_model->latest_history_for_month($staff_ids, $month_date);

        $salary_rows = $this->db->get('salary')->result_array();
        $salary_by_grade = array();
        foreach ($salary_rows as $row) {
            $grade_key = strtolower(trim((string)$row['grade']));
            if ($grade_key !== '') {
                $salary_by_grade[$grade_key] = $row;
            }
        }

        $rows_to_insert = array();

        foreach ($staff_rows as $staff) {
            $staff_id = $staff['staff_id'];
            $history = isset($history_by_staff[$staff_id]) ? $history_by_staff[$staff_id] : null;

            $grade_source = $history && isset($history['grade']) ? $history['grade'] : (isset($staff['grade']) ? $staff['grade'] : null);
            $grade_key = strtolower(trim((string)$grade_source));
            $salary = isset($salary_by_grade[$grade_key]) ? $salary_by_grade[$grade_key] : null;

            $annual_basic = $history && isset($history['basic_salary']) ? (float)$history['basic_salary'] : ($salary ? (float)$salary['basic_salary'] : 0.00);
            $annual_housing = $history && isset($history['housing_allowance']) ? (float)$history['housing_allowance'] : ($salary ? (float)$salary['housing_allowance'] : 0.00);
            $annual_transport = $history && isset($history['transport_allowance']) ? (float)$history['transport_allowance'] : ($salary ? (float)$salary['transport_allowance'] : 0.00);
            $annual_utility = $history && isset($history['utility_allowance']) ? (float)$history['utility_allowance'] : ($salary ? (float)$salary['utility_allowance'] : 0.00);
            $annual_employer_pension = $history && isset($history['employer_pension']) ? (float)$history['employer_pension'] : ($salary ? (float)$salary['employer_pension'] : 0.00);
            $annual_leave_allowance = $history && isset($history['leave_allowance']) ? (float)$history['leave_allowance'] : ($salary ? (float)$salary['leave_allowance'] : 0.00);
            $annual_teaching_allowance = $history && isset($history['teaching_allowance']) ? (float)$history['teaching_allowance'] : ($salary ? (float)$salary['teaching_allowance'] : 0.00);

            // Treat fixed_allowance as combined leave + teaching allowances spread monthly.
            $monthly_fixed = ($annual_leave_allowance + $annual_teaching_allowance) / 12.0;

            $monthly_basic = $annual_basic / 12.0;
            $monthly_housing = $annual_housing / 12.0;
            $monthly_transport = $annual_transport / 12.0;
            $monthly_utility = $annual_utility / 12.0;
            $monthly_employer_pension = $annual_employer_pension / 12.0;

            $staff_deductions = isset($deductions_map[$staff_id]) && is_array($deductions_map[$staff_id])
                ? $deductions_map[$staff_id] : array();

            $penalty = array_key_exists('penalty', $staff_deductions) ? $this->num_value($staff_deductions, 'penalty') : ($history && isset($history['penalty']) ? (float)$history['penalty'] : 0.00);
            $paye = array_key_exists('paye', $staff_deductions) ? $this->num_value($staff_deductions, 'paye') : ($history && isset($history['paye']) ? (float)$history['paye'] : 0.00);
            $standing_order = array_key_exists('standing_order', $staff_deductions) ? $this->num_value($staff_deductions, 'standing_order') : ($history && isset($history['standing_order']) ? (float)$history['standing_order'] : 0.00);
            $loan_repayment = array_key_exists('loan_repayment', $staff_deductions) ? $this->num_value($staff_deductions, 'loan_repayment') : ($history && isset($history['loan_repayment']) ? (float)$history['loan_repayment'] : 0.00);
            $cooperative = array_key_exists('cooperative_deduction', $staff_deductions) ? $this->num_value($staff_deductions, 'cooperative_deduction') : ($history && isset($history['cooperative_deduction']) ? (float)$history['cooperative_deduction'] : 0.00);
            $arrears = array_key_exists('arrears', $staff_deductions) ? $this->num_value($staff_deductions, 'arrears') : ($history && isset($history['arrears']) ? (float)$history['arrears'] : 0.00);

            $gross = $monthly_fixed + $monthly_basic + $monthly_housing + $monthly_transport + $monthly_utility + $monthly_employer_pension + $arrears;

            $employer_pension_deduction = $monthly_employer_pension;
            $employee_pension_deduction = 0.08 * ($monthly_basic + $monthly_housing + $monthly_transport);

            $total_deduction = $penalty + $employer_pension_deduction + $employee_pension_deduction + $paye + $standing_order + $loan_repayment + $cooperative;
            $net_pay = $gross - $total_deduction;

            $rows_to_insert[] = array(
                'month' => $month_value,
                'staff_id' => $staff_id,
                'staff_name' => $history && isset($history['staff_name']) ? $history['staff_name'] : $staff['staff_name'],
                'rank' => $history && isset($history['rank']) ? $history['rank'] : (isset($staff['rank']) ? $staff['rank'] : null),
                'division' => $history && isset($history['division']) ? $history['division'] : (isset($staff['division']) ? $staff['division'] : null),
                'grade' => $grade_source,
                'fixed_allowance' => round($monthly_fixed, 2),
                'basic_salary' => round($monthly_basic, 2),
                'housing_allowance' => round($monthly_housing, 2),
                'transport_allowance' => round($monthly_transport, 2),
                'utility_allowance' => round($monthly_utility, 2),
                'employer_pension' => round($monthly_employer_pension, 2),
                'arrears' => round($arrears, 2),
                'gross' => round($gross, 2),
                'penalty' => round($penalty, 2),
                'employer_pension_deduction' => round($employer_pension_deduction, 2),
                'employee_pension_deduction' => round($employee_pension_deduction, 2),
                'paye' => round($paye, 2),
                'standing_order' => round($standing_order, 2),
                'loan_repayment' => round($loan_repayment, 2),
                'cooperative_deduction' => round($cooperative, 2),
                'total_deduction' => round($total_deduction, 2),
                'net_pay' => round($net_pay, 2)
            );
        }

        $inserted = $this->MonthlySalary_model->replace_batch($rows_to_insert, $month_value);
        if ($inserted <= 0) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Failed to generate monthly payroll.'));
        }

        return $this->json_response(201, array(
            'status' => 'success',
            'message' => 'Monthly payroll generated.',
            'data' => array('inserted' => $inserted, 'month' => $month_value)
        ));
    }

    private function normalize_month($month)
    {
        if (!is_string($month)) {
            return null;
        }
        $month = trim($month);
        if (!preg_match('/^(20\d{2})-(0[1-9]|1[0-2])$/', $month)) {
            return null;
        }
        return $month;
    }

    private function num_value($arr, $key)
    {
        if (isset($arr[$key]) && $arr[$key] !== '' && $arr[$key] !== null) {
            return (float)$arr[$key];
        }
        return 0.00;
    }

    private function json_response($status, $payload)
    {
        $this->send_cors_headers();
        $this->output
            ->set_status_header($status)
            ->set_content_type('application/json')
            ->set_output(json_encode($payload));
        return;
    }

    private function send_cors_headers()
    {
        header('Vary: Origin');
    }
}

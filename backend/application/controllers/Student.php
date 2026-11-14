<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Student extends CI_Controller {
    public function __construct()
    {
        parent::__construct();
        $this->load->database();
        $this->load->model('User_model');
        $this->load->model('Student_model');
        $this->load->model('Courses_model');
        $this->load->model('Fee_model');
    }

    // Get student profile (requires user ID from session, header, or query param)
    public function profile()
    {
        if (!in_array($_SERVER['REQUEST_METHOD'], array('GET', 'POST', 'PUT', 'PATCH'), true)) {
            return $this->json_response(405, array(
                'status' => 'error',
                'message' => 'Method not allowed'
            ));
        }

        $user = $this->resolve_user();
        if (!$user) {
            return $this->json_response(404, array(
                'status' => 'error',
                'message' => 'User not found.'
            ));
        }

        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $payload = $this->json_payload();
            $result = $this->Student_model->update_student_profile_by_user($user['id'], $payload);
            if (isset($result['error'])) {
                return $this->json_response(isset($result['code']) ? $result['code'] : 400, array(
                    'status' => 'error',
                    'message' => $result['error'],
                ));
            }

            return $this->json_response(200, array(
                'status' => 'success',
                'message' => 'Profile updated successfully.',
                'data' => $this->build_profile_payload(
                    isset($result['data']) && is_array($result['data']) ? $result['data'] : $user
                ),
            ));
        }

        $application_id = $this->resolve_application_no($user);
        $profile = $this->Student_model->get_profile_by_user_id($user['id']);
        if (!$profile) {
            $profile = $user;
        }
        $data = $this->build_profile_payload($profile);
        $data['application_id'] = $application_id;

        return $this->json_response(200, array(
            'status' => 'success',
            'data' => $data
        ));
    }

    // List active programmes grouped by department for student selection
    public function programmes()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array(
                'status' => 'error',
                'message' => 'Method not allowed'
            ));
        }

        if (!$this->Courses_model->programme_tables_ready()) {
            return $this->json_response(404, array(
                'status' => 'error',
                'message' => 'Programme tables not found'
            ));
        }

        $this->Courses_model->ensure_default_degree_catalogue();
        $activeSession = $this->Courses_model->get_active_session();

        $departments = $this->Courses_model->get_departments();
        $programmes = $this->Courses_model->get_programmes(null, true); // active only when column exists

        $grouped = array();
        foreach ($departments as $dept) {
            $grouped[$dept['id']] = array(
                'department_id' => $dept['id'],
                'department_name' => $dept['name'],
                'department_code' => isset($dept['code']) ? $dept['code'] : null,
                'programmes' => array(),
            );
        }

        foreach ($programmes as $prog) {
            $deptId = isset($prog['department_id']) ? $prog['department_id'] : null;
            if (!$deptId || !isset($grouped[$deptId])) {
                continue;
            }
            $grouped[$deptId]['programmes'][] = array(
                'id' => isset($prog['id']) ? $prog['id'] : null,
                'code' => isset($prog['code']) ? $prog['code'] : null,
                'name' => isset($prog['name']) ? $prog['name'] : null,
            );
        }

        // Only return departments that have at least one programme
        $result = array_values(array_filter($grouped, function ($item) {
            return !empty($item['programmes']);
        }));

        return $this->json_response(200, array(
            'status' => 'success',
            'data' => $result,
            'meta' => array('active_session' => $activeSession),
        ));
    }

    // Get application progress
    public function progress()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array(
                'status' => 'error',
                'message' => 'Method not allowed'
            ));
        }

        $user = $this->resolve_user();
        if (!$user) {
            return $this->json_response(404, array(
                'status' => 'error',
                'message' => 'User not found.'
            ));
        }

        $application = $this->resolve_application($user);
        $applicant = $this->resolve_applicant($user);

        $nin_verified = !empty($user['nin']) || (!empty($applicant) && !empty($applicant['nin']));

        // Derive state from the latest application record
        $application_status = $application && isset($application['status'])
            ? $application['status']
            : 'draft';
        $form_submitted = $application_status !== 'draft';

        // Optional: consider payment status if present on the applications table
        $payment_paid = false;
        if ($application && isset($application['payment_status'])) {
            $payment_paid = in_array($application['payment_status'], array('paid', 'successful', 'completed'), true);
        }
        if (!$payment_paid) {
            $payment_paid = $this->has_verified_application_fee_payment($user);
        }

        $steps = array(
            array('name' => 'Account Created', 'completed' => true),
            array('name' => 'Email Verified', 'completed' => isset($user['email_verified']) ? (bool) $user['email_verified'] : true),
            array('name' => 'Application Fee', 'completed' => $payment_paid),
            array('name' => 'NIN Verified', 'completed' => $nin_verified),
            array('name' => 'Form Submitted', 'completed' => $application_status !== 'draft'),
            array('name' => 'Under Review', 'completed' => in_array($application_status, array('under_review', 'review', 'processing', 'admitted', 'rejected'), true)),
            array('name' => 'Decision', 'completed' => in_array($application_status, array('admitted', 'rejected'), true))
        );

        $current_step = 1;
        foreach ($steps as $index => $step) {
            if ($step['completed']) {
                $current_step = $index + 1;
            }
        }

        return $this->json_response(200, array(
            'status' => 'success',
            'data' => array(
                'current_step' => $current_step,
                'steps' => $steps,
                'is_submitted' => $form_submitted,
                'status' => $application ? $application['status'] : 'draft',
                'application_no' => $application ? $application['application_no'] : $this->resolve_application_no($user)
            )
        ));
    }

    // Get admission status details
    public function admission_status()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array(
                'status' => 'error',
                'message' => 'Method not allowed'
            ));
        }

        $user = $this->resolve_user();
        if (!$user) {
            return $this->json_response(404, array(
                'status' => 'error',
                'message' => 'User not found.'
            ));
        }

        $application = $this->resolve_application($user);
        $applicant = $this->resolve_applicant($user);
        $payload = $this->decode_payload($application && isset($application['payload']) ? $application['payload'] : null);

        $status = $this->normalize_admission_status($application ? $application['status'] : null);
        $appliedAt = $application && isset($application['applied_at']) ? $application['applied_at'] : null;
        $updatedAt = $application && isset($application['updated_at']) ? $application['updated_at'] : null;

        $programme = null;
        $department = null;
        $programmeId = $application && isset($application['programme_id']) ? $application['programme_id'] : null;
        $programmeCode = $this->array_get($payload, 'academic.firstChoiceProgram');

        if ($programmeId && $this->db->table_exists('programmes')) {
            $programme = $this->db->get_where('programmes', array('id' => $programmeId), 1)->row_array();
        } elseif ($programmeCode && $this->db->table_exists('programmes')) {
            $programme = $this->db->get_where('programmes', array('code' => $programmeCode), 1)->row_array();
        }

        if ($programme && isset($programme['department_id']) && $this->db->table_exists('departments')) {
            $department = $this->db->get_where('departments', array('id' => $programme['department_id']), 1)->row_array();
        }

        $qualificationUsed = $this->first_non_empty(array(
            $this->array_get($payload, 'academic.qualificationUsed'),
            $this->array_get($payload, 'academic.qualification'),
            $this->array_get($payload, 'academic.entryQualification')
        ));

        $this->ensure_admissions_columns();
        $admission = null;
        if ($application && isset($application['id']) && $this->db->table_exists('admissions')) {
            $admission = $this->db->get_where('admissions', array('application_id' => $application['id']), 1)->row_array();
        }

        $sessionName = null;
        $sessionId = $admission && isset($admission['session_id']) ? $admission['session_id'] : null;
        if (!$sessionId && $application && isset($application['session_id'])) {
            $sessionId = $application['session_id'];
        }
        if ($sessionId) {
            $sessionName = $this->resolve_session_name($sessionId);
        }
        if (!$sessionName) {
            $sessionName = $this->array_get($payload, 'academic.applicationSession');
        }

        $admissionDate = $admission && isset($admission['admission_date']) ? $admission['admission_date'] : null;
        $decisionDate = $admissionDate ? $admissionDate : $updatedAt;

        $reviewStages = $this->build_review_stages($status, $appliedAt, $updatedAt, $decisionDate);

        $applicantName = $this->first_non_empty(array(
            $applicant && isset($applicant['full_name']) ? $applicant['full_name'] : null,
            $this->combine_names($applicant),
            $this->combine_names($this->array_get($payload, 'personal', array()))
        ));

        $programApplied = $this->first_non_empty(array(
            $programme && isset($programme['name']) ? $programme['name'] : null,
            $programmeCode,
            $this->array_get($payload, 'academic.firstChoiceProgram')
        ));

        $departmentName = $department && isset($department['name']) ? $department['name'] : null;

        $level = $this->first_non_empty(array(
            $admission && isset($admission['level']) ? $admission['level'] : null,
            $application && isset($application['application_level']) ? $application['application_level'] : null,
            $this->array_get($payload, 'academic.entryLevel')
        ));

        $acceptanceDeadline = $admission && isset($admission['acceptance_deadline']) ? $admission['acceptance_deadline'] : null;
        $acceptanceFee = 25000;
        $acceptanceFeePaid = false;
        if ($admission && $this->db->table_exists('admissions')) {
            if ($this->db->field_exists('acceptance_fee', 'admissions') && isset($admission['acceptance_fee']) && $admission['acceptance_fee'] !== null) {
                $acceptanceFee = (int) $admission['acceptance_fee'];
            }
            if ($this->db->field_exists('acceptance_fee_paid', 'admissions') && isset($admission['acceptance_fee_paid'])) {
                $acceptanceFeePaid = (bool) $admission['acceptance_fee_paid'];
            }
        }

        $admissionDetails = array(
            'admissionNumber' => $admission && isset($admission['admission_number']) ? $admission['admission_number'] : null,
            'admissionDate' => $admissionDate,
            'programAdmitted' => $this->first_non_empty(array(
                $programme && isset($programme['name']) ? $programme['name'] : null,
                $programApplied
            )),
            'level' => $level,
            'session' => $sessionName,
            'semester' => $this->array_get($payload, 'academic.semester'),
            'acceptanceDeadline' => $acceptanceDeadline,
            'acceptanceFeePaid' => $acceptanceFeePaid,
            'acceptanceFee' => $acceptanceFee,
        );

        return $this->json_response(200, array(
            'status' => 'success',
            'data' => array(
                'applicationId' => $application && isset($application['application_no']) ? $application['application_no'] : null,
                'status' => $status,
                'appliedDate' => $appliedAt,
                'programApplied' => $programApplied,
                'department' => $departmentName,
                'qualificationUsed' => $qualificationUsed,
                'reviewStages' => $reviewStages,
                'admissionDetails' => $admissionDetails,
                'applicantName' => $applicantName,
                'hodConfirmed' => $status === 'admitted'
            )
        ));
    }

    // Mark acceptance fee as paid for the current student's admission
    public function mark_acceptance_fee_paid()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array(
                'status' => 'error',
                'message' => 'Method not allowed'
            ));
        }

        $user = $this->resolve_user();
        if (!$user) {
            return $this->json_response(404, array(
                'status' => 'error',
                'message' => 'User not found.'
            ));
        }

        if (!$this->db->table_exists('admissions')) {
            return $this->json_response(404, array(
                'status' => 'error',
                'message' => 'Admissions table not found.'
            ));
        }

        $application = $this->resolve_application($user);
        if (!$application || !isset($application['id'])) {
            return $this->json_response(404, array(
                'status' => 'error',
                'message' => 'Application not found.'
            ));
        }

        $this->ensure_admissions_columns();

        $admission = $this->db->get_where('admissions', array('application_id' => $application['id']), 1)->row_array();
        if (!$admission || !isset($admission['id'])) {
            return $this->json_response(404, array(
                'status' => 'error',
                'message' => 'Admission record not found.'
            ));
        }

        $payload = json_decode($this->input->raw_input_stream, true);
        if (!is_array($payload)) {
            $payload = array();
        }

        $updateData = array();
        if ($this->db->field_exists('acceptance_fee_paid', 'admissions')) {
            $updateData['acceptance_fee_paid'] = 1;
        }
        if ($this->db->field_exists('acceptance_fee_paid_at', 'admissions')) {
            $updateData['acceptance_fee_paid_at'] = date('Y-m-d H:i:s');
        }
        if ($this->db->field_exists('acceptance_fee', 'admissions') && isset($payload['amount'])) {
            $updateData['acceptance_fee'] = (int) $payload['amount'];
        }
        if ($this->db->field_exists('updated_at', 'admissions')) {
            $updateData['updated_at'] = date('Y-m-d H:i:s');
        }

        if (!empty($updateData)) {
            $this->db->where('id', $admission['id']);
            $this->db->update('admissions', $updateData);
        }

        return $this->json_response(200, array(
            'status' => 'success',
            'message' => 'Acceptance fee marked as paid.',
            'data' => array(
                'admission_id' => $admission['id'],
                'acceptance_fee_paid' => true,
            ),
        ));
    }

    public function payments()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array(
                'status' => 'error',
                'message' => 'Method not allowed'
            ));
        }

        $user = $this->resolve_user();
        if (!$user) {
            return $this->json_response(404, array(
                'status' => 'error',
                'message' => 'User not found.'
            ));
        }

        return $this->json_response(200, array(
            'status' => 'success',
            'data' => $this->Fee_model->student_portal($user),
        ));
    }

    public function pay_invoice()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array(
                'status' => 'error',
                'message' => 'Method not allowed'
            ));
        }

        $user = $this->resolve_user();
        if (!$user) {
            return $this->json_response(404, array(
                'status' => 'error',
                'message' => 'User not found.'
            ));
        }

        $result = $this->Fee_model->pay_student_invoice($user, $this->json_payload());
        if (isset($result['error'])) {
            return $this->json_response(isset($result['code']) ? $result['code'] : 400, array(
                'status' => 'error',
                'message' => $result['error'],
            ));
        }

        return $this->json_response(200, array(
            'status' => 'success',
            'message' => 'Payment recorded successfully.',
            'data' => $result['data'],
        ));
    }

    public function top_up_wallet()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array(
                'status' => 'error',
                'message' => 'Method not allowed'
            ));
        }

        $user = $this->resolve_user();
        if (!$user) {
            return $this->json_response(404, array(
                'status' => 'error',
                'message' => 'User not found.'
            ));
        }

        $result = $this->Fee_model->credit_student_wallet($user, $this->json_payload());
        if (isset($result['error'])) {
            return $this->json_response(isset($result['code']) ? $result['code'] : 400, array(
                'status' => 'error',
                'message' => $result['error'],
            ));
        }

        return $this->json_response(200, array(
            'status' => 'success',
            'message' => 'Wallet credited successfully.',
            'data' => $result['data'],
        ));
    }

    // Verify Paystack application fee payment before unlocking application form
    public function verify_application_fee_payment()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array(
                'status' => 'error',
                'message' => 'Method not allowed'
            ));
        }

        $payload = json_decode($this->input->raw_input_stream, true);
        if (!is_array($payload)) {
            $payload = array();
        }

        $reference = isset($payload['reference']) ? trim((string) $payload['reference']) : '';
        $amount = isset($payload['amount']) ? (int) $payload['amount'] : 0;

        if ($reference === '') {
            return $this->json_response(422, array(
                'status' => 'error',
                'message' => 'Payment reference is required.'
            ));
        }

        $user = $this->resolve_user();
        if (!$user) {
            return $this->json_response(404, array(
                'status' => 'error',
                'message' => 'User not found.'
            ));
        }

        $secretKey = (string) $this->config->item('paystack_secret_key');
        if ($secretKey === '') {
            return $this->json_response(500, array(
                'status' => 'error',
                'message' => 'Paystack secret key is not configured on the backend.'
            ));
        }

        $verification = $this->verify_paystack_reference($reference, $secretKey);
        if (!$verification['ok']) {
            return $this->json_response(502, array(
                'status' => 'error',
                'message' => $verification['message']
            ));
        }

        $transaction = $verification['data'];
        $paidAmount = isset($transaction['amount']) ? (int) $transaction['amount'] : 0;
        $paidStatus = isset($transaction['status']) ? strtolower((string) $transaction['status']) : '';
        $paidCurrency = isset($transaction['currency']) ? strtoupper((string) $transaction['currency']) : '';
        $expectedAmount = $amount > 0 ? $amount * 100 : 500000;

        if ($paidStatus !== 'success') {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => 'Paystack transaction was not successful.'
            ));
        }

        if ($paidCurrency !== '' && $paidCurrency !== 'NGN') {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => 'Invalid payment currency.'
            ));
        }

        if ($paidAmount < $expectedAmount) {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => 'Paid amount is less than the application fee.'
            ));
        }

        $this->ensure_application_tables();
        $this->ensure_application_fee_payments_table();
        $applicant = $this->resolve_applicant($user);
        $this->record_application_fee_payment($user, $reference, $paidAmount / 100, $transaction);
        if ($applicant && isset($applicant['id'])) {
            $this->ensure_application_payment_columns();
            $application = $this->resolve_application($user);
            if ($application && isset($application['id'])) {
                $update = array();
                if ($this->db->field_exists('payment_status', 'applications')) {
                    $update['payment_status'] = 'paid';
                }
                if ($this->db->field_exists('payment_reference', 'applications')) {
                    $update['payment_reference'] = $reference;
                }
                if ($this->db->field_exists('payment_amount', 'applications')) {
                    $update['payment_amount'] = $paidAmount / 100;
                }
                if ($this->db->field_exists('payment_paid_at', 'applications')) {
                    $update['payment_paid_at'] = date('Y-m-d H:i:s');
                }
                if (!empty($update)) {
                    $this->db->where('id', $application['id']);
                    $this->db->update('applications', $update);
                }
            }
        }

        return $this->json_response(200, array(
            'status' => 'success',
            'message' => 'Application fee verified.',
            'data' => array(
                'reference' => $reference,
                'application_fee_paid' => true,
                'amount' => $paidAmount / 100,
            ),
        ));
    }

    // Download course registration template form
    public function course_registration_template()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array(
                'status' => 'error',
                'message' => 'Method not allowed'
            ));
        }

        $user = $this->resolve_user();
        if (!$user || !isset($user['id'])) {
            return $this->json_response(404, array(
                'status' => 'error',
                'message' => 'User not found.'
            ));
        }

        if (!$this->db->table_exists('students')) {
            return $this->json_response(404, array(
                'status' => 'error',
                'message' => 'Student table not found.'
            ));
        }

        $student = $this->resolve_student($user['id']);
        if (!$student || !isset($student['student_id'])) {
            return $this->json_response(404, array(
                'status' => 'error',
                'message' => 'Student record not found.'
            ));
        }

        $session = $this->resolve_active_session();
        $semester = $this->resolve_current_semester();
        $sessionId = $session && isset($session['id']) ? $session['id'] : null;
        $semesterId = $semester && isset($semester['id']) ? $semester['id'] : null;

        $registration = $this->resolve_course_registration(
            $student['student_id'],
            $sessionId,
            $semesterId
        );

        $courses = $registration && isset($registration['id'])
            ? $this->resolve_registration_courses($registration['id'])
            : array();

        $this->ensure_admissions_columns();
        $this->Courses_model->ensure_programme_structure_column();
        $this->Courses_model->ensure_course_structure_columns();
        $admission = $this->resolve_admission($student);
        $placement = $this->resolve_student_course_placement($student, $admission, $session);

        $studentName = isset($user['full_name']) ? $user['full_name'] : '';
        $programmeName = isset($student['programme_name']) ? $student['programme_name'] : '';
        $departmentName = isset($student['department_name']) ? $student['department_name'] : '';
        $programmeCode = isset($student['programme_code']) ? $student['programme_code'] : '';
        $regNo = $admission && isset($admission['matric_number']) ? $admission['matric_number'] : '';
        $levelName = isset($placement['label']) ? $placement['label'] : (isset($student['current_level']) ? $student['current_level'] : '');
        $sessionName = $session && isset($session['name']) ? $session['name'] : '';
        $semesterName = $semester && isset($semester['name']) ? $semester['name'] : '';

        $fpdfPath = APPPATH . 'third_party/fpdf/fpdf.php';
        if (file_exists($fpdfPath)) {
            require_once $fpdfPath;
        }

        if (!class_exists('FPDF') && file_exists(FCPATH . 'vendor/autoload.php')) {
            require_once FCPATH . 'vendor/autoload.php';
        }

        if (!class_exists('FPDF')) {
            return $this->json_response(500, array(
                'status' => 'error',
                'message' => 'FPDF library not found. Install it via Composer (setasign/fpdf) or place fpdf.php in application/third_party/fpdf/.'
            ));
        }

        $this->load_fpdi_if_available();
        $templatePath = APPPATH . 'third_party/fpdf/templates/course_registration.pdf';
        $fpdiClass = null;
        if (class_exists('\\setasign\\Fpdi\\Fpdi')) {
            $fpdiClass = '\\setasign\\Fpdi\\Fpdi';
        } elseif (class_exists('Fpdi')) {
            $fpdiClass = 'Fpdi';
        }

        $firstSemesterCourses = array();
        $secondSemesterCourses = array();
        foreach ($courses as $row) {
            $courseSemester = strtolower(trim((string) (
                (isset($row['semesterName']) ? $row['semesterName'] : null)
                ?: (isset($row['semester']) ? $row['semester'] : '')
            )));

            if (strpos($courseSemester, 'second') !== false) {
                $secondSemesterCourses[] = $row;
            } else {
                $firstSemesterCourses[] = $row;
            }
        }

        if (empty($firstSemesterCourses)) {
            $firstSemesterCourses = $courses;
        }
        if (empty($secondSemesterCourses)) {
            $secondSemesterCourses = $courses;
        }

        $totalUnits = 0;
        foreach ($courses as $row) {
            $totalUnits += isset($row['creditUnits']) ? (int) $row['creditUnits'] : 0;
        }

        if ($fpdiClass && is_file($templatePath)) {
            $pdf = new $fpdiClass('P', 'mm', 'A4');
            $pdf->SetAutoPageBreak(false);

            $pdf->setSourceFile($templatePath);
            $templateId = $pdf->importPage(1);
            $templateSize = $pdf->getTemplateSize($templateId);
            $orientation = $templateSize['width'] > $templateSize['height'] ? 'L' : 'P';

            $pdf->AddPage($orientation, array($templateSize['width'], $templateSize['height']));
            $pdf->useTemplate($templateId, 0, 0, $templateSize['width'], $templateSize['height'], true);


                $headerTitle = trim($programmeName) !== '' ? $programmeName : $departmentName;

                $pdf->SetFont('Arial', 'B', 14);
                $pageWidth = $pdf->GetPageWidth();

                $titleText = $this->pdf_text($headerTitle);
                $titleWidth = $pdf->GetStringWidth($titleText);
                $titleX = ($pageWidth - $titleWidth) / 2;
                $pdf->SetXY($titleX + 4, 53);
                $pdf->Cell($titleWidth, 10, $titleText, 0, 0, 'C');

                // $codeText = $this->pdf_text($programmeCode);
                // $codeWidth = $pdf->GetStringWidth($codeText);
                // $codeX = ($pageWidth - $codeWidth) / 2;
                // $pdf->SetXY($codeX + 5, 65);
                // $pdf->Cell($codeWidth, 10, $codeText, 0, 0, 'C');

                // Programme Title
                // $programme = "ND in CHEW";

                // $pdf->SetFont('Arial', 'B', 14);

                // $pageWidth = $pdf->GetPageWidth();
                // $textWidth = $pdf->GetStringWidth($programme);
                // $x = ($pageWidth - $textWidth) / 2;

                // $pdf->SetXY($x+4, 53);
                // $pdf->Cell($textWidth, 10, $programme, 0, 0, 'C');

                // Programme Code
                $textWidth = $pdf->GetStringWidth($programmeCode);
                $x = ($pageWidth - $textWidth) / 2;

                $pdf->SetXY($x+5, 65);
                $pdf->Cell($textWidth, 10, $programmeCode, 0, 0, 'C');

                // Student Info
                $pdf->SetFont('Arial', 'B', 10);

                $pdf->SetXY(60, 80);
                $pdf->Cell(100, 6, $studentName, 0, 0, 'L');

                $pdf->SetXY(50, 88);
                $pdf->Cell(60, 6, $sessionName, 0, 0, 'L');

                $pdf->SetXY(150, 88);
                $pdf->Cell(50, 6, $regNo, 0, 0, 'L');

                if ($levelName !== '') {
                    $pdf->SetXY(150, 80);
                    $pdf->Cell(50, 6, $this->pdf_text($levelName), 0, 0, 'L');
                }

                // ---------------- COURSE TABLE ----------------
                $pdf->SetFont('Arial', '', 10);

                $startY = 110;
                $rowHeight = 6;
                $totalCH = 0;
                $subt = 0;
                $sn = 1;
                foreach ($firstSemesterCourses as $course) {
                    // Code
                    $pdf->SetXY(23, $startY - $subt);
                    $pdf->Cell(20, $rowHeight, $sn, 0, 0, 'L');

                    $pdf->SetXY(30, $startY - $subt);
                    $pdf->Cell(35, $rowHeight, $course['code'], 0, 0, 'L');

                    // Title
                    $pdf->SetXY(46, $startY - $subt);
                    $pdf->Cell(80, $rowHeight, $course['title'], 0, 0, 'L');

                    // CH
                    $pdf->SetXY(97.5, $startY - $subt);
                    $pdf->Cell(15, $rowHeight, $course['level'], 0, 0, 'C');

                    // $totalCH += $course['credit_units'];
                    $startY += $rowHeight;
                    $subt += .2;
                    $sn++;
                }

                $pdf->SetFont('Arial', 'B', 10);
                $pdf->SetXY(98, 226);
                $pdf->Cell(15, 6, $totalCH, 0, 0, 'C');

                // ---------------- Second semester COURSE TABLE ----------------
                $pdf->SetFont('Arial', '', 10);

                $startY = 110;
                $rowHeight = 6;
                $totalCH = 0;
                $subt = 0;
                $sn = 1;
                foreach ($secondSemesterCourses as $course) {

                    // Code
                    $pdf->SetXY(113, $startY - $subt);
                    $pdf->Cell(20, $rowHeight, $sn, 0, 0, 'L');

                    $pdf->SetXY(121, $startY - $subt);
                    $pdf->Cell(35, $rowHeight, $course['code'], 0, 0, 'L');

                    // Title
                    $pdf->SetXY(137, $startY - $subt);
                    $pdf->Cell(80, $rowHeight, $course['title'], 0, 0, 'L');

                    // CH
                    // $pdf->SetXY(188, $startY - $subt);
                    // $pdf->Cell(15, $rowHeight, $course['ch'], 0, 0, 'C');

                    // $totalCH += $course['ch'];
                    $startY += $rowHeight;
                    $subt += .2;
                    $sn++;
                }

                $pdf->SetFont('Arial', 'B', 10);
                $pdf->SetXY(188, 226);
                $pdf->Cell(15, 6, $totalCH, 0, 0, 'C');

            while (ob_get_level() > 0) {
                ob_end_clean();
            }

            header('Content-Type: application/pdf');
            header('Content-Disposition: attachment; filename="course_registration_form.pdf"');
            header('Cache-Control: no-store, no-cache, must-revalidate');

            $pdf->Output('D', 'course_registration_form.pdf');
            exit;
        }
    }

    // Get notifications
    public function notifications()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array(
                'status' => 'error',
                'message' => 'Method not allowed'
            ));
        }

        $user = $this->resolve_user();
        if (!$user) {
            return $this->json_response(404, array(
                'status' => 'error',
                'message' => 'User not found.'
            ));
        }

        return $this->json_response(200, array(
            'status' => 'success',
            'data' => array()
        ));
    }

    // Get course registration data
    public function course_registration()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array(
                'status' => 'error',
                'message' => 'Method not allowed'
            ));
        }

        $user = $this->resolve_user();
        if (!$user || !isset($user['id'])) {
            return $this->json_response(404, array(
                'status' => 'error',
                'message' => 'User not found.'
            ));
        }

        if (!$this->db->table_exists('students')) {
            return $this->json_response(404, array(
                'status' => 'error',
                'message' => 'Student table not found.'
            ));
        }

        $student = $this->resolve_student($user['id']);
        if (!$student || !isset($student['student_id'])) {
            return $this->json_response(404, array(
                'status' => 'error',
                'message' => 'Student record not found.'
            ));
        }

        $session = $this->resolve_active_session();
        $semester = $this->resolve_current_semester();
        $sessionId = $session && isset($session['id']) ? $session['id'] : null;
        $semesterId = $semester && isset($semester['id']) ? $semester['id'] : null;

        $registration = $this->resolve_course_registration(
            $student['student_id'],
            $sessionId,
            $semesterId
        );

        $registrationStatus = $registration ? (
            isset($registration['status']) && $registration['status'] === 'submitted'
                ? 'completed'
                : 'open'
        ) : 'open';

        $this->ensure_admissions_columns();
        $this->Courses_model->ensure_programme_structure_column();
        $this->Courses_model->ensure_course_structure_columns();
        $admission = $this->resolve_admission($student);
        $placement = $this->resolve_student_course_placement($student, $admission, $session);

        $studentData = array(
            'matricNumber' => $admission && isset($admission['matric_number']) ? $admission['matric_number'] : null,
            'name' => isset($user['full_name']) ? $user['full_name'] : null,
            'programme' => isset($student['programme_name']) ? $student['programme_name'] : null,
            'programmeCode' => isset($student['programme_code']) ? $student['programme_code'] : null,
            'department' => isset($student['department_name']) ? $student['department_name'] : null,
            'departmentCode' => isset($student['department_code']) ? $student['department_code'] : null,
            'level' => isset($placement['label']) ? $placement['label'] : (isset($student['current_level']) ? $student['current_level'] : null),
            'programType' => isset($placement['programme_structure']) ? $placement['programme_structure'] : null,
            'entrySession' => isset($placement['entry_session_name']) ? $placement['entry_session_name'] : null,
            'session' => $session && isset($session['name']) ? $session['name'] : null,
            'semester' => $semester && isset($semester['name']) ? $semester['name'] : null,
            'registrationStatus' => $registrationStatus,
            'acceptanceFeePaid' => $admission && isset($admission['acceptance_fee_paid'])
                ? (bool) $admission['acceptance_fee_paid']
                : false,
            'registrationFeePaid' => true,
            'maxCreditUnits' => 24,
            'minCreditUnits' => 12,
        );

        $courses = $this->resolve_available_courses(
            isset($student['programme_id']) ? $student['programme_id'] : null,
            $sessionId,
            $semesterId,
            $placement
        );

        $carrySpillCourses = $this->resolve_carry_spill_course_list(
            isset($student['programme_id']) ? $student['programme_id'] : null,
            $sessionId,
            $semesterId,
            $placement
        );

        $registeredCourses = $registration
            ? $this->resolve_registration_courses($registration['id'])
            : array();

        $selectedCarrySpill = array_values(array_filter($registeredCourses, function ($course) {
            if (!is_array($course) || !isset($course['type'])) {
                return false;
            }
            return in_array($course['type'], array('carryover', 'spillover'), true);
        }));

        $selectedCourseIds = $registration
            ? $this->resolve_registration_course_ids($registration['id'])
            : array();

        return $this->json_response(200, array(
            'status' => 'success',
            'data' => array(
                'student' => $studentData,
                'available_courses' => $courses,
                'selected_course_ids' => $selectedCourseIds,
                'registration' => $registration,
                'carryover_spillover_courses' => $carrySpillCourses,
                'selected_carry_spill_courses' => $selectedCarrySpill,
            )
        ));
    }

    // Submit course registration
    public function submit_course_registration()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array(
                'status' => 'error',
                'message' => 'Method not allowed'
            ));
        }

        $user = $this->resolve_user();
        if (!$user || !isset($user['id'])) {
            return $this->json_response(404, array(
                'status' => 'error',
                'message' => 'User not found.'
            ));
        }

        $this->ensure_course_registration_tables();

        $student = $this->resolve_student($user['id']);
        if (!$student || !isset($student['student_id'])) {
            return $this->json_response(404, array(
                'status' => 'error',
                'message' => 'Student record not found.'
            ));
        }

        $payload = json_decode($this->input->raw_input_stream, true);
        if (!is_array($payload)) {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => 'Invalid JSON payload'
            ));
        }

        $courseIds = array();
        if (isset($payload['course_ids']) && is_array($payload['course_ids'])) {
            $courseIds = $payload['course_ids'];
        } elseif (isset($payload['courses']) && is_array($payload['courses'])) {
            foreach ($payload['courses'] as $course) {
                if (is_array($course) && isset($course['id'])) {
                    $courseIds[] = $course['id'];
                } elseif (is_string($course)) {
                    $courseIds[] = $course;
                }
            }
        }

        $courseIds = array_values(array_filter($courseIds, function ($id) {
            return $id !== null && $id !== '';
        }));

        if (empty($courseIds)) {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => 'At least one course is required.'
            ));
        }

        $session = $this->resolve_active_session();
        $semester = $this->resolve_current_semester();
        $sessionId = $session && isset($session['id']) ? $session['id'] : null;
        $semesterId = $semester && isset($semester['id']) ? $semester['id'] : null;
        $this->ensure_admissions_columns();
        $this->Courses_model->ensure_programme_structure_column();
        $this->Courses_model->ensure_course_structure_columns();
        $admission = $this->resolve_admission($student);
        $placement = $this->resolve_student_course_placement($student, $admission, $session);

        $existing = $this->resolve_course_registration(
            $student['student_id'],
            $sessionId,
            $semesterId
        );

        if ($existing && isset($existing['status']) && $existing['status'] === 'submitted') {
            return $this->json_response(409, array(
                'status' => 'error',
                'message' => 'Course registration has already been submitted.'
            ));
        }

        $validCourses = $this->resolve_course_rows(
            $courseIds,
            $student,
            $sessionId,
            $semesterId,
            $placement
        );
        if (empty($validCourses)) {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => 'No valid courses found for registration.'
            ));
        }

        $totalCredits = 0;
        foreach ($validCourses as $course) {
            $totalCredits += isset($course['credit_units']) ? (int) $course['credit_units'] : 0;
        }

        $this->db->trans_begin();

        $registrationId = $existing && isset($existing['id'])
            ? $existing['id']
            : $this->generate_uuid();

        $registrationData = array(
            'student_id' => $student['student_id'],
            'session_id' => $sessionId,
            'semester_id' => $semesterId,
            'status' => 'submitted',
            'total_credits' => $totalCredits,
            'submitted_at' => date('Y-m-d H:i:s'),
        );

        if ($this->db->field_exists('updated_at', 'course_registrations')) {
            $registrationData['updated_at'] = date('Y-m-d H:i:s');
        }

        if ($existing && isset($existing['id'])) {
            $this->db->where('id', $registrationId);
            $this->db->update('course_registrations', $registrationData);
            $reg_col = $this->db->field_exists('registration_id', 'course_registration_items') ? 'registration_id' : 'course_registration_id';
            if ($this->db->field_exists('status', 'course_registration_items')) {
                $drop_data = array('status' => 'dropped');
                if ($this->db->field_exists('dropped_at', 'course_registration_items')) {
                    $drop_data['dropped_at'] = date('Y-m-d H:i:s');
                }
                $this->db->where($reg_col, $registrationId);
                $this->db->update('course_registration_items', $drop_data);
            } else {
                $this->db->where($reg_col, $registrationId);
                $this->db->delete('course_registration_items');
            }
        } else {
            if ($this->requires_manual_id('course_registrations')) {
                $registrationData['id'] = $registrationId;
            }
            if ($this->db->field_exists('created_at', 'course_registrations')) {
                $registrationData['created_at'] = date('Y-m-d H:i:s');
            }
            $this->db->insert('course_registrations', $registrationData);
        }

        foreach ($validCourses as $course) {
            $itemId = $this->requires_manual_id('course_registration_items')
                ? $this->generate_uuid()
                : null;
            $itemData = array(
                'course_registration_id' => $registrationId,
                'course_offering_id' => isset($course['offering_id']) && $course['offering_id']
                    ? $course['offering_id']
                    : $course['id'],
                'course_type' => isset($course['type']) ? $course['type'] : 'core',
                'created_at' => date('Y-m-d H:i:s'),
            );
            if ($itemId) {
                $itemData['id'] = $itemId;
            }
            $this->db->insert('course_registration_items', $itemData);
        }

        if ($this->db->trans_status() === false) {
            $this->db->trans_rollback();
            return $this->json_response(500, array(
                'status' => 'error',
                'message' => 'Failed to submit course registration.'
            ));
        }

        $this->db->trans_commit();

        return $this->json_response(200, array(
            'status' => 'success',
            'message' => 'Course registration submitted successfully.',
            'data' => array(
                'registration_id' => $registrationId,
                'total_credits' => $totalCredits,
                'items_count' => count($validCourses),
            )
        ));
    }

    // Submit application
    public function application()
    {
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $user = $this->resolve_user();
            if (!$user) {
                return $this->json_response(404, array(
                    'status' => 'error',
                    'message' => 'User not found.'
                ));
            }

            $application = $this->resolve_application($user);
            if (!$application) {
                return $this->json_response(404, array(
                    'status' => 'error',
                    'message' => 'Application not found.'
                ));
            }

            $payload = $this->decode_payload(isset($application['payload']) ? $application['payload'] : null);

            return $this->json_response(200, array(
                'status' => 'success',
                'data' => array(
                    'application_no' => isset($application['application_no']) ? $application['application_no'] : null,
                    'status' => isset($application['status']) ? $application['status'] : null,
                    'applied_at' => isset($application['applied_at']) ? $application['applied_at'] : null,
                    'payload' => $payload,
                )
            ));
        }

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array(
                'status' => 'error',
                'message' => 'Method not allowed'
            ));
        }

        $user = $this->resolve_user();
        if (!$user) {
            return $this->json_response(404, array(
                'status' => 'error',
                'message' => 'User not found.'
            ));
        }

        $raw = $this->input->raw_input_stream;
        $payload = json_decode($raw, true);
        if (!is_array($payload)) {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => 'Invalid JSON payload'
            ));
        }

        // Prevent duplicate programme selection across choices
        $firstChoiceProgram = $this->array_get($payload, 'academic.firstChoiceProgram');
        $secondChoiceProgram = $this->array_get($payload, 'academic.secondChoiceProgram');
        if ($firstChoiceProgram && $secondChoiceProgram && $firstChoiceProgram === $secondChoiceProgram) {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => 'First and second choice programmes must be different.'
            ));
        }

        $this->ensure_application_tables();

        // The application session is selected by the institution, not by the
        // browser. This prevents a forged payload from attaching an application
        // to an inactive/unknown period or creating a new session implicitly.
        $applicationSession = $this->resolve_active_session();
        if (!$applicationSession || empty($applicationSession['id'])) {
            return $this->json_response(409, array(
                'status' => 'error',
                'message' => 'Applications are not open because no active academic session has been configured.'
            ));
        }

        if (!isset($payload['academic']) || !is_array($payload['academic'])) {
            $payload['academic'] = array();
        }
        $payload['academic']['applicationSession'] = isset($applicationSession['name'])
            ? $applicationSession['name']
            : '';

        $contactEmail = null;
        if (isset($payload['contact']) && is_array($payload['contact'])) {
            $contactEmail = isset($payload['contact']['email']) ? $payload['contact']['email'] : null;
        }

        $applicant = $this->resolve_applicant($user, $contactEmail);
        if (!$applicant) {
            $personal = isset($payload['personal']) && is_array($payload['personal']) ? $payload['personal'] : array();
            $contact = isset($payload['contact']) && is_array($payload['contact']) ? $payload['contact'] : array();
            $full_name = trim(
                (isset($personal['firstName']) ? $personal['firstName'] : '') . ' ' .
                (isset($personal['middleName']) ? $personal['middleName'] : '') . ' ' .
                (isset($personal['lastName']) ? $personal['lastName'] : '')
            );
            $email = isset($user['email']) ? $user['email'] : (isset($contact['email']) ? $contact['email'] : null);
            $phone = isset($contact['phone']) ? $contact['phone'] : (isset($user['phone']) ? $user['phone'] : null);
            $nin = isset($user['nin']) ? $user['nin'] : null;

            $applicantInsert = array(
                'full_name' => $full_name,
                'email' => $email,
                'phone' => $phone,
                'nin' => $nin,
                'created_at' => date('Y-m-d H:i:s'),
            );

            // For legacy schemas with non-auto-increment char/varchar primary keys
            if ($this->requires_manual_id('applicants')) {
                $applicantInsert['id'] = $this->generate_uuid();
            }

            $this->db->insert('applicants', $applicantInsert);

            $applicant_id = $this->db->insert_id();
            $applicant = $this->resolve_applicant($user, $contactEmail);
            if (!$applicant) {
                $applicant = array('id' => $applicant_id, 'email' => $email);
            }
        }

        $application_no = $this->generate_application_no();

        $applicationData = array(
            // Keep applicant_id as-is to support UUID/char PKs as well as ints
            'applicant_id' => isset($applicant['id']) ? $applicant['id'] : null,
            'application_no' => $application_no,
            'status' => 'submitted',
            'payload' => json_encode($payload),
            'applied_at' => date('Y-m-d H:i:s'),
        );

        // If programme_id column exists, map first choice programme code to programme id
        if ($this->db->field_exists('programme_id', 'applications')) {
            $programmeId = $this->resolve_programme_id($payload);
            if ($programmeId !== null) {
                $applicationData['programme_id'] = $programmeId;
            }
        }

        // Bind to the server-resolved active session. Do not use a client
        // supplied session name as a persistent identifier.
        if ($this->db->field_exists('session_id', 'applications')) {
            $applicationData['session_id'] = $applicationSession['id'];
        }

        if (empty($applicationData['applicant_id'])) {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => 'Applicant could not be resolved.'
            ));
        }

        // For legacy schemas with non-auto-increment char/varchar primary keys
        if ($this->requires_manual_id('applications')) {
            $applicationData['id'] = $this->generate_uuid();
        }

        $this->db->insert('applications', $applicationData);

        return $this->json_response(200, array(
            'status' => 'success',
            'data' => array(
                'application_no' => $application_no,
                'status' => 'submitted'
            )
        ));
    }

    public function application_pdf()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array(
                'status' => 'error',
                'message' => 'Method not allowed'
            ));
        }

        $user = $this->resolve_user();
        if (!$user) {
            return $this->json_response(404, array(
                'status' => 'error',
                'message' => 'User not found.'
            ));
        }

        $application = $this->resolve_application($user);
        if (!$application) {
            return $this->json_response(404, array(
                'status' => 'error',
                'message' => 'Application not found.'
            ));
        }

        $payload = $this->decode_payload(isset($application['payload']) ? $application['payload'] : null);

        $autoloadPath = FCPATH . 'vendor/autoload.php';
        if (!class_exists('FPDF')) {
            if (file_exists($autoloadPath)) {
                require_once $autoloadPath;
            }
        }

        if (!class_exists('FPDF')) {
            return $this->json_response(500, array(
                'status' => 'error',
                'message' => 'PDF library not available.'
            ));
        }

        $pdf = new FPDF('P', 'mm', 'A4');
        $pdf->SetMargins(10, 10, 10);
        $pdf->SetAutoPageBreak(true, 12);
        $pdf->AddPage();

        $appNo = isset($application['application_no']) ? $application['application_no'] : 'N/A';
        $status = isset($application['status']) ? $application['status'] : 'N/A';
        $submittedAt = isset($application['applied_at']) ? $application['applied_at'] : 'N/A';
        $email = isset($user['email']) ? $user['email'] : 'N/A';
        $fullName = isset($user['full_name']) ? $user['full_name'] : '';

        $personal = isset($payload['personal']) && is_array($payload['personal']) ? $payload['personal'] : array();
        $contact = isset($payload['contact']) && is_array($payload['contact']) ? $payload['contact'] : array();
        $jamb = isset($payload['jamb']) && is_array($payload['jamb']) ? $payload['jamb'] : array();
        $academic = isset($payload['academic']) && is_array($payload['academic']) ? $payload['academic'] : array();
        $guardian = isset($payload['guardian']) && is_array($payload['guardian']) ? $payload['guardian'] : array();
        $oLevel = isset($payload['oLevel']) && is_array($payload['oLevel']) ? $payload['oLevel'] : array();
        $documents = isset($payload['documents']) && is_array($payload['documents']) ? $payload['documents'] : array();
        $logoPath = $this->resolve_college_logo_path();

        // MCCAS brand palette: royal blue, forest green, and gold.
        $brandHeader = array(31, 101, 194);
        $brandSection = array(31, 101, 194);
        $brandAccent = array(245, 158, 11);
        $labelFill = array(239, 246, 255);

        $pdf->SetFillColor($brandHeader[0], $brandHeader[1], $brandHeader[2]);
        $pdf->Rect(10, 10, 190, 30, 'F');
        $pdf->SetFillColor($brandAccent[0], $brandAccent[1], $brandAccent[2]);
        $pdf->Rect(10, 39.2, 190, 1.2, 'F');

        if ($logoPath) {
            $ext = strtolower(pathinfo($logoPath, PATHINFO_EXTENSION));
            if (in_array($ext, array('png', 'jpg', 'jpeg'), true)) {
                $pdf->Image($logoPath, 13, 13, 20);
            }
        }

        $pdf->SetTextColor(255, 255, 255);
        $pdf->SetFont('Arial', 'B', 11);
        $pdf->SetXY(36, 13);
        $pdf->Cell(92, 5, $this->pdf_text('MASLAHA COMMUNITY COLLEGE'), 0, 2, 'L');
        $pdf->SetFont('Arial', '', 8);
        $pdf->SetX(36);
        $pdf->Cell(92, 4, $this->pdf_text('Knowledge, Competence, Humanity'), 0, 2, 'L');
        $pdf->SetFont('Arial', 'B', 17);
        $pdf->SetX(36);
        $pdf->Cell(92, 10, $this->pdf_text('APPLICATION FORM'), 0, 0, 'L');

        $pdf->SetFont('Arial', '', 9);
        $pdf->SetXY(124, 14);
        $pdf->Cell(72, 5, $this->pdf_text('MCCAS Student Portal'), 0, 2, 'R');
        $pdf->SetX(124);
        $pdf->Cell(72, 5, $this->pdf_text('Email: ' . $email), 0, 2, 'R');
        $pdf->SetX(124);
        $pdf->Cell(72, 5, $this->pdf_text('Generated: ' . date('Y-m-d H:i')), 0, 1, 'R');

        $pdf->SetFillColor($brandSection[0], $brandSection[1], $brandSection[2]);
        $pdf->SetXY(10, 40);
        $pdf->SetFont('Arial', 'B', 10);
        $pdf->Cell(190, 8, $this->pdf_text('APPLICATION INFORMATION'), 0, 1, 'C', true);

        $pdf->SetTextColor(0, 0, 0);
        $this->application_pdf_pair_row($pdf, 'Application No', $appNo, 'Status', $status);
        $this->application_pdf_pair_row($pdf, 'Submitted At', $submittedAt, 'Applicant', $fullName ? $fullName : 'N/A');

        $this->application_pdf_section_title($pdf, 'PERSONAL INFORMATION');
        $this->application_pdf_pair_row(
            $pdf,
            'First Name', isset($personal['firstName']) ? $personal['firstName'] : null,
            'Last Name', isset($personal['lastName']) ? $personal['lastName'] : null
        );
        $this->application_pdf_pair_row(
            $pdf,
            'Middle Name', isset($personal['middleName']) ? $personal['middleName'] : null,
            'Gender', isset($personal['gender']) ? $personal['gender'] : null
        );
        $this->application_pdf_pair_row(
            $pdf,
            'Date of Birth', isset($personal['dateOfBirth']) ? $personal['dateOfBirth'] : null,
            'Marital Status', isset($personal['maritalStatus']) ? $personal['maritalStatus'] : null
        );
        $this->application_pdf_pair_row(
            $pdf,
            'Nationality', isset($personal['nationality']) ? $personal['nationality'] : null,
            'State of Origin', isset($personal['stateOfOrigin']) ? $personal['stateOfOrigin'] : null
        );
        $this->application_pdf_single_row($pdf, 'LGA', isset($personal['localGovernment']) ? $personal['localGovernment'] : null);

        $this->application_pdf_section_title($pdf, 'CONTACT INFORMATION');
        $this->application_pdf_pair_row(
            $pdf,
            'Email', isset($contact['email']) ? $contact['email'] : null,
            'Phone', isset($contact['phone']) ? $contact['phone'] : null
        );
        $this->application_pdf_pair_row(
            $pdf,
            'Alternate Phone', isset($contact['alternatePhone']) ? $contact['alternatePhone'] : null,
            'City', isset($contact['city']) ? $contact['city'] : null
        );
        $this->application_pdf_pair_row(
            $pdf,
            'State', isset($contact['state']) ? $contact['state'] : null,
            'Postal Code', isset($contact['postalCode']) ? $contact['postalCode'] : null
        );
        $this->application_pdf_single_row($pdf, 'Address', isset($contact['address']) ? $contact['address'] : null);

        $this->application_pdf_section_title($pdf, 'ACADEMIC INFORMATION');
        $this->application_pdf_pair_row(
            $pdf,
            'JAMB Number', isset($jamb['jambNumber']) ? $jamb['jambNumber'] : null,
            'JAMB Score', isset($jamb['jambScore']) ? $jamb['jambScore'] : null
        );
        $this->application_pdf_pair_row(
            $pdf,
            'Qualification', isset($academic['qualification']) ? $academic['qualification'] : null,
            'Session', isset($academic['applicationSession']) ? $academic['applicationSession'] : null
        );
        $this->application_pdf_pair_row(
            $pdf,
            'Mode of Entry', isset($academic['applicationModeOfEntry']) ? $academic['applicationModeOfEntry'] : null,
            'Assigned Level', 'To be assigned by Admission Officer'
        );
        $this->application_pdf_pair_row(
            $pdf,
            'First Choice Dept.', isset($academic['firstChoiceDepartment']) ? $academic['firstChoiceDepartment'] : null,
            'First Choice Prog.', isset($academic['firstChoiceProgram']) ? $academic['firstChoiceProgram'] : null
        );
        $this->application_pdf_pair_row(
            $pdf,
            'Second Choice Dept.', isset($academic['secondChoiceDepartment']) ? $academic['secondChoiceDepartment'] : null,
            'Second Choice Prog.', isset($academic['secondChoiceProgram']) ? $academic['secondChoiceProgram'] : null
        );

        $this->application_pdf_section_title($pdf, 'GUARDIAN INFORMATION');
        $this->application_pdf_pair_row(
            $pdf,
            'Guardian Name', isset($guardian['guardianName']) ? $guardian['guardianName'] : null,
            'Guardian Phone', isset($guardian['guardianPhone']) ? $guardian['guardianPhone'] : null
        );
        $this->application_pdf_pair_row(
            $pdf,
            'Guardian Email', isset($guardian['guardianEmail']) ? $guardian['guardianEmail'] : null,
            'Guardian Address', isset($guardian['guardianAddress']) ? $guardian['guardianAddress'] : null
        );

        $this->application_pdf_section_title($pdf, 'RESULTS & DOCUMENTS');
        $this->application_pdf_single_row($pdf, 'O\'Level Summary', $this->build_olevel_summary($oLevel));
        $this->application_pdf_single_row($pdf, 'Uploaded Documents', $this->build_documents_summary($documents));

        $this->application_pdf_ensure_space($pdf, 24);
        $pdf->Ln(3);
        $pdf->SetFillColor($brandSection[0], $brandSection[1], $brandSection[2]);
        $pdf->SetTextColor(255, 255, 255);
        $pdf->SetFont('Arial', 'B', 9);
        $pdf->Cell(190, 7, $this->pdf_text('CONSENT & SIGNATURE'), 0, 1, 'C', true);

        $pdf->SetTextColor(0, 0, 0);
        $pdf->SetFont('Arial', '', 9);
        $pdf->Cell(95, 8, $this->pdf_text('Date: ____________________________'), 0, 0, 'L');
        $pdf->Cell(95, 8, $this->pdf_text('Applicant Signature: ____________________________'), 0, 1, 'L');

        $pdf->Ln(3);
        $pdf->SetFont('Arial', 'I', 8);
        $pdf->SetTextColor(90, 90, 90);
        $pdf->Cell(0, 5, $this->pdf_text('This is a system-generated copy of the submitted application.'), 0, 1, 'L');
        $pdf->Cell(0, 5, $this->pdf_text('Generated on ' . date('Y-m-d H:i:s')), 0, 1, 'R');

        $filename = 'application-record-' . preg_replace('/[^A-Za-z0-9\-]/', '-', $appNo) . '.pdf';

        while (ob_get_level() > 0) {
            ob_end_clean();
        }

        $this->output->set_content_type('application/pdf');
        $pdf->Output('D', $filename);
        exit;
    }

    private function application_pdf_section_title($pdf, $title)
    {
        $this->application_pdf_ensure_space($pdf, 10);
        $pdf->SetTextColor(255, 255, 255);
        $pdf->SetFont('Arial', 'B', 9);
        $pdf->SetFillColor(31, 101, 194);
        $pdf->Cell(190, 7, $this->pdf_text($title), 0, 1, 'C', true);
        $pdf->SetTextColor(0, 0, 0);
    }

    private function application_pdf_pair_row($pdf, $label1, $value1, $label2, $value2)
    {
        $this->application_pdf_ensure_space($pdf, 8);
        $pdf->SetFillColor(239, 246, 255);

        $labelWidth = 38;
        $valueWidth = 57;
        $pdf->SetFont('Arial', 'B', 8);
        $pdf->Cell($labelWidth, 7, $this->pdf_fit_text($pdf, $label1, $labelWidth - 2), 1, 0, 'L', true);
        $pdf->SetFont('Arial', '', 8);
        $pdf->Cell($valueWidth, 7, $this->pdf_fit_text($pdf, $this->stringify_value($value1), $valueWidth - 2), 1, 0, 'L');

        $pdf->SetFont('Arial', 'B', 8);
        $pdf->Cell($labelWidth, 7, $this->pdf_fit_text($pdf, $label2, $labelWidth - 2), 1, 0, 'L', true);
        $pdf->SetFont('Arial', '', 8);
        $pdf->Cell($valueWidth, 7, $this->pdf_fit_text($pdf, $this->stringify_value($value2), $valueWidth - 2), 1, 1, 'L');
    }

    private function application_pdf_single_row($pdf, $label, $value)
    {
        $this->application_pdf_ensure_space($pdf, 8);
        $pdf->SetFillColor(239, 246, 255);

        $pdf->SetFont('Arial', 'B', 8);
        $pdf->Cell(40, 7, $this->pdf_text($label), 1, 0, 'L', true);

        $pdf->SetFont('Arial', '', 8);
        $startX = $pdf->GetX();
        $startY = $pdf->GetY();
        $pdf->MultiCell(150, 7, $this->pdf_text($this->stringify_value($value)), 1, 'L');

        if ($pdf->GetY() === $startY) {
            $pdf->SetXY($startX + 150, $startY + 7);
        }
    }

    private function application_pdf_ensure_space($pdf, $requiredHeight)
    {
        if (($pdf->GetY() + $requiredHeight) > 282) {
            $pdf->AddPage();
        }
    }

    private function build_olevel_summary($oLevel)
    {
        if (!is_array($oLevel)) {
            return 'N/A';
        }

        $first = isset($oLevel['firstSitting']) && is_array($oLevel['firstSitting']) ? $oLevel['firstSitting'] : array();
        $second = isset($oLevel['secondSitting']) && is_array($oLevel['secondSitting']) ? $oLevel['secondSitting'] : array();

        $format = function ($rows) {
            $parts = array();
            foreach ($rows as $row) {
                if (!is_array($row)) {
                    continue;
                }
                $subject = isset($row['subject']) ? trim((string) $row['subject']) : '';
                $grade = isset($row['grade']) ? trim((string) $row['grade']) : '';
                if ($subject === '') {
                    continue;
                }
                $parts[] = $subject . ($grade !== '' ? (' (' . $grade . ')') : '');
            }
            return empty($parts) ? 'N/A' : implode(', ', $parts);
        };

        return 'First Sitting: ' . $format($first) . ' | Second Sitting: ' . $format($second);
    }

    private function build_documents_summary($documents)
    {
        if (!is_array($documents) || empty($documents)) {
            return 'N/A';
        }

        $parts = array();
        foreach ($documents as $key => $value) {
            $label = $this->humanize_key((string) $key);
            $parts[] = $label . ': ' . ($value ? (string) $value : 'Not Provided');
        }

        return implode(' | ', $parts);
    }

    private function resolve_user()
    {
        $user_id = $this->input->get('user_id', true);
        $email = $this->input->get('email', true);
        $header_user_id = $this->input->get_request_header('X-User-Id', true);
        $header_email = $this->input->get_request_header('X-User-Email', true);

        $lookup_id = $user_id ? $user_id : $header_user_id;
        if ($lookup_id) {
            return $this->User_model->find_by_id($lookup_id);
        }

        $lookup_email = $email ? $email : $header_email;
        if ($lookup_email) {
            return $this->User_model->find_by_email(strtolower($lookup_email));
        }

        return null;
    }

    private function flatten_payload($value, $prefix = '')
    {
        $rows = array();

        if (is_array($value)) {
            if (empty($value)) {
                if ($prefix !== '') {
                    $rows[] = array(
                        'label' => $prefix,
                        'value' => 'N/A'
                    );
                }
                return $rows;
            }

            $isAssoc = $this->is_assoc_array($value);
            foreach ($value as $key => $item) {
                $segment = $isAssoc
                    ? $this->humanize_key((string) $key)
                    : ('Item ' . ((int) $key + 1));

                $nextPrefix = $prefix === '' ? $segment : ($prefix . ' > ' . $segment);

                if (is_array($item)) {
                    $rows = array_merge($rows, $this->flatten_payload($item, $nextPrefix));
                } else {
                    $rows[] = array(
                        'label' => $nextPrefix,
                        'value' => $this->stringify_value($item)
                    );
                }
            }

            return $rows;
        }

        if ($prefix !== '') {
            $rows[] = array(
                'label' => $prefix,
                'value' => $this->stringify_value($value)
            );
        }

        return $rows;
    }

    private function is_assoc_array($arr)
    {
        if (!is_array($arr)) {
            return false;
        }
        return array_keys($arr) !== range(0, count($arr) - 1);
    }

    private function humanize_key($key)
    {
        $val = preg_replace('/([a-z])([A-Z])/', '$1 $2', $key);
        $val = str_replace(array('_', '-'), ' ', $val);
        $val = preg_replace('/\s+/', ' ', trim($val));
        return ucwords($val);
    }

    private function stringify_value($value)
    {
        if ($value === null) {
            return 'N/A';
        }
        if (is_bool($value)) {
            return $value ? 'Yes' : 'No';
        }
        if (is_string($value)) {
            $trimmed = trim($value);
            return $trimmed === '' ? 'N/A' : $trimmed;
        }
        if (is_numeric($value)) {
            return (string) $value;
        }
        return (string) $value;
    }

    private function resolve_applicant($user, $payloadEmail = null)
    {
        if (!$this->db->table_exists('applicants')) {
            return null;
        }

        $email = isset($user['email']) ? $user['email'] : null;
        if (!$email && $payloadEmail) {
            $email = $payloadEmail;
        }
        if (!$email) {
            return null;
        }

        $query = $this->db->get_where('applicants', array('email' => $email), 1);
        return $query->row_array();
    }

    private function resolve_application($user)
    {
        if (!$this->db->table_exists('applications')) {
            return null;
        }

        $applicant = $this->resolve_applicant($user);
        if (!$applicant || empty($applicant['id'])) {
            return null;
        }

        $this->db->from('applications');
        $this->db->where('applicant_id', $applicant['id']);
        $this->db->order_by('applied_at', 'DESC');
        $this->db->limit(1);
        $query = $this->db->get();
        return $query->row_array();
    }

    private function resolve_application_no($user)
    {
        $application = $this->resolve_application($user);
        if ($application && isset($application['application_no'])) {
            return $application['application_no'];
        }

        return null;
    }

    private function ensure_application_tables()
    {
        if (!$this->db->table_exists('applicants')) {
            $this->db->query("CREATE TABLE IF NOT EXISTS `applicants` (
                `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
                `full_name` VARCHAR(255) NULL,
                `email` VARCHAR(255) NOT NULL,
                `phone` VARCHAR(50) NULL,
                `nin` VARCHAR(50) NULL,
                `created_at` DATETIME NOT NULL,
                PRIMARY KEY (`id`),
                UNIQUE KEY `email_unique` (`email`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        }

        // Backfill missing columns if table already existed
        if (!$this->db->field_exists('full_name', 'applicants')) {
            $this->db->query("ALTER TABLE `applicants` ADD COLUMN `full_name` VARCHAR(255) NULL");
        }
        if (!$this->db->field_exists('email', 'applicants')) {
            $this->db->query("ALTER TABLE `applicants` ADD COLUMN `email` VARCHAR(255) NOT NULL");
        }
        if (!$this->db->field_exists('phone', 'applicants')) {
            $this->db->query("ALTER TABLE `applicants` ADD COLUMN `phone` VARCHAR(50) NULL");
        }
        if (!$this->db->field_exists('nin', 'applicants')) {
            $this->db->query("ALTER TABLE `applicants` ADD COLUMN `nin` VARCHAR(50) NULL");
        }
        if (!$this->db->field_exists('created_at', 'applicants')) {
            $this->db->query("ALTER TABLE `applicants` ADD COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
        }
        // Ensure unique index on email
        $indexes = $this->db->query("SHOW INDEX FROM `applicants` WHERE Key_name = 'email_unique'")->result_array();
        if (empty($indexes)) {
            $this->db->query("ALTER TABLE `applicants` ADD UNIQUE KEY `email_unique` (`email`)");
        }

        if (!$this->db->table_exists('applications')) {
            $this->db->query("CREATE TABLE IF NOT EXISTS `applications` (
                `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
                `applicant_id` INT UNSIGNED NULL,
                `programme_id` INT UNSIGNED NULL,
                `application_no` VARCHAR(50) NOT NULL,
                `status` VARCHAR(50) NOT NULL DEFAULT 'submitted',
                `payload` MEDIUMTEXT NULL,
                `applied_at` DATETIME NOT NULL,
                PRIMARY KEY (`id`),
                UNIQUE KEY `application_no_unique` (`application_no`),
                KEY `applicant_idx` (`applicant_id`),
                KEY `programme_idx` (`programme_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        }

        // Backfill missing columns if table already existed
        if (!$this->db->field_exists('application_no', 'applications')) {
            $this->db->query("ALTER TABLE `applications` ADD COLUMN `application_no` VARCHAR(50) NOT NULL");
        }
        if (!$this->db->field_exists('status', 'applications')) {
            $this->db->query("ALTER TABLE `applications` ADD COLUMN `status` VARCHAR(50) NOT NULL DEFAULT 'submitted'");
        }
        if (!$this->db->field_exists('payload', 'applications')) {
            $this->db->query("ALTER TABLE `applications` ADD COLUMN `payload` MEDIUMTEXT NULL");
        }
        if (!$this->db->field_exists('applied_at', 'applications')) {
            $this->db->query("ALTER TABLE `applications` ADD COLUMN `applied_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
        }
        if (!$this->db->field_exists('programme_id', 'applications')) {
            $this->db->query("ALTER TABLE `applications` ADD COLUMN `programme_id` INT UNSIGNED NULL AFTER `applicant_id`");
        }
        // Ensure unique index on application_no
        $appNoIndex = $this->db->query("SHOW INDEX FROM `applications` WHERE Key_name = 'application_no_unique'")->result_array();
        if (empty($appNoIndex)) {
            $this->db->query("ALTER TABLE `applications` ADD UNIQUE KEY `application_no_unique` (`application_no`)");
        }
        // Ensure index on programme_id
        $progIndex = $this->db->query("SHOW INDEX FROM `applications` WHERE Key_name = 'programme_idx'")->result_array();
        if (empty($progIndex)) {
            $this->db->query("ALTER TABLE `applications` ADD KEY `programme_idx` (`programme_id`)");
        }
    }

    private function ensure_admissions_columns()
    {
        if (!$this->db->table_exists('admissions')) {
            return;
        }

        if (!$this->db->field_exists('acceptance_fee', 'admissions')) {
            $this->db->query("ALTER TABLE `admissions` ADD COLUMN `acceptance_fee` INT NULL AFTER `acceptance_deadline`");
        }

        if (!$this->db->field_exists('acceptance_fee_paid', 'admissions')) {
            $this->db->query("ALTER TABLE `admissions` ADD COLUMN `acceptance_fee_paid` TINYINT(1) NOT NULL DEFAULT 0 AFTER `acceptance_fee`");
        }

        if (!$this->db->field_exists('acceptance_fee_paid_at', 'admissions')) {
            $this->db->query("ALTER TABLE `admissions` ADD COLUMN `acceptance_fee_paid_at` DATETIME NULL AFTER `acceptance_fee_paid`");
        }
    }

    private function ensure_application_payment_columns()
    {
        if (!$this->db->table_exists('applications')) {
            return;
        }

        if (!$this->db->field_exists('payment_status', 'applications')) {
            $this->db->query("ALTER TABLE `applications` ADD COLUMN `payment_status` VARCHAR(30) NOT NULL DEFAULT 'unpaid' AFTER `status`");
        }
        if (!$this->db->field_exists('payment_reference', 'applications')) {
            $this->db->query("ALTER TABLE `applications` ADD COLUMN `payment_reference` VARCHAR(100) NULL AFTER `payment_status`");
        }
        if (!$this->db->field_exists('payment_amount', 'applications')) {
            $this->db->query("ALTER TABLE `applications` ADD COLUMN `payment_amount` DECIMAL(12,2) NULL AFTER `payment_reference`");
        }
        if (!$this->db->field_exists('payment_paid_at', 'applications')) {
            $this->db->query("ALTER TABLE `applications` ADD COLUMN `payment_paid_at` DATETIME NULL AFTER `payment_amount`");
        }
    }

    private function ensure_application_fee_payments_table()
    {
        if (!$this->db->table_exists('application_fee_payments')) {
            $this->db->query("CREATE TABLE IF NOT EXISTS `application_fee_payments` (
                `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
                `user_id` VARCHAR(64) NULL,
                `email` VARCHAR(255) NOT NULL,
                `reference` VARCHAR(100) NOT NULL,
                `amount` DECIMAL(12,2) NOT NULL,
                `status` VARCHAR(30) NOT NULL DEFAULT 'paid',
                `paid_at` DATETIME NOT NULL,
                `raw_response` MEDIUMTEXT NULL,
                PRIMARY KEY (`id`),
                UNIQUE KEY `reference_unique` (`reference`),
                KEY `user_idx` (`user_id`),
                KEY `email_idx` (`email`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        }
    }

    private function has_verified_application_fee_payment($user)
    {
        if (!$user || !$this->db->table_exists('application_fee_payments')) {
            return false;
        }

        $this->db->from('application_fee_payments');
        $this->db->where('status', 'paid');
        $this->db->group_start();
        if (isset($user['id']) && $user['id'] !== '') {
            $this->db->where('user_id', (string) $user['id']);
        }
        if (isset($user['email']) && $user['email'] !== '') {
            $this->db->or_where('email', strtolower((string) $user['email']));
        }
        $this->db->group_end();
        return $this->db->count_all_results() > 0;
    }

    private function record_application_fee_payment($user, $reference, $amount, $rawResponse)
    {
        $this->ensure_application_fee_payments_table();

        $email = isset($user['email']) ? strtolower((string) $user['email']) : '';
        $row = array(
            'user_id' => isset($user['id']) ? (string) $user['id'] : null,
            'email' => $email,
            'reference' => $reference,
            'amount' => $amount,
            'status' => 'paid',
            'paid_at' => date('Y-m-d H:i:s'),
            'raw_response' => json_encode($rawResponse),
        );

        $existing = $this->db->get_where('application_fee_payments', array('reference' => $reference), 1)->row_array();
        if ($existing && isset($existing['id'])) {
            $this->db->where('id', $existing['id']);
            $this->db->update('application_fee_payments', $row);
            return;
        }

        $this->db->insert('application_fee_payments', $row);
    }

    private function verify_paystack_reference($reference, $secretKey)
    {
        $url = 'https://api.paystack.co/transaction/verify/' . rawurlencode($reference);
        $headers = array(
            'Authorization: Bearer ' . $secretKey,
            'Cache-Control: no-cache',
        );

        if (function_exists('curl_init')) {
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
            curl_setopt($ch, CURLOPT_TIMEOUT, 30);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
            $body = curl_exec($ch);
            $curlError = curl_error($ch);
            $statusCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($body === false) {
                return array(
                    'ok' => false,
                    'message' => $curlError ? $curlError : 'Unable to contact Paystack.',
                );
            }
        } else {
            $context = stream_context_create(array(
                'http' => array(
                    'method' => 'GET',
                    'header' => implode("\r\n", $headers),
                    'timeout' => 30,
                ),
            ));
            $body = @file_get_contents($url, false, $context);
            $statusCode = 0;
            if (isset($http_response_header) && is_array($http_response_header)) {
                foreach ($http_response_header as $header) {
                    if (preg_match('/^HTTP\/\S+\s+(\d+)/', $header, $matches)) {
                        $statusCode = (int) $matches[1];
                        break;
                    }
                }
            }

            if ($body === false) {
                return array(
                    'ok' => false,
                    'message' => 'Unable to contact Paystack.',
                );
            }
        }

        $decoded = json_decode($body, true);
        if (!is_array($decoded)) {
            return array(
                'ok' => false,
                'message' => 'Invalid Paystack response.',
            );
        }

        if ($statusCode < 200 || $statusCode >= 300 || empty($decoded['status'])) {
            return array(
                'ok' => false,
                'message' => isset($decoded['message']) ? $decoded['message'] : 'Paystack verification failed.',
            );
        }

        return array(
            'ok' => true,
            'data' => isset($decoded['data']) && is_array($decoded['data']) ? $decoded['data'] : array(),
        );
    }

    private function ensure_course_registration_tables()
    {
        if (!$this->db->table_exists('course_registrations')) {
            $this->db->query("CREATE TABLE IF NOT EXISTS `course_registrations` (
                `id` CHAR(36) NOT NULL,
                `student_id` CHAR(36) NOT NULL,
                `session_id` CHAR(36) NOT NULL,
                `semester_id` CHAR(36) NOT NULL,
                `status` VARCHAR(30) NOT NULL DEFAULT 'submitted',
                `total_credits` INT NOT NULL DEFAULT 0,
                `submitted_at` DATETIME NULL,
                `created_at` DATETIME NOT NULL,
                `updated_at` DATETIME NULL,
                PRIMARY KEY (`id`),
                KEY `idx_course_reg_student` (`student_id`),
                KEY `idx_course_reg_session` (`session_id`),
                KEY `idx_course_reg_semester` (`semester_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        }

        if (!$this->db->table_exists('course_registration_items')) {
            $this->db->query("CREATE TABLE IF NOT EXISTS `course_registration_items` (
                `id` CHAR(36) NOT NULL,
                `course_registration_id` CHAR(36) NOT NULL,
                `course_offering_id` CHAR(36) NOT NULL,
                `course_type` VARCHAR(30) NOT NULL DEFAULT 'core',
                `created_at` DATETIME NOT NULL,
                PRIMARY KEY (`id`),
                KEY `idx_reg_items_reg` (`course_registration_id`),
                KEY `idx_reg_items_offering` (`course_offering_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        }
    }

    private function resolve_student($userId)
    {
        if (!$userId || !$this->db->table_exists('students')) {
            return null;
        }

        $this->db->select('s.id as student_id, s.user_id, s.admission_id, s.programme_id, s.department_id, s.current_level');
        foreach (array('session_id', 'entry_session_id', 'session_name', 'entry_mode') as $col) {
            if ($this->db->field_exists($col, 'students')) {
                $this->db->select('s.' . $col);
            }
        }
        $this->Courses_model->ensure_programme_structure_column();
        $this->db->select('p.name as programme_name, p.code as programme_code');
        if ($this->db->field_exists('programme_structure', 'programmes')) {
            $this->db->select('p.programme_structure, p.duration_years');
        } else {
            $this->db->select("'semester' as programme_structure, NULL as duration_years", false);
        }
        $this->db->select('d.name as department_name, d.code as department_code');
        $this->db->from('students s');
        $this->db->join('programmes p', 'p.id = s.programme_id', 'left');
        $this->db->join('departments d', 'd.id = s.department_id', 'left');
        $this->db->where('s.user_id', $userId);
        $this->db->limit(1);
        return $this->db->get()->row_array();
    }

    private function resolve_admission($student)
    {
        if (!$student || !isset($student['admission_id']) || !$this->db->table_exists('admissions')) {
            return null;
        }

        return $this->db->get_where('admissions', array('id' => $student['admission_id']), 1)->row_array();
    }

    private function resolve_active_session()
    {
        if (!$this->db->table_exists('academic_sessions')) {
            return null;
        }

        if ($this->db->field_exists('is_active', 'academic_sessions')) {
            $this->db->where('is_active', 1);
            $this->db->order_by('start_date', 'desc');
            $this->db->order_by('name', 'desc');
            $row = $this->db->get('academic_sessions', 1)->row_array();
            return $row ? $row : null;
        }

        $this->db->order_by('name', 'desc');
        return $this->db->get('academic_sessions', 1)->row_array();
    }

    private function resolve_current_semester()
    {
        if (!$this->db->table_exists('semesters')) {
            return null;
        }

        $this->db->order_by('sort_order', 'asc');
        $row = $this->db->get('semesters', 1)->row_array();
        return $row ? $row : null;
    }

    private function resolve_student_course_placement($student, $admission, $currentSession)
    {
        $structure = $this->normalise_programme_structure(
            $admission && isset($admission['program_type']) ? $admission['program_type'] : null
        );
        if (!$structure && isset($student['programme_structure'])) {
            $structure = $this->normalise_programme_structure($student['programme_structure']);
        }
        if (!$structure) {
            $structure = 'semester';
        }

        $entrySession = $this->resolve_entry_session($admission, $student);
        $sessionIndex = $this->calculate_session_index($entrySession, $currentSession);
        if ($sessionIndex < 1) {
            $sessionIndex = 1;
        }
        $entryLevelNumber = $this->entry_level_number($admission, $student);
        if ($entryLevelNumber < 1) {
            $entryLevelNumber = 1;
        }
        $placementNumber = $entryLevelNumber + max(0, $sessionIndex - 1);

        if ($structure === 'contact') {
            $contactNumber = min(6, $placementNumber);
            $label = 'Contact ' . $contactNumber;
            return array(
                'programme_structure' => 'contact',
                'contact_number' => $contactNumber,
                'year_number' => null,
                'label' => $label,
                'aliases' => $this->course_level_aliases($label, $contactNumber, 'contact'),
                'entry_session_id' => $entrySession && isset($entrySession['id']) ? $entrySession['id'] : null,
                'entry_session_name' => $entrySession && isset($entrySession['name']) ? $entrySession['name'] : null,
            );
        }

        $durationYears = isset($student['duration_years']) && (int) $student['duration_years'] > 0
            ? (int) $student['duration_years']
            : 5;
        $yearNumber = min($durationYears, $placementNumber);
        $label = 'Year ' . $yearNumber;

        return array(
            'programme_structure' => 'semester',
            'contact_number' => null,
            'year_number' => $yearNumber,
            'label' => $label,
            'aliases' => $this->course_level_aliases($label, $yearNumber, 'semester'),
            'entry_session_id' => $entrySession && isset($entrySession['id']) ? $entrySession['id'] : null,
            'entry_session_name' => $entrySession && isset($entrySession['name']) ? $entrySession['name'] : null,
        );
    }

    private function normalise_programme_structure($value)
    {
        $structure = strtolower(trim((string) $value));
        if ($structure === 'contact_based') {
            $structure = 'contact';
        }
        if ($structure === 'semester_based') {
            $structure = 'semester';
        }

        return in_array($structure, array('contact', 'semester'), true) ? $structure : null;
    }

    private function entry_level_number($admission, $student)
    {
        $entryMode = $student && isset($student['entry_mode']) ? $student['entry_mode'] : null;
        $admissionLevel = $admission && isset($admission['level']) ? $admission['level'] : null;
        $admissionMode = $admission && isset($admission['mode_of_entry']) ? $admission['mode_of_entry'] : null;
        $matricNumber = $admission && isset($admission['matric_number']) ? $admission['matric_number'] : null;

        if (isset($this->Student_model) && method_exists($this->Student_model, 'resolve_entry_base_level')) {
            return $this->Student_model->resolve_entry_base_level($entryMode, $admissionLevel, $admissionMode, $matricNumber);
        }

        if ($admissionLevel !== null && trim((string) $admissionLevel) !== '') {
            return $this->level_number_from_label($admissionLevel);
        }
        return 1;
    }

    private function level_number_from_label($value)
    {
        $value = trim((string) $value);
        if ($value === '') {
            return 0;
        }
        $lower = strtolower($value);
        $wordMap = array(
            'contact-one' => 1, 'contact one' => 1, 'one' => 1, 'year one' => 1, 'first' => 1,
            'contact-two' => 2, 'contact two' => 2, 'two' => 2, 'year two' => 2, 'second' => 2,
            'contact-three' => 3, 'contact three' => 3, 'three' => 3, 'year three' => 3, 'third' => 3,
            'contact-four' => 4, 'contact four' => 4, 'four' => 4, 'year four' => 4, 'fourth' => 4,
            'contact-five' => 5, 'contact five' => 5, 'five' => 5, 'year five' => 5, 'fifth' => 5,
            'contact-six' => 6, 'contact six' => 6, 'six' => 6, 'year six' => 6, 'sixth' => 6,
        );
        if (isset($wordMap[$lower])) {
            return $wordMap[$lower];
        }
        if (preg_match('/(?:contact|year|level)[-\s]*(one|two|three|four|five|six)\b/i', $lower, $wm)) {
            $word = strtolower($wm[1]);
            if (isset($wordMap[$word])) {
                return $wordMap[$word];
            }
        }
        if (preg_match('/contact\s*(\d+)/i', $value, $matches)) {
            return max(1, (int) $matches[1]);
        }
        if (preg_match('/(\d+)/', $value, $matches)) {
            $number = (int) $matches[1];
            return $number >= 100 ? max(1, (int) ceil($number / 100)) : max(1, $number);
        }
        return 0;
    }

    private function resolve_entry_session($admission, $student)
    {
        if (!$this->db->table_exists('academic_sessions')) {
            return null;
        }

        $sessionId = null;
        if ($admission && isset($admission['session_id']) && $admission['session_id']) {
            $sessionId = $admission['session_id'];
        }

        if (!$sessionId && isset($student['session_id']) && $student['session_id']) {
            $sessionId = $student['session_id'];
        }

        if ($sessionId) {
            $session = $this->db->get_where('academic_sessions', array('id' => $sessionId), 1)->row_array();
            if ($session) {
                return $session;
            }
        }

        if (isset($student['session_name']) && $student['session_name']) {
            $session = $this->db->get_where('academic_sessions', array('name' => $student['session_name']), 1)->row_array();
            if ($session) {
                return $session;
            }
        }

        return null;
    }

    private function calculate_session_index($entrySession, $currentSession)
    {
        $entryYear = $this->session_start_year($entrySession);
        $currentYear = $this->session_start_year($currentSession);
        if ($entryYear !== null && $currentYear !== null) {
            return max(1, ($currentYear - $entryYear) + 1);
        }

        if (!$entrySession || !$currentSession || empty($entrySession['id']) || empty($currentSession['id'])) {
            return 1;
        }

        $ordered = $this->ordered_academic_sessions();
        $entryIndex = null;
        $currentIndex = null;
        foreach ($ordered as $index => $session) {
            if (isset($session['id']) && $session['id'] === $entrySession['id']) {
                $entryIndex = $index;
            }
            if (isset($session['id']) && $session['id'] === $currentSession['id']) {
                $currentIndex = $index;
            }
        }

        if ($entryIndex === null || $currentIndex === null) {
            return 1;
        }

        return max(1, ($currentIndex - $entryIndex) + 1);
    }

    private function session_start_year($session)
    {
        if (!is_array($session)) {
            return null;
        }

        if (!empty($session['name']) && preg_match('/(20\d{2}|19\d{2})/', $session['name'], $matches)) {
            return (int) $matches[1];
        }

        if (!empty($session['start_date'])) {
            $time = strtotime($session['start_date']);
            if ($time) {
                return (int) date('Y', $time);
            }
        }

        return null;
    }

    private function ordered_academic_sessions()
    {
        if (!$this->db->table_exists('academic_sessions')) {
            return array();
        }

        if ($this->db->field_exists('start_date', 'academic_sessions')) {
            $this->db->order_by('start_date', 'asc');
        } else {
            $this->db->order_by('name', 'asc');
        }

        return $this->db->get('academic_sessions')->result_array();
    }

    private function course_level_aliases($label, $number, $structure)
    {
        $aliases = array($label, strtolower($label), str_replace(' ', '-', strtolower($label)));

        if ($structure === 'contact') {
            $words = array(1 => 'one', 2 => 'two', 3 => 'three', 4 => 'four', 5 => 'five', 6 => 'six');
            $word = isset($words[$number]) ? $words[$number] : (string) $number;
            $aliases[] = 'Contact ' . $word;
            $aliases[] = 'contact-' . $word;
            $aliases[] = 'contact ' . $word;
            $aliases[] = (string) $number;
        } else {
            $aliases[] = (string) ($number * 100);
            $aliases[] = $number . '00';
            $aliases[] = 'Level ' . ($number * 100);
            $aliases[] = 'Year ' . $number;
        }

        return array_values(array_unique(array_filter($aliases, function ($value) {
            return $value !== null && trim((string) $value) !== '';
        })));
    }

    private function resolve_course_registration($studentId, $sessionId, $semesterId)
    {
        if (!$this->db->table_exists('course_registrations') || !$studentId) {
            return null;
        }

        $this->db->from('course_registrations');
        $this->db->where('student_id', $studentId);
        if ($sessionId) {
            $this->db->where('session_id', $sessionId);
        }
        if ($semesterId) {
            $this->db->where('semester_id', $semesterId);
        }
        $this->db->order_by('created_at', 'desc');
        $this->db->limit(1);
        return $this->db->get()->row_array();
    }

    private function resolve_available_courses($programmeId, $sessionId, $semesterId, $placement)
    {
        if (!$this->db->table_exists('courses')) {
            return array();
        }

        $semesterName = $this->resolve_semester_name($semesterId);
        $applyOfferingFilter = false;
        if ($this->db->table_exists('course_offerings') && $sessionId) {
            $this->db->from('course_offerings');
            if ($sessionId) {
                $this->db->where('session_id', $sessionId);
            }
            $offerCount = $this->db->count_all_results();
            $applyOfferingFilter = $offerCount > 0;
        }

        $this->db->select('c.id, c.code, c.title, c.credit_units, c.level, c.type');
        if ($this->db->field_exists('programme_structure', 'courses')) {
            $this->db->select('c.programme_structure, c.contact_number, c.year_number, c.semester_name');
        }
        if ($this->db->table_exists('course_offerings')) {
            $this->db->select('MIN(co.id) as offering_id', false);
            $this->db->select('MIN(co.lecturer_name) as lecturer_name', false);
            $this->db->select('MIN(co.schedule) as schedule', false);
        }
        $this->db->from('courses c');
        if ($this->db->table_exists('course_offerings')) {
            $this->db->join('course_offerings co', 'co.course_id = c.id', 'left');
            if ($applyOfferingFilter && $sessionId) {
                $this->db->where('co.session_id', $sessionId);
            }
        }
        if ($programmeId && $this->db->field_exists('programme_id', 'courses')) {
            $this->db->where('c.programme_id', $programmeId);
        }
        $this->apply_course_placement_filter($placement, $semesterName);
        $groupFields = array('c.id', 'c.code', 'c.title', 'c.credit_units', 'c.level', 'c.type');
        if ($this->db->field_exists('programme_structure', 'courses')) {
            $groupFields = array_merge($groupFields, array('c.programme_structure', 'c.contact_number', 'c.year_number', 'c.semester_name'));
        }
        $this->db->group_by($groupFields);
        $this->db->order_by('c.title');
        $rows = $this->db->get()->result_array();

        $courses = array();
        foreach ($rows as $row) {
            $courses[] = array(
                'id' => isset($row['id']) ? $row['id'] : null,
                'code' => isset($row['code']) ? $row['code'] : null,
                'title' => isset($row['title']) ? $row['title'] : null,
                'creditUnits' => isset($row['credit_units']) ? (int) $row['credit_units'] : 0,
                'type' => isset($row['type']) ? $row['type'] : 'core',
                'lecturer' => isset($row['lecturer_name']) ? $row['lecturer_name'] : null,
                'schedule' => isset($row['schedule']) ? $row['schedule'] : null,
                'offering_id' => isset($row['offering_id']) ? $row['offering_id'] : null,
            );
        }

        return $courses;
    }

    private function apply_course_placement_filter($placement, $semesterName = null)
    {
        if (!is_array($placement)) {
            return;
        }

        $hasLevel = $this->db->field_exists('level', 'courses');
        $hasStructure = $this->db->field_exists('programme_structure', 'courses');
        if (!$hasLevel && !$hasStructure) {
            return;
        }

        $structure = isset($placement['programme_structure']) ? $placement['programme_structure'] : 'semester';
        $aliases = isset($placement['aliases']) && is_array($placement['aliases']) ? $placement['aliases'] : array();

        $this->db->group_start();

        if ($hasStructure) {
            if ($structure === 'contact') {
                $this->db->group_start();
                $this->db->where('c.programme_structure', 'contact');
                if (isset($placement['contact_number']) && $placement['contact_number']) {
                    $this->db->where('c.contact_number', (int) $placement['contact_number']);
                }
                $this->db->group_end();
            } else {
                $this->db->group_start();
                $this->db->where('c.programme_structure', 'semester');
                if (isset($placement['year_number']) && $placement['year_number']) {
                    $this->db->where('c.year_number', (int) $placement['year_number']);
                }
                if ($semesterName && $this->db->field_exists('semester_name', 'courses')) {
                    $this->db->group_start();
                    $this->db->where('c.semester_name', $semesterName);
                    $this->db->or_where('c.semester_name IS NULL', null, false);
                    $this->db->or_where('c.semester_name', '');
                    $this->db->group_end();
                }
                $this->db->group_end();
            }
        }

        if ($hasLevel && (!$hasStructure || !empty($aliases))) {
            if ($hasStructure) {
                $this->db->or_group_start();
            } else {
                $this->db->group_start();
            }
            if (!empty($aliases)) {
                $this->db->where_in('c.level', $aliases);
            }
            if (!$hasStructure) {
                $this->db->or_where('c.level IS NULL', null, false);
                $this->db->or_where('c.level', '');
            }
            $this->db->group_end();
        }

        $this->db->group_end();
    }

    private function resolve_semester_name($semesterId)
    {
        if (!$semesterId || !$this->db->table_exists('semesters')) {
            return null;
        }

        $semester = $this->db->get_where('semesters', array('id' => $semesterId), 1)->row_array();
        return $semester && isset($semester['name']) ? $semester['name'] : null;
    }

    private function resolve_registration_course_ids($registrationId)
    {
        if (!$registrationId || !$this->db->table_exists('course_registration_items')) {
            return array();
        }

        $this->db->select('cri.course_offering_id, co.course_id');
        $this->db->from('course_registration_items cri');
        if ($this->db->table_exists('course_offerings')) {
            $this->db->join('course_offerings co', 'co.id = cri.course_offering_id', 'left');
        }
        $this->db->where('cri.course_registration_id', $registrationId);
        $rows = $this->db->get()->result_array();

        $ids = array();
        foreach ($rows as $row) {
            if (isset($row['course_id']) && $row['course_id']) {
                $ids[] = $row['course_id'];
            } elseif (isset($row['course_offering_id'])) {
                $ids[] = $row['course_offering_id'];
            }
        }
        return $ids;
    }

    private function resolve_carry_spill_course_list($programmeId, $sessionId, $currentSemesterId, $placement)
    {
        if (!$this->db->table_exists('courses')) {
            return array();
        }

        if (!$this->db->table_exists('course_offerings') || !$this->db->table_exists('semesters')) {
            return array();
        }

        if (!$currentSemesterId) {
            return array();
        }

        $currentSemester = $this->db
            ->get_where('semesters', array('id' => $currentSemesterId), 1)
            ->row_array();

        if (!$currentSemester || !isset($currentSemester['sort_order'])) {
            return array();
        }

        $currentSort = (int) $currentSemester['sort_order'];

        $this->db->select('c.id, c.code, c.title, c.credit_units, c.level, c.type');
        if ($this->db->field_exists('programme_structure', 'courses')) {
            $this->db->select('c.programme_structure, c.contact_number, c.year_number, c.semester_name');
        }
        $this->db->select('MIN(co.id) as offering_id', false);
        $this->db->select('MIN(co.lecturer_name) as lecturer_name', false);
        $this->db->select('MIN(co.schedule) as schedule', false);
        $this->db->from('courses c');
        $this->db->join('course_offerings co', 'co.course_id = c.id', 'left');
        $this->db->join('semesters sem', 'sem.id = co.semester_id', 'left');
        if ($sessionId) {
            $this->db->where('co.session_id', $sessionId);
        }
        $this->db->where('sem.sort_order <', $currentSort);
        if ($programmeId && $this->db->field_exists('programme_id', 'courses')) {
            $this->db->where('c.programme_id', $programmeId);
        }
        $this->apply_course_placement_filter($placement, null);
        $groupFields = array('c.id', 'c.code', 'c.title', 'c.credit_units', 'c.level', 'c.type');
        if ($this->db->field_exists('programme_structure', 'courses')) {
            $groupFields = array_merge($groupFields, array('c.programme_structure', 'c.contact_number', 'c.year_number', 'c.semester_name'));
        }
        $this->db->group_by($groupFields);
        $this->db->order_by('c.title');
        $rows = $this->db->get()->result_array();

        $courses = array();
        foreach ($rows as $row) {
            $courses[] = array(
                'id' => isset($row['id']) ? $row['id'] : null,
                'code' => isset($row['code']) ? $row['code'] : null,
                'title' => isset($row['title']) ? $row['title'] : null,
                'creditUnits' => isset($row['credit_units']) ? (int) $row['credit_units'] : 0,
                'type' => isset($row['type']) ? $row['type'] : 'core',
                'lecturer' => isset($row['lecturer_name']) ? $row['lecturer_name'] : null,
                'schedule' => isset($row['schedule']) ? $row['schedule'] : null,
                'offering_id' => isset($row['offering_id']) ? $row['offering_id'] : null,
            );
        }

        return $courses;
    }

    private function resolve_registration_courses($registrationId)
    {
        if (!$registrationId || !$this->db->table_exists('course_registration_items')) {
            return array();
        }

        $hasOfferings = $this->db->table_exists('course_offerings');

        $this->db->select('cri.course_type');
        if ($hasOfferings) {
            $this->db->select('c.id, c.code, c.title, c.credit_units, c.type');
            $this->db->select('co.lecturer_name, co.schedule');
        } else {
            $this->db->select('c.id, c.code, c.title, c.credit_units, c.type');
        }
        $this->db->from('course_registration_items cri');
        if ($hasOfferings) {
            $this->db->join('course_offerings co', 'co.id = cri.course_offering_id', 'left');
            $this->db->join('courses c', 'c.id = co.course_id', 'left');
        } else {
            $this->db->join('courses c', 'c.id = cri.course_offering_id', 'left');
        }
        $this->db->where('cri.course_registration_id', $registrationId);
        $rows = $this->db->get()->result_array();

        $courses = array();
        foreach ($rows as $row) {
            if (!isset($row['id'])) {
                continue;
            }
            $courses[] = array(
                'id' => $row['id'],
                'code' => isset($row['code']) ? $row['code'] : null,
                'title' => isset($row['title']) ? $row['title'] : null,
                'creditUnits' => isset($row['credit_units']) ? (int) $row['credit_units'] : 0,
                'type' => isset($row['course_type']) ? $row['course_type'] : (isset($row['type']) ? $row['type'] : 'core'),
                'lecturer' => isset($row['lecturer_name']) ? $row['lecturer_name'] : null,
                'schedule' => isset($row['schedule']) ? $row['schedule'] : null,
            );
        }

        return $courses;
    }

    private function resolve_course_rows($courseIds, $student, $sessionId, $semesterId, $placement = null)
    {
        if (empty($courseIds) || !$this->db->table_exists('courses')) {
            return array();
        }

        $semesterName = $this->resolve_semester_name($semesterId);
        $this->db->select('c.id, c.code, c.title, c.credit_units, c.type');
        if ($this->db->table_exists('course_offerings')) {
            $this->db->select('co.id as offering_id');
        }
        $this->db->from('courses c');
        if ($this->db->table_exists('course_offerings')) {
            $this->db->join('course_offerings co', 'co.course_id = c.id', 'left');
            if ($sessionId) {
                $this->db->where('co.session_id', $sessionId);
            }
        }
        $this->db->where_in('c.id', $courseIds);
        if (isset($student['programme_id']) && $this->db->field_exists('programme_id', 'courses')) {
            $this->db->where('c.programme_id', $student['programme_id']);
        }
        $this->apply_course_placement_filter($placement, $semesterName);
        $rows = $this->db->get()->result_array();
        return $rows;
    }

    private function generate_application_no()
    {
        $prefix = 'APP-';
        $unique = strtoupper(dechex(time())) . '-' . strtoupper(substr(md5(uniqid('', true)), 0, 6));
        return $prefix . $unique;
    }

    private function resolve_programme_id($payload)
    {
        if (!$this->db->table_exists('programmes')) {
            return null;
        }

        $code = null;
        if (isset($payload['academic']) && is_array($payload['academic'])) {
            $academic = $payload['academic'];
            if (isset($academic['firstChoiceProgram'])) {
                $code = $academic['firstChoiceProgram'];
            }
        }

        if (!$code) {
            return null;
        }

        $query = $this->db->get_where('programmes', array('code' => $code), 1);
        $row = $query->row_array();
        if ($row && isset($row['id'])) {
            return $row['id'];
        }

        // Auto-create a minimal programme if code not found, to satisfy FK constraints
        $deptId = $this->ensure_default_department();
        if (!$deptId) {
            return null;
        }

        $programmeId = $this->generate_uuid();
        $this->db->insert('programmes', array(
            'id' => $programmeId,
            'department_id' => $deptId,
            'name' => $code,
            'code' => $code,
            'award' => null,
            'duration_years' => 2,
            'created_at' => date('Y-m-d H:i:s')
        ));

        return $programmeId;
    }

    private function ensure_default_department()
    {
        if (!$this->db->table_exists('departments')) {
            return null;
        }

        // Reuse any existing department if present
        $existing = $this->db->get('departments', 1)->row_array();
        if ($existing && isset($existing['id'])) {
            return $existing['id'];
        }

        $deptId = $this->generate_uuid();
        $this->db->insert('departments', array(
            'id' => $deptId,
            'name' => 'General Studies',
            'code' => 'GEN',
            'created_at' => date('Y-m-d H:i:s')
        ));

        return $deptId;
    }

    private function requires_manual_id($table)
    {
        $column = $this->db->query("SHOW COLUMNS FROM `{$table}` LIKE 'id'");
        if (!$column || $column->num_rows() === 0) {
            return false;
        }

        $row = $column->row_array();
        $extra = isset($row['Extra']) ? strtolower($row['Extra']) : '';
        // If not auto increment, caller should supply an id
        return strpos($extra, 'auto_increment') === false;
    }

    private function generate_uuid()
    {
        // RFC4122 v4 style UUID generation
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }

    private function pdf_text($value)
    {
        $text = trim((string) $value);
        if ($text === '') {
            return '-';
        }

        if (function_exists('iconv')) {
            $converted = @iconv('UTF-8', 'windows-1252//TRANSLIT', $text);
            if ($converted !== false) {
                return $converted;
            }
        }

        return $text;
    }

    private function pdf_fit_text($pdf, $value, $maxWidth)
    {
        $text = $this->pdf_text($value);
        if ($pdf->GetStringWidth($text) <= $maxWidth) {
            return $text;
        }

        $suffix = '...';
        $limit = max(1, strlen($text));
        while ($limit > 1) {
            $candidate = rtrim(substr($text, 0, $limit)) . $suffix;
            if ($pdf->GetStringWidth($candidate) <= $maxWidth) {
                return $candidate;
            }
            $limit--;
        }

        return $suffix;
    }

    private function resolve_college_logo_path()
    {
        $candidates = array(
            APPPATH . 'assets/logo.png',
            APPPATH . 'assets/logo.png',
            APPPATH . 'assets/college_logo.png',
            FCPATH . 'logo.png',
            FCPATH . 'assets/logo.png',
            dirname(dirname(dirname(FCPATH))) . DIRECTORY_SEPARATOR . 'Reatjs' . DIRECTORY_SEPARATOR . 'maslaha' . DIRECTORY_SEPARATOR . 'src' . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'logo.png',
            dirname(dirname(dirname(FCPATH))) . DIRECTORY_SEPARATOR . 'Reatjs' . DIRECTORY_SEPARATOR . 'maslaha' . DIRECTORY_SEPARATOR . 'src' . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'logo.png',
            dirname(dirname(dirname(FCPATH))) . DIRECTORY_SEPARATOR . 'Reatjs' . DIRECTORY_SEPARATOR . 'maslaha' . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'logo.png',
        );

        foreach ($candidates as $candidate) {
            if ($candidate && is_file($candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    private function load_fpdi_if_available()
    {
        if (class_exists('\\setasign\\Fpdi\\Fpdi') || class_exists('Fpdi')) {
            return;
        }

        $autoloadCandidates = array(
            FCPATH . 'vendor/autoload.php',
            APPPATH . 'third_party/fpdi/autoload.php',
            APPPATH . 'third_party/fpdi/src/autoload.php',
            APPPATH . 'third_party/fdpi/autoload.php',
            APPPATH . 'third_party/fdpi/src/autoload.php',
        );

        foreach ($autoloadCandidates as $autoloadFile) {
            if (is_file($autoloadFile)) {
                require_once $autoloadFile;
                if (class_exists('\\setasign\\Fpdi\\Fpdi') || class_exists('Fpdi')) {
                    return;
                }
            }
        }
    }

    private function draw_semester_template_rows($pdf, $rows, $startY, $snoX, $codeX, $titleX, $unitX, $maxRows = 15)
    {
        $rowHeight = 6;
        $rowAdjust = 0.2;
        $totalUnits = 0;

        $pdf->SetFont('Arial', '', 10);
        for ($index = 0; $index < $maxRows; $index++) {
            $row = isset($rows[$index]) ? $rows[$index] : null;
            $code = $row && isset($row['code']) ? $row['code'] : '';
            $courseTitle = $row && isset($row['title']) ? $row['title'] : '';
            $unit = $row && isset($row['creditUnits']) ? $row['creditUnits'] : '';

            if (strlen($courseTitle) > 36) {
                $courseTitle = substr($courseTitle, 0, 35) . '…';
            }

            $currentY = $startY + ($index * ($rowHeight - $rowAdjust));
            $serial = $row ? (string) ($index + 1) : '';
            $unitText = $row ? (string) $unit : '';

            if ($row) {
                $totalUnits += (int) $unit;
            }

            $pdf->SetXY($snoX, $currentY);
            $pdf->Cell(20, $rowHeight, $this->pdf_text($serial), 0, 0, 'L');

            $pdf->SetXY($codeX, $currentY);
            $pdf->Cell(35, $rowHeight, $this->pdf_text($code), 0, 0, 'L');

            $pdf->SetXY($titleX, $currentY);
            $pdf->Cell(80, $rowHeight, $this->pdf_text($courseTitle), 0, 0, 'L');

            $pdf->SetXY($unitX, $currentY);
            $pdf->Cell(15, $rowHeight, $this->pdf_text($unitText), 0, 0, 'C');
        }

        return $totalUnits;
    }

    private function draw_semester_table($pdf, $x, $y, $width, $title, $rows, $maxRows = 12)
    {
        $rowHeight = 6;
        $headerHeight = 10;
        $colSno = 14;
        $colCode = 26;
        $colUnit = 18;
        $colTitle = $width - ($colSno + $colCode + $colUnit);

        $pdf->SetFont('Arial', 'B', 11);
        $pdf->SetXY($x, $y);
        $pdf->Cell($width, $headerHeight, $this->pdf_text($title), 1, 1, 'C');

        $pdf->SetFont('Arial', 'B', 10);
        $pdf->SetXY($x, $y + $headerHeight);
        $pdf->Cell($colSno, $rowHeight, $this->pdf_text('S/NO'), 1, 0, 'C');
        $pdf->Cell($colCode, $rowHeight, $this->pdf_text('CODE'), 1, 0, 'C');
        $pdf->Cell($colTitle, $rowHeight, $this->pdf_text('COURSE TITLE'), 1, 0, 'C');
        $pdf->Cell($colUnit, $rowHeight, $this->pdf_text('UNIT'), 1, 1, 'C');

        $pdf->SetFont('Arial', '', 9);
        for ($index = 0; $index < $maxRows; $index++) {
            $currentY = $y + $headerHeight + $rowHeight + ($index * $rowHeight);
            $row = isset($rows[$index]) ? $rows[$index] : null;

            $code = $row && isset($row['code']) ? $row['code'] : '';
            $courseTitle = $row && isset($row['title']) ? $row['title'] : '';
            $unit = $row && isset($row['creditUnits']) ? $row['creditUnits'] : '';

            if (strlen($courseTitle) > 38) {
                $courseTitle = substr($courseTitle, 0, 37) . '…';
            }

            $pdf->SetXY($x, $currentY);
            $pdf->Cell($colSno, $rowHeight, $row ? (string) ($index + 1) : '', 1, 0, 'C');
            $pdf->Cell($colCode, $rowHeight, $this->pdf_text($code), 1, 0, 'L');
            $pdf->Cell($colTitle, $rowHeight, $this->pdf_text($courseTitle), 1, 0, 'L');
            $pdf->Cell($colUnit, $rowHeight, $this->pdf_text((string) $unit), 1, 1, 'C');
        }
    }

    private function build_profile_payload($profile)
    {
        if (!is_array($profile)) {
            return array();
        }

        return array(
            'id' => isset($profile['id']) ? $profile['id'] : null,
            'student_id' => isset($profile['student_id']) ? $profile['student_id'] : null,
            'full_name' => isset($profile['full_name']) ? $profile['full_name'] : null,
            'email' => isset($profile['email']) ? $profile['email'] : null,
            'phone' => isset($profile['phone']) ? $profile['phone'] : null,
            'nin' => isset($profile['nin']) ? $profile['nin'] : null,
            'dob' => isset($profile['dob']) ? $profile['dob'] : null,
            'gender' => isset($profile['gender']) ? $profile['gender'] : null,
            'address' => isset($profile['address']) ? $profile['address'] : null,
            'state' => isset($profile['state']) ? $profile['state'] : null,
            'lga' => isset($profile['lga']) ? $profile['lga'] : null,
            'guardian_name' => isset($profile['guardian_name']) ? $profile['guardian_name'] : null,
            'guardian_phone' => isset($profile['guardian_phone']) ? $profile['guardian_phone'] : null,
            'guardian_relationship' => isset($profile['guardian_relationship']) ? $profile['guardian_relationship'] : null,
            'guardian_address' => isset($profile['guardian_address']) ? $profile['guardian_address'] : null,
            'next_of_kin' => isset($profile['next_of_kin']) ? $profile['next_of_kin'] : null,
            'next_of_kin_phone' => isset($profile['next_of_kin_phone']) ? $profile['next_of_kin_phone'] : null,
            'session' => isset($profile['session_name']) && $profile['session_name'] ? $profile['session_name'] : '2024/2025',
            'current_level' => isset($profile['current_level']) ? $profile['current_level'] : null,
            'student_status' => isset($profile['student_status']) ? $profile['student_status'] : null,
            'programme_name' => isset($profile['programme_name']) ? $profile['programme_name'] : null,
            'department_name' => isset($profile['department_name']) ? $profile['department_name'] : null,
            'onboarding_source' => isset($profile['onboarding_source']) ? $profile['onboarding_source'] : null,
            'profile_completion_status' => isset($profile['profile_completion_status']) ? $profile['profile_completion_status'] : null,
            'account_update_required' => isset($profile['account_update_required']) ? (int) $profile['account_update_required'] : 0,
            'education' => isset($profile['education']) ? $profile['education'] : null,
            'academic' => isset($profile['academic']) ? $profile['academic'] : null,
            'oLevel' => isset($profile['oLevel']) ? $profile['oLevel'] : null,
        );
    }

    private function json_response($status, $payload)
    {
        $this->output
            ->set_status_header($status)
            ->set_content_type('application/json')
            ->set_output(json_encode($payload));
        return;
    }

    private function json_payload()
    {
        $payload = json_decode($this->input->raw_input_stream, true);
        return is_array($payload) ? $payload : array();
    }

    private function decode_payload($payload)
    {
        if (!$payload) {
            return array();
        }

        $decoded = json_decode($payload, true);
        return is_array($decoded) ? $decoded : array();
    }

    private function normalize_admission_status($status)
    {
        $value = strtolower((string) $status);
        switch ($value) {
            case 'admitted':
            case 'approved':
                return 'admitted';
            case 'rejected':
                return 'rejected';
            case 'waitlisted':
            case 'waitlist':
                return 'waitlisted';
            case 'review':
            case 'under_review':
            case 'processing':
                return 'under_review';
            case 'submitted':
            case 'draft':
            case 'pending':
            default:
                return 'pending';
        }
    }

    private function build_review_stages($status, $appliedAt, $updatedAt, $decisionDate)
    {
        $hasApplication = !empty($appliedAt);
        $documentsDone = in_array($status, array('under_review', 'admitted', 'rejected', 'waitlisted'), true);
        $academicDone = in_array($status, array('admitted', 'rejected', 'waitlisted'), true);
        $decisionDone = in_array($status, array('admitted', 'rejected', 'waitlisted'), true);

        return array(
            array(
                'name' => 'Application Submitted',
                'completed' => $hasApplication,
                'date' => $hasApplication ? $appliedAt : null,
            ),
            array(
                'name' => 'Documents Verified',
                'completed' => $documentsDone,
                'date' => $documentsDone ? $updatedAt : null,
            ),
            array(
                'name' => 'Academic Review',
                'completed' => $academicDone,
                'date' => $academicDone ? $updatedAt : null,
            ),
            array(
                'name' => 'Final Decision',
                'completed' => $decisionDone,
                'date' => $decisionDone ? $decisionDate : null,
            ),
        );
    }

    private function resolve_session_name($sessionId)
    {
        if (!$sessionId || !$this->db->table_exists('academic_sessions')) {
            return null;
        }

        $row = $this->db->get_where('academic_sessions', array('id' => $sessionId), 1)->row_array();
        return $row && isset($row['name']) ? $row['name'] : null;
    }

    private function combine_names($source)
    {
        if (!is_array($source)) {
            return null;
        }

        $parts = array();
        foreach (array('first_name', 'middle_name', 'last_name', 'firstName', 'middleName', 'lastName') as $key) {
            if (isset($source[$key]) && $source[$key]) {
                $parts[] = trim($source[$key]);
            }
        }

        return empty($parts) ? null : trim(implode(' ', $parts));
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

    private function array_get($array, $path, $default = null)
    {
        if (!is_array($array) || !$path) {
            return $default;
        }

        $segments = explode('.', $path);
        $value = $array;

        foreach ($segments as $segment) {
            if (is_array($value) && array_key_exists($segment, $value)) {
                $value = $value[$segment];
            } else {
                return $default;
            }
        }

        return $value;
    }
}

<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Admin_graduation extends CI_Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->load->model('Graduation_model');
        $this->load->model('Results_model');
        $this->load->library('session');
    }

    private function token_secret()
    {
        $key = $this->config->item('encryption_key');
        return $key ? $key : 'aacas-local-admin-token-secret';
    }

    private function user_from_bearer_token()
    {
        $authorization = $this->input->get_request_header('Authorization', true);
        if (!$authorization && isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $authorization = $_SERVER['HTTP_AUTHORIZATION'];
        }
        if (!$authorization && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $authorization = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        }
        if (!$authorization || stripos($authorization, 'Bearer ') !== 0) {
            return null;
        }

        $token = trim(substr($authorization, 7));
        $parts = explode('.', $token);
        if (count($parts) !== 2) {
            return null;
        }

        $payloadPart = $parts[0];
        $signature = $parts[1];
        $expectedSignature = hash_hmac('sha256', $payloadPart, $this->token_secret());
        if (!hash_equals($expectedSignature, $signature)) {
            return null;
        }

        $payloadJson = base64_decode(strtr($payloadPart, '-_', '+/'));
        $payload = json_decode($payloadJson, true);
        if (!is_array($payload) || empty($payload['sub']) || empty($payload['exp']) || time() > (int) $payload['exp']) {
            return null;
        }

        $this->load->model('User_model');
        $user = $this->User_model->find_by_id($payload['sub']);
        if (!$user || !empty($user['deleted_at']) || (isset($user['status']) && $user['status'] !== 'active')) {
            return null;
        }

        return $user;
    }

    private function require_login()
    {
        if ($this->session->userdata('user_id') && $this->session->userdata('logged_in')) {
            return array(
                'id' => $this->session->userdata('user_id'),
                'email' => $this->session->userdata('email')
            );
        }

        $user = $this->user_from_bearer_token();
        if ($user) {
            return $user;
        }

        $this->json_response(401, array(
            'status' => 'error',
            'message' => 'Authentication required.'
        ));
        exit;
    }

    private function json_response($status, $payload)
    {
        $json = json_encode($payload);
        if ($json !== false) {
            $json = str_replace(array("\xEF\xBF\xBD", "\u{FFFD}", "\\ufffd", "\\uFFFD", "\xE2\x80\x99", "\xE2\x80\x98", '’', '‘', '`', '´'), "'", $json);
        }
        $this->output
            ->set_status_header($status)
            ->set_content_type('application/json')
            ->set_output($json);
    }

    public function index()
    {
        return $this->get_list();
    }

    public function __call($name, $arguments)
    {
        if ($name === 'list') {
            return $this->get_list();
        }
        if ($name === 'config') {
            return ($_SERVER['REQUEST_METHOD'] === 'POST') ? $this->save_config() : $this->get_config();
        }
        if ($name === 'save_config') {
            return $this->save_config();
        }
        return $this->json_response(404, array('status' => 'error', 'message' => "Method {$name} not found"));
    }

    /**
     * GET api/admin/graduation/list
     * Evaluates graduation clearance and returns cleared vs ineligible lists
     */
    public function get_list()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();

        $filters = [
            'session_id'             => $this->input->get('session_id', true),
            'programme_id'           => $this->input->get('programme_id', true),
            'cohort'                 => $this->input->get('cohort', true),
            'entry_mode'             => $this->input->get('entry_mode', true),
            'framework'              => $this->input->get('framework', true),
            'min_cgpa'               => $this->input->get('min_cgpa', true),
            'min_tce_utme'           => $this->input->get('min_tce_utme', true),
            'min_tce_de'             => $this->input->get('min_tce_de', true),
            'final_contact'          => $this->input->get('final_contact', true),
            'strict_zero_carryovers' => $this->input->get('strict_zero_carryovers', true),
            'strict_zero_pending'    => $this->input->get('strict_zero_pending', true),
            'search'                 => $this->input->get('search', true),
        ];

        try {
            $data = $this->Graduation_model->audit_cohort_graduation($filters);
            return $this->json_response(200, [
                'status' => 'success',
                'data'   => $data,
            ]);
        } catch (Throwable $e) {
            log_message('error', 'Graduation audit error: ' . $e->getMessage());
            return $this->json_response(500, [
                'status'  => 'error',
                'message' => 'Failed to generate graduation list: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine(),
            ]);
        }
    }

    /**
     * GET api/admin/graduation/config
     * Returns current graduation rules configuration
     */
    public function get_config()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();

        $session_id   = !empty($this->input->get('session_id', true)) && $this->input->get('session_id', true) !== 'null' ? trim($this->input->get('session_id', true)) : null;
        $programme_id = !empty($this->input->get('programme_id', true)) && $this->input->get('programme_id', true) !== 'null' ? trim($this->input->get('programme_id', true)) : null;

        $config = $this->Graduation_model->get_config($session_id, $programme_id);
        return $this->json_response(200, [
            'status' => 'success',
            'data'   => $config,
        ]);
    }

    /**
     * POST api/admin/graduation/config
     * Saves graduation settings
     */
    public function save_config()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();

        $raw = file_get_contents('php://input');
        $payload = json_decode($raw, true);
        if (!is_array($payload)) {
            $payload = $this->input->post();
        }

        $session_id   = !empty($payload['session_id']) && $payload['session_id'] !== 'null' ? trim($payload['session_id']) : null;
        $programme_id = !empty($payload['programme_id']) && $payload['programme_id'] !== 'null' ? trim($payload['programme_id']) : null;
        $settings     = $payload['settings'] ?? $payload;

        // Discard session/programme wrappers from settings payload
        if (is_array($settings)) {
            unset($settings['session_id'], $settings['programme_id']);
        }

        try {
            $res = $this->Graduation_model->save_config($settings, $session_id, $programme_id, $user['id'] ?? null);
            if ($res) {
                return $this->json_response(200, [
                    'status'  => 'success',
                    'message' => 'Graduation configuration saved successfully.',
                    'data'    => $this->Graduation_model->get_config($session_id, $programme_id),
                ]);
            } else {
                return $this->json_response(500, [
                    'status'  => 'error',
                    'message' => 'Failed to save graduation settings.',
                ]);
            }
        } catch (\Throwable $e) {
            log_message('error', 'save_config error: ' . $e->getMessage());
            return $this->json_response(500, [
                'status'  => 'error',
                'message' => 'Error saving graduation settings: ' . $e->getMessage(),
            ]);
        }
    }

    /**
     * GET api/admin/graduation/student-audit
     * Full single-student graduation and transcript audit
     */
    public function student_audit()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();

        $student_id = $this->input->get('student_id', true);
        $session_id = $this->input->get('session_id', true);

        if (!$student_id) {
            return $this->json_response(400, ['status' => 'error', 'message' => 'student_id is required']);
        }

        $audit = $this->Graduation_model->audit_single_student($student_id, $session_id);
        if (!$audit) {
            return $this->json_response(404, ['status' => 'error', 'message' => 'Student not found']);
        }

        return $this->json_response(200, [
            'status' => 'success',
            'data'   => $audit,
        ]);
    }

    /**
     * GET api/admin/graduation/export
     * CSV Export of cleared graduating students or deficiency audit
     */
    public function export_csv()
    {
        $user = $this->require_login();

        $type = $this->input->get('type', true) ?: 'cleared'; // 'cleared' or 'ineligible'
        $filters = [
            'session_id'             => $this->input->get('session_id', true),
            'programme_id'           => $this->input->get('programme_id', true),
            'cohort'                 => $this->input->get('cohort', true),
            'entry_mode'             => $this->input->get('entry_mode', true),
            'framework'              => $this->input->get('framework', true),
            'min_cgpa'               => $this->input->get('min_cgpa', true),
            'min_tce_utme'           => $this->input->get('min_tce_utme', true),
            'min_tce_de'             => $this->input->get('min_tce_de', true),
            'final_contact'          => $this->input->get('final_contact', true),
            'strict_zero_carryovers' => $this->input->get('strict_zero_carryovers', true),
            'strict_zero_pending'    => $this->input->get('strict_zero_pending', true),
        ];

        $audit = $this->Graduation_model->audit_cohort_graduation($filters);
        $prog_name = preg_replace('/[^a-zA-Z0-9_-]/', '_', $audit['metadata']['programme_name'] ?? 'Graduation');
        $filename = "Graduation_List_{$prog_name}_" . date('Ymd_His') . ".csv";

        header('Content-Type: text/csv; charset=utf-8');
        header("Content-Disposition: attachment; filename=\"{$filename}\"");

        $out = fopen('php://output', 'w');
        fputs($out, "\xEF\xBB\xBF"); // UTF-8 BOM

        if ($type === 'cleared') {
            // Header matching 15 columns of sample PDF
            fputcsv($out, [
                'S/N',
                'MATRIC NO.',
                'NAMES',
                'GENDER',
                'JAMB REG. NO',
                'DATE OF BIRTH',
                'ORIGIN',
                'CURRENT LEVEL',
                'ENTERY LEVEL',
                'ENTERY MODE',
                'YEAR ADMITTED',
                'TCE',
                'CGPA',
                'CLASS',
                'REMARK'
            ]);

            foreach ($audit['graduating_students'] as $st) {
                fputcsv($out, [
                    $st['sn'],
                    $st['matric_number'],
                    $st['names'],
                    $st['gender'],
                    $st['jamb_reg_no'],
                    $st['dob'],
                    $st['origin'],
                    $st['current_level'],
                    $st['entry_level'],
                    $st['entry_mode'],
                    $st['year_admitted'],
                    $st['tce'],
                    $st['cgpa'],
                    $st['class'],
                    $st['remark']
                ]);
            }
        } else {
            // Ineligible / Deficiency export
            fputcsv($out, [
                'S/N',
                'MATRIC NO.',
                'NAMES',
                'GENDER',
                'ENTRY MODE',
                'YEAR ADMITTED',
                'TCE EARNED',
                'CGPA',
                'OUTSTANDING FAILURES',
                'PENDING COURSES',
                'PRIMARY DEFICIENCY REASONS'
            ]);

            foreach ($audit['ineligible_students'] as $st) {
                $reasons = [];
                foreach ($st['deficiencies'] as $def) {
                    $reasons[] = $def['message'];
                }
                fputcsv($out, [
                    $st['sn'],
                    $st['matric_number'],
                    $st['names'],
                    $st['gender'],
                    $st['entry_mode'],
                    $st['year_admitted'],
                    $st['tce'],
                    $st['cgpa'],
                    implode('; ', $st['outstanding_courses']),
                    implode('; ', $st['pending_courses']),
                    implode(' | ', $reasons),
                ]);
            }
        }

        fclose($out);
        exit;
    }
}


<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Admin_course_registration extends CI_Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->load->database();
        $this->load->model('Course_registration_model');
        if (!class_exists('Registration_service', false)) {
            if (file_exists(APPPATH . 'libraries/Registration_service.php')) {
                require_once APPPATH . 'libraries/Registration_service.php';
            } elseif (file_exists(APPPATH . 'libraries/registration_service.php')) {
                require_once APPPATH . 'libraries/registration_service.php';
            }
        }
        $this->load->library('Registration_service');
    }

    private function token_secret()
    {
        $key = $this->config->item('encryption_key');
        return $key ? $key : 'aacas-local-admin-token-secret';
    }

    private function require_login()
    {
        $authorization = $this->input->get_request_header('Authorization', true);
        if (!$authorization && isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $authorization = $_SERVER['HTTP_AUTHORIZATION'];
        }
        if (!$authorization && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $authorization = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        }
        if (!$authorization || stripos($authorization, 'Bearer ') !== 0) {
            $this->json_response(401, array('status' => 'error', 'message' => 'Unauthorized'));
        }

        $token = trim(substr($authorization, 7));
        $parts = explode('.', $token);
        if (count($parts) !== 2) {
            $this->json_response(401, array('status' => 'error', 'message' => 'Invalid token format'));
        }

        $payloadPart = $parts[0];
        $signature = $parts[1];
        $expectedSignature = hash_hmac('sha256', $payloadPart, $this->token_secret());
        if (!hash_equals($expectedSignature, $signature)) {
            $this->json_response(401, array('status' => 'error', 'message' => 'Invalid token signature'));
        }

        $payloadJson = base64_decode(strtr($payloadPart, '-_', '+/'));
        $user = json_decode($payloadJson, true);
        
        if (!$user) {
            $this->json_response(401, array('status' => 'error', 'message' => 'Invalid or expired token'));
        }
        if (empty($user['id']) && !empty($user['sub'])) {
            $user['id'] = $user['sub'];
        }
        return $user;
    }

    private function require_admin()
    {
        $user = $this->require_login();
        $user_id = isset($user['id']) ? $user['id'] : (isset($user['sub']) ? $user['sub'] : null);
        if (!$user_id) {
            $this->json_response(401, array('status' => 'error', 'message' => 'Invalid user identity'));
        }

        // 1. Verify token expiry if exp claim exists
        if (isset($user['exp']) && time() > (int)$user['exp']) {
            $this->json_response(401, array('status' => 'error', 'message' => 'Token expired. Please login again.'));
        }

        // 2. Reject if this user is a student (has a student record and no admin roles)
        $is_student = $this->db->get_where('students', array('user_id' => $user_id), 1)->row_array();
        if ($is_student) {
            $has_admin_role = false;
            if ($this->db->table_exists('user_roles') && $this->db->table_exists('roles')) {
                $this->db->select('r.slug, r.name');
                $this->db->from('user_roles ur');
                $this->db->join('roles r', 'r.id = ur.role_id');
                $this->db->where('ur.user_id', $user_id);
                $this->db->where('r.is_active', 1);
                $roles = $this->db->get()->result_array();
                foreach ($roles as $r) {
                    $slug = strtolower($r['slug'] ?? $r['name'] ?? '');
                    if (strpos($slug, 'exam') !== false || in_array($slug, array('super_admin', 'administrator', 'admin', 'registry', 'exam', 'exams_officer', 'exam_officer', 'finance', 'staff', 'lecturer'))) {
                        $has_admin_role = true;
                        break;
                    }
                }
            }
            if (!$has_admin_role) {
                $this->json_response(403, array('status' => 'error', 'message' => 'Access denied: Administrative privileges required.'));
            }
        }

        return $user;
    }

    private function json_response($code, $data)
    {
        $json = json_encode($data);
        if ($json !== false) {
            $json = str_replace(array("\xEF\xBF\xBD", "\u{FFFD}", "\\ufffd", "\\uFFFD", "\xE2\x80\x99", "\xE2\x80\x98", 'â€™', 'â€˜', '`', 'Â´'), "'", $json);
        }
        $this->output
            ->set_status_header($code)
            ->set_content_type('application/json')
            ->set_output($json)
            ->_display();
        exit;
    }

    // =========================================================================
    // SETTINGS
    // =========================================================================

    public function get_settings()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_admin();

        $session_id = $this->input->get('session_id', true);
        $semester_id = $this->input->get('semester_id', true);

        $settings = $this->Course_registration_model->get_registration_settings($session_id, $semester_id);

        return $this->json_response(200, array('status' => 'success', 'data' => $settings));
    }

    public function save_settings()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_admin();
        $payload = json_decode(file_get_contents('php://input'), true);

        $result = $this->Course_registration_model->save_registration_settings($payload);

        return $this->json_response(200, array('status' => 'success', 'message' => 'Settings saved'));
    }

    public function get_credit_rules()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_admin();
        $programme_id = $this->input->get('programme_id', true);

        if (!$this->db->table_exists('credit_load_rules')) {
            $this->Course_registration_model->ensure_registration_columns();
        }
        if (!$this->db->table_exists('credit_load_rules')) {
            return $this->json_response(200, array('status' => 'success', 'data' => array()));
        }

        $this->db->select('r.*, p.name as programme_name');
        $this->db->from('credit_load_rules r');
        $this->db->join('programmes p', 'p.id = r.programme_id', 'left');
        if ($programme_id) {
            $this->db->where('r.programme_id', $programme_id);
        }
        $this->db->order_by("CASE WHEN UPPER(r.programme_id) = 'GLOBAL' THEN 0 ELSE 1 END", 'ASC', false);
        $this->db->order_by('p.name', 'ASC');
        $this->db->order_by("CASE WHEN UPPER(r.level) = 'ALL' THEN 0 ELSE 1 END", 'ASC', false);
        $this->db->order_by('r.level', 'ASC');
        $rules = $this->db->get()->result_array();

        foreach ($rules as &$row) {
            if (strtoupper((string)($row['programme_id'] ?? '')) === 'GLOBAL') {
                $row['programme_name'] = 'All Programmes (Global Default)';
            }
        }
        unset($row);

        return $this->json_response(200, array('status' => 'success', 'data' => $rules));
    }

    public function save_credit_rules()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_admin();
        $payload = json_decode(file_get_contents('php://input'), true);

        if (!$this->db->table_exists('credit_load_rules')) {
            $this->Course_registration_model->ensure_registration_columns();
        }
        if (!$this->db->table_exists('credit_load_rules')) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'credit_load_rules table does not exist.'));
        }

        if (isset($payload['action']) && $payload['action'] === 'delete' && !empty($payload['id'])) {
            $this->db->where('id', $payload['id']);
            $this->db->delete('credit_load_rules');
            return $this->json_response(200, array(
                'status'  => 'success',
                'message' => 'Credit load rule deleted.'
            ));
        }

        $rules = isset($payload['rules']) && is_array($payload['rules']) ? $payload['rules'] : array($payload);
        $saved = 0;
        $now = date('Y-m-d H:i:s');

        foreach ($rules as $r) {
            $programme_id = trim((string)($r['programme_id'] ?? ''));
            $level        = trim((string)($r['level'] ?? ''));
            $min_credits  = isset($r['min_credits']) ? (int)$r['min_credits'] : 15;
            $max_credits  = isset($r['max_credits']) ? (int)$r['max_credits'] : 24;
            $rule_id      = $r['id'] ?? null;
            $semester_id  = !empty($r['semester_id']) ? $r['semester_id'] : null;

            if ($programme_id === '' || $level === '') {
                continue;
            }

            if (in_array(strtolower($programme_id), array('global', 'all', '*', 'default'), true)) {
                $programme_id = 'GLOBAL';
            }

            if (in_array(strtolower($level), array('all', '*', 'default', 'all contacts', 'all levels'), true)) {
                $level = 'ALL';
            } else {
                $step = $this->Course_registration_model->extract_level_step($level);
                if ($step !== null && stripos($level, 'level') === false) {
                    $level = 'Contact ' . $step;
                }
            }

            $existing = null;
            if ($rule_id) {
                $existing = $this->db->get_where('credit_load_rules', array('id' => $rule_id), 1)->row_array();
            }
            if (!$existing) {
                $level_aliases = ($level === 'ALL')
                    ? array('ALL', 'all', '*', 'default')
                    : $this->Course_registration_model->get_level_aliases($level);
                if (empty($level_aliases)) {
                    $level_aliases = array($level);
                }

                $this->db->where('programme_id', $programme_id);
                $this->db->where_in('level', $level_aliases);
                if ($semester_id) {
                    $this->db->where('semester_id', $semester_id);
                } else {
                    $this->db->where('semester_id IS NULL', null, false);
                }
                $existing = $this->db->get('credit_load_rules', 1)->row_array();
            }

            if ($existing) {
                $this->db->where('id', $existing['id']);
                $this->db->update('credit_load_rules', array(
                    'programme_id' => $programme_id,
                    'level'        => $level,
                    'min_credits'  => $min_credits,
                    'max_credits'  => $max_credits,
                    'updated_at'   => $now,
                ));
                $saved++;
            } else {
                $this->db->insert('credit_load_rules', array(
                    'id'           => $this->Course_registration_model->generate_uuid(),
                    'programme_id' => $programme_id,
                    'level'        => $level,
                    'semester_id'  => $semester_id,
                    'min_credits'  => $min_credits,
                    'max_credits'  => $max_credits,
                    'created_at'   => $now,
                    'updated_at'   => $now,
                ));
                $saved++;
            }
        }

        return $this->json_response(200, array(
            'status'  => 'success',
            'message' => "Successfully saved {$saved} credit load rule(s)."
        ));
    }

    /**
     * Resolves and attaches min_credits, max_credits, credit_rule_scope, and credit_status
     * onto each registration row using a single pre-fetched credit_load_rules table snapshot.
     */
    private function attach_credit_rule_metadata(array &$registrations)
    {
        if (empty($registrations)) {
            return;
        }

        $all_rules = array();
        if ($this->db->table_exists('credit_load_rules')) {
            $all_rules = $this->db->get('credit_load_rules')->result_array();
        }

        foreach ($registrations as &$reg) {
            $prog_id = !empty($reg['programme_id']) ? (string)$reg['programme_id'] : (string)($reg['student_programme_id'] ?? '');
            $lvl_raw = !empty($reg['level']) ? (string)$reg['level'] : (string)($reg['semester_name'] ?? $reg['semester_id'] ?? '');
            $sem_id  = !empty($reg['semester_id']) ? (string)$reg['semester_id'] : null;

            $level_aliases = $this->Course_registration_model->get_level_aliases($lvl_raw);
            $level_aliases_lower = array_map('strtolower', $level_aliases);

            $best_rule  = null;
            $best_score = -1;

            foreach ($all_rules as $row) {
                $r_prog  = strtoupper(trim((string)($row['programme_id'] ?? '')));
                $r_level = trim((string)($row['level'] ?? ''));
                $r_sem   = isset($row['semester_id']) && $row['semester_id'] !== '' ? trim((string)$row['semester_id']) : null;

                $is_exact_prog  = ($prog_id !== '' && strcasecmp($row['programme_id'] ?? '', $prog_id) === 0);
                $is_global_prog = in_array($r_prog, array('GLOBAL', 'ALL', '*', 'DEFAULT'), true);
                if (!$is_exact_prog && !$is_global_prog) {
                    continue;
                }

                $r_level_lower = strtolower($r_level);
                $is_all_level  = in_array($r_level_lower, array('all', '*', 'default', 'all contacts', 'all levels'), true);
                $is_exact_lvl  = false;
                if (!$is_all_level && !empty($level_aliases_lower)) {
                    if (in_array($r_level_lower, $level_aliases_lower, true)) {
                        $is_exact_lvl = true;
                    } else {
                        $r_step = $this->Course_registration_model->extract_level_step($r_level);
                        $q_step = $this->Course_registration_model->extract_level_step($lvl_raw);
                        if ($r_step !== null && $q_step !== null && $r_step === $q_step) {
                            $is_exact_lvl = true;
                        }
                    }
                }
                if (!$is_exact_lvl && !$is_all_level) {
                    continue;
                }

                $sem_bonus = 0;
                if ($r_sem !== null) {
                    if ($sem_id !== null && strcasecmp($r_sem, $sem_id) === 0) {
                        $sem_bonus = 5;
                    } else {
                        continue;
                    }
                }

                $score = 0;
                if ($is_exact_prog && $is_exact_lvl) {
                    $score = 100 + $sem_bonus;
                } elseif ($is_exact_prog && $is_all_level) {
                    $score = 80 + $sem_bonus;
                } elseif ($is_global_prog && $is_exact_lvl) {
                    $score = 60 + $sem_bonus;
                } elseif ($is_global_prog && $is_all_level) {
                    $score = 40 + $sem_bonus;
                }

                if ($score > $best_score) {
                    $best_score = $score;
                    $best_rule  = $row;
                    $best_rule['rule_scope'] = ($score >= 100) ? 'programme_level'
                        : (($score >= 80) ? 'programme_default'
                        : (($score >= 60) ? 'global_level' : 'global_default'));
                }
            }

            $min_credits = $best_rule ? (int)$best_rule['min_credits'] : 15;
            $max_credits = $best_rule ? (int)$best_rule['max_credits'] : 24;
            $rule_scope  = $best_rule ? $best_rule['rule_scope'] : 'system_default';
            $total       = (int)($reg['total_credits'] ?? 0);

            $credit_status = 'ok';
            if ($total < $min_credits) {
                $credit_status = 'under_min';
            } elseif ($total > $max_credits) {
                $credit_status = 'over_max';
            }

            $reg['min_credits']       = $min_credits;
            $reg['max_credits']       = $max_credits;
            $reg['credit_rule_scope'] = $rule_scope;
            $reg['credit_status']     = $credit_status;
        }
        unset($reg);
    }

    // =========================================================================
    // CANONICAL ACADEMIC SESSION & ENTRY COHORT RESOLUTION HELPERS
    // =========================================================================

    private $sessions_cache_by_id = null;
    private $sessions_cache_by_name = null;

    private function ensure_sessions_cache()
    {
        if ($this->sessions_cache_by_id !== null) {
            return;
        }
        $this->sessions_cache_by_id = array();
        $this->sessions_cache_by_name = array();
        if ($this->db->table_exists('academic_sessions')) {
            $rows = $this->db->get('academic_sessions')->result_array();
            foreach ($rows as $r) {
                $id = isset($r['id']) ? trim((string)$r['id']) : '';
                $name = isset($r['name']) ? trim((string)$r['name']) : '';
                if ($id !== '') {
                    $this->sessions_cache_by_id[$id] = $r;
                }
                if ($name !== '') {
                    $this->sessions_cache_by_name[$name] = $r;
                }
            }
        }
    }

    private function resolve_session_row($session_ref)
    {
        $ref = trim((string)$session_ref);
        if ($ref === '' || strtolower($ref) === 'all') {
            return null;
        }
        $this->ensure_sessions_cache();
        if (isset($this->sessions_cache_by_id[$ref])) {
            return $this->sessions_cache_by_id[$ref];
        }
        if (isset($this->sessions_cache_by_name[$ref])) {
            return $this->sessions_cache_by_name[$ref];
        }
        // Normalize spacing around slash e.g. "2021 / 2022" -> "2021/2022"
        if (preg_match('/((?:19|20)\d{2})\s*[\/\-]\s*((?:19|20)\d{2})/', $ref, $m)) {
            $norm = $m[1] . '/' . $m[2];
            if (isset($this->sessions_cache_by_name[$norm])) {
                return $this->sessions_cache_by_name[$norm];
            }
        }
        return null;
    }

    private function extract_session_start_year($session_ref)
    {
        $row = $this->resolve_session_row($session_ref);
        $text = $row && !empty($row['name']) ? trim((string)$row['name']) : trim((string)$session_ref);
        if (preg_match('/((?:19|20)\d{2})\s*[\/\-]\s*(?:19|20)\d{2}/', $text, $m)) {
            return (int)$m[1];
        }
        if (preg_match('/^((?:19|20)\d{2})$/', $text, $m)) {
            return (int)$m[1];
        }
        return null;
    }

    private function extract_level_step($level_or_semester)
    {
        $raw = strtolower(trim((string)$level_or_semester));
        if ($raw === '' || $raw === 'all') {
            return null;
        }
        $word_map = array(
            'contact-one'   => 1, 'contact one'   => 1,
            'contact-two'   => 2, 'contact two'   => 2,
            'contact-three' => 3, 'contact three' => 3,
            'contact-four'  => 4, 'contact four'  => 4,
            'contact-five'  => 5, 'contact five'  => 5,
            'contact-six'   => 6, 'contact six'   => 6,
        );
        if (isset($word_map[$raw])) {
            return $word_map[$raw];
        }
        if (preg_match('/contact[\s\-_]*([1-9]\d*)/i', $raw, $m)) {
            return (int)$m[1];
        }
        if (preg_match('/^([1-9])\d{2}(?:\s*level|\s*lvl|\s*l)?$/i', $raw, $m)) {
            return (int)$m[1];
        }
        if (preg_match('/^[1-9]$/', $raw)) {
            return (int)$raw;
        }
        return null;
    }

    private function is_direct_entry_student($student_row)
    {
        if (!is_array($student_row)) {
            return false;
        }
        foreach (array('entry_mode', 'adm_entry_mode', 'mode_of_entry') as $field) {
            if (!empty($student_row[$field])) {
                $val = strtolower(trim((string)$student_row[$field]));
                if (strpos($val, 'direct') !== false || $val === 'de' || strpos($val, '200') !== false || strpos($val, 'contact 2') !== false || strpos($val, 'contact-two') !== false) {
                    return true;
                }
            }
        }
        if (!empty($student_row['admission_level'])) {
            $lvl = strtolower(trim((string)$student_row['admission_level']));
            if ($lvl === '200' || $lvl === '2' || strpos($lvl, 'contact 2') !== false || strpos($lvl, 'contact-two') !== false) {
                return true;
            }
        }
        if (!empty($student_row['matric_number'])) {
            $matric = trim((string)$student_row['matric_number']);
            if (preg_match('/\/[A-Z]{2,6}2\/\d{2}\/\d+/i', $matric)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Resolves a student's canonical Entry Session row and Teaching Academic Session row
     * for a given target Contact / Level step.
     *
     * Formula:
     *   Entry Base = 1 (Fresh) or 2 (Direct Entry)
     *   Teaching Session Start Year = Entry Session Start Year + (Step - Entry Base)
     */
    private function resolve_student_session_envelope($student_row, $fallback_entry_session_ref, $level_or_semester, $explicit_academic_session_ref = null)
    {
        $entry_ref = '';
        if (is_array($student_row)) {
            if (!empty($student_row['entry_session_id'])) {
                $entry_ref = trim((string)$student_row['entry_session_id']);
            } elseif (!empty($student_row['session_name'])) {
                $entry_ref = trim((string)$student_row['session_name']);
            }
        }
        if ($entry_ref === '' && $fallback_entry_session_ref && strtolower(trim((string)$fallback_entry_session_ref)) !== 'all') {
            $entry_ref = trim((string)$fallback_entry_session_ref);
        }

        $entry_sess_row = $this->resolve_session_row($entry_ref);
        $entry_sess_id  = $entry_sess_row ? $entry_sess_row['id'] : null;
        $entry_sess_name = $entry_sess_row ? $entry_sess_row['name'] : $entry_ref;

        // If an explicit Academic Session was supplied (and is not 'all'), use it directly as the teaching session envelope
        if ($explicit_academic_session_ref && strtolower(trim((string)$explicit_academic_session_ref)) !== 'all') {
            $explicit_row = $this->resolve_session_row($explicit_academic_session_ref);
            if ($explicit_row) {
                return array(
                    'entry_session_id'      => $entry_sess_id,
                    'entry_session_name'    => $entry_sess_name,
                    'academic_session_id'   => $explicit_row['id'],
                    'academic_session_name' => $explicit_row['name'],
                );
            }
        }

        $entry_start_year = $this->extract_session_start_year($entry_sess_name ?: $entry_ref);
        $step = $this->extract_level_step($level_or_semester);
        $entry_base = $this->is_direct_entry_student($student_row) ? 2 : 1;

        if ($entry_start_year !== null && $step !== null) {
            $offset = max(0, $step - $entry_base);
            $teaching_start_year = $entry_start_year + $offset;
            $teaching_name = $teaching_start_year . '/' . ($teaching_start_year + 1);
            $teaching_row = $this->resolve_session_row($teaching_name);
            if ($teaching_row) {
                return array(
                    'entry_session_id'      => $entry_sess_id,
                    'entry_session_name'    => $entry_sess_name,
                    'academic_session_id'   => $teaching_row['id'],
                    'academic_session_name' => $teaching_row['name'],
                );
            }
            return array(
                'entry_session_id'      => $entry_sess_id,
                'entry_session_name'    => $entry_sess_name,
                'academic_session_id'   => $entry_sess_id,
                'academic_session_name' => $teaching_name,
            );
        }

        // Fallback if no step could be parsed (e.g. non-contact semester without level)
        $fallback_acad_row = $explicit_academic_session_ref ? $this->resolve_session_row($explicit_academic_session_ref) : $entry_sess_row;
        return array(
            'entry_session_id'      => $entry_sess_id,
            'entry_session_name'    => $entry_sess_name,
            'academic_session_id'   => $fallback_acad_row ? $fallback_acad_row['id'] : $entry_sess_id,
            'academic_session_name' => $fallback_acad_row ? $fallback_acad_row['name'] : $entry_sess_name,
        );
    }

    /**
     * Checks whether a student belongs to the given Academic Session and Contact / Level
     * under the canonical level progression rule:
     *   Contact Step in Academic Session = Entry Base (1 Fresh, 2 DE) + (Academic_Start_Year - Entry_Start_Year)
     */
    private function does_student_match_academic_session_and_contact($student_row, $academic_session_ref, $level_or_semester, $cohort_ref = 'all')
    {
        $is_de = $this->is_direct_entry_student($student_row);
        $entry_base = $is_de ? 2 : 1;
        $target_step = $this->extract_level_step($level_or_semester);

        // Direct Entry students start at Contact 2 and never take Contact 1
        if ($target_step === 1 && $is_de) {
            return false;
        }

        $st_entry_ref = '';
        if (!empty($student_row['entry_session_id'])) {
            $st_entry_ref = trim((string)$student_row['entry_session_id']);
        } elseif (!empty($student_row['session_name'])) {
            $st_entry_ref = trim((string)$student_row['session_name']);
        }
        $st_entry_row  = $this->resolve_session_row($st_entry_ref);
        $st_entry_id   = $st_entry_row ? $st_entry_row['id'] : null;
        $st_entry_name = $st_entry_row ? $st_entry_row['name'] : trim((string)($student_row['session_name'] ?? $st_entry_ref));

        // Optional Entry Cohort filter check
        if ($cohort_ref && strtolower(trim((string)$cohort_ref)) !== 'all') {
            $cohort_row  = $this->resolve_session_row($cohort_ref);
            $cohort_id   = $cohort_row ? $cohort_row['id'] : null;
            $cohort_name = $cohort_row ? $cohort_row['name'] : trim((string)$cohort_ref);
            $raw_cohort  = trim((string)$cohort_ref);

            $matches_cohort = (
                ($cohort_id && $st_entry_id === $cohort_id) ||
                ($cohort_name !== '' && strcasecmp($st_entry_name, $cohort_name) === 0) ||
                ($raw_cohort !== '' && strcasecmp(trim((string)($student_row['session_name'] ?? '')), $raw_cohort) === 0)
            );
            if (!$matches_cohort) {
                return false;
            }
        }

        // Academic Session + Contact step progression check
        if ($academic_session_ref && strtolower(trim((string)$academic_session_ref)) !== 'all') {
            $acad_start_year  = $this->extract_session_start_year($academic_session_ref);
            $entry_start_year = $this->extract_session_start_year($st_entry_name ?: $st_entry_ref);

            if ($acad_start_year !== null && $entry_start_year !== null && $target_step !== null) {
                if ($acad_start_year < $entry_start_year) {
                    return false;
                }
                $student_step_in_session = $entry_base + ($acad_start_year - $entry_start_year);
                return ($student_step_in_session === $target_step);
            }
        }

        return true;
    }

    // =========================================================================
    // REGISTRATIONS LIST
    // =========================================================================

    public function get_registrations()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_admin();

        $session_id    = $this->input->get('session_id', true);
        $semester_id   = $this->input->get('semester_id', true);
        $department_id = $this->input->get('department_id', true);
        $programme_id  = $this->input->get('programme_id', true);
        $level         = $this->input->get('level', true);
        $status        = $this->input->get('status', true);
        $entry_mode    = $this->input->get('entry_mode', true);
        $search        = $this->input->get('search', true);
        $cohort        = $this->input->get('cohort', true) ?: $this->input->get('entry_session', true);

        $session_id    = is_string($session_id) ? trim($session_id) : $session_id;
        $semester_id   = is_string($semester_id) ? trim($semester_id) : $semester_id;
        $department_id = is_string($department_id) ? trim($department_id) : $department_id;
        $programme_id  = is_string($programme_id) ? trim($programme_id) : $programme_id;
        $level         = is_string($level) ? trim($level) : $level;
        $status        = is_string($status) ? trim($status) : $status;
        $entry_mode    = is_string($entry_mode) ? trim($entry_mode) : $entry_mode;
        $search        = is_string($search) ? trim($search) : $search;
        $cohort        = is_string($cohort) ? trim($cohort) : $cohort;

        $has_admissions    = $this->db->table_exists('admissions');
        $has_sessions_tbl  = $this->db->table_exists('academic_sessions');
        $has_semesters_tbl = $this->db->table_exists('semesters');
        $has_st_entry      = $this->db->field_exists('entry_mode', 'students');
        $has_adm_entry     = $has_admissions && $this->db->field_exists('entry_mode', 'admissions');
        $has_adm_mode      = $has_admissions && $this->db->field_exists('mode_of_entry', 'admissions');
        $has_st_sess_name  = $this->db->field_exists('session_name', 'students');
        $has_reg_prog      = $this->db->field_exists('programme_id', 'course_registrations');

        // Pre-resolve session filter BEFORE starting the main query builder on $this->db
        $target_session_ids = array();
        if ($session_id !== null && $session_id !== '' && strtolower((string)$session_id) !== 'all') {
            $target_session_ids[] = $session_id;
            if ($has_sessions_tbl) {
                $sess_row = $this->db->get_where('academic_sessions', array('id' => $session_id), 1)->row_array();
                if ($sess_row && !empty($sess_row['name'])) {
                    $target_session_ids[] = trim($sess_row['name']);
                } else {
                    $sess_row = $this->db->get_where('academic_sessions', array('name' => $session_id), 1)->row_array();
                    if ($sess_row && !empty($sess_row['id'])) {
                        $target_session_ids[] = $sess_row['id'];
                    }
                }
            }
            $target_session_ids = array_values(array_unique(array_filter($target_session_ids)));
        }

        // Pre-resolve cohort filter BEFORE starting the main query builder on $this->db
        $target_cohort_ids = array();
        if ($cohort !== null && $cohort !== '' && strtolower((string)$cohort) !== 'all') {
            $target_cohort_ids[] = $cohort;
            if ($has_sessions_tbl) {
                $c_row = $this->db->get_where('academic_sessions', array('id' => $cohort), 1)->row_array();
                if ($c_row && !empty($c_row['name'])) {
                    $target_cohort_ids[] = trim($c_row['name']);
                } else {
                    $c_row = $this->db->get_where('academic_sessions', array('name' => $cohort), 1)->row_array();
                    if ($c_row && !empty($c_row['id'])) {
                        $target_cohort_ids[] = $c_row['id'];
                    }
                }
            }
            $target_cohort_ids = array_values(array_unique(array_filter($target_cohort_ids)));
        }

        // Pre-resolve unified Contact / Semester / Level filter BEFORE starting the main query builder on $this->db
        $effective_period = ($semester_id !== null && $semester_id !== '' && strtolower((string)$semester_id) !== 'all')
            ? $semester_id
            : (($level !== null && $level !== '' && strtolower((string)$level) !== 'all') ? $level : null);

        $target_semester_ids = array();
        if ($effective_period !== null) {
            $target_semester_ids[] = $effective_period;
            $contact_num = null;
            if (preg_match('/contact\s*(\d+)/i', (string)$effective_period, $cm)) {
                $contact_num = (int)$cm[1];
            }
            if ($has_semesters_tbl) {
                $sem_row = $this->db->get_where('semesters', array('id' => $effective_period), 1)->row_array();
                if (!$sem_row) {
                    $sem_row = $this->db->get_where('semesters', array('name' => $effective_period), 1)->row_array();
                }
                if ($sem_row) {
                    if (!empty($sem_row['id'])) {
                        $target_semester_ids[] = $sem_row['id'];
                    }
                    if (!empty($sem_row['name'])) {
                        $target_semester_ids[] = $sem_row['name'];
                        if ($contact_num === null && preg_match('/contact\s*(\d+)/i', $sem_row['name'], $cm2)) {
                            $contact_num = (int)$cm2[1];
                        }
                    }
                }
            }
            if ($contact_num !== null) {
                $target_semester_ids[] = 'Contact ' . $contact_num;
                $target_semester_ids[] = 'Contact' . $contact_num;
                $target_semester_ids[] = (string)$contact_num;
                if ($has_semesters_tbl) {
                    $c_sem = $this->db->get_where('semesters', array('name' => 'Contact ' . $contact_num), 1)->row_array();
                    if ($c_sem && !empty($c_sem['id'])) {
                        $target_semester_ids[] = $c_sem['id'];
                    }
                }
            }
            $target_semester_ids = array_values(array_unique(array_filter($target_semester_ids)));
        }

        $select = 'r.*, u.full_name, u.email, s.admission_id, s.department_id, s.programme_id as student_programme_id, p.name as programme_name';
        $has_acad_sess_col  = $this->db->field_exists('academic_session_id', 'course_registrations');
        $has_entry_sess_col = $this->db->field_exists('entry_session_id', 'course_registrations');
        $has_st_entry_sess  = $this->db->field_exists('entry_session_id', 'students');
        if ($has_sessions_tbl) {
            if ($has_acad_sess_col) {
                $select .= ", COALESCE(sess_acad.name, sess.name) as academic_session_name, COALESCE(sess_acad.name, sess.name) as reg_session_name, COALESCE(sess_acad.name, sess.name) as session_name";
            } else {
                $select .= ", sess.name as academic_session_name, sess.name as reg_session_name, sess.name as session_name";
            }
            if ($has_st_sess_name) {
                $select .= ", COALESCE(NULLIF(TRIM(s.session_name), ''), sess_entry.name) as student_entry_session, COALESCE(NULLIF(TRIM(s.session_name), ''), sess_entry.name) as session_of_entry";
            } else {
                $select .= ", sess_entry.name as student_entry_session, sess_entry.name as session_of_entry";
            }
        } elseif ($has_st_sess_name) {
            $select .= ', s.session_name as session_name, s.session_name as student_entry_session, s.session_name as session_of_entry';
        }
        if ($has_semesters_tbl) {
            $select .= ', sem.name as semester_name';
        }
        if ($has_admissions) {
            $select .= ', a.matric_number, a.admission_number';
        }
        if ($has_st_entry) {
            $select .= ', s.entry_mode';
        } elseif ($has_adm_entry) {
            $select .= ', a.entry_mode';
        } elseif ($has_adm_mode) {
            $select .= ', a.mode_of_entry as entry_mode';
        }

        $this->db->select($select, false);
        $this->db->from('course_registrations r');
        $this->db->join('students s', 's.id = r.student_id');
        $this->db->join('users u', 'u.id = s.user_id');
        $this->db->join('programmes p', 'p.id = s.programme_id', 'left');
        if ($has_sessions_tbl) {
            $this->db->join('academic_sessions sess', 'sess.id = r.session_id', 'left');
            if ($has_acad_sess_col) {
                $this->db->join('academic_sessions sess_acad', 'sess_acad.id = r.academic_session_id', 'left');
            }
            if ($has_entry_sess_col && $has_st_entry_sess) {
                $this->db->join('academic_sessions sess_entry', 'sess_entry.id = COALESCE(r.entry_session_id, s.entry_session_id)', 'left', false);
            } elseif ($has_entry_sess_col) {
                $this->db->join('academic_sessions sess_entry', 'sess_entry.id = r.entry_session_id', 'left');
            } elseif ($has_st_entry_sess) {
                $this->db->join('academic_sessions sess_entry', 'sess_entry.id = s.entry_session_id', 'left');
            } else {
                $this->db->join('academic_sessions sess_entry', '1 = 0', 'left', false);
            }
        }
        if ($has_semesters_tbl) {
            $this->db->join('semesters sem', 'sem.id = r.semester_id', 'left');
        }
        if ($has_admissions) {
            $this->db->join('admissions a', 'a.id = s.admission_id', 'left');
        }

        // 1. Academic Session Envelope filter: strictly matches teaching academic_session_id OR session_id
        if (!empty($target_session_ids)) {
            $this->db->group_start();
            if ($has_acad_sess_col) {
                $this->db->where_in('r.academic_session_id', $target_session_ids);
                $this->db->or_where_in('r.session_id', $target_session_ids);
            } else {
                $this->db->where_in('r.session_id', $target_session_ids);
            }
            $this->db->group_end();
        }

        // 2. Student Admission Cohort filter: matches student entry session
        if (!empty($target_cohort_ids)) {
            $has_cr_entry = $this->db->field_exists('entry_session_id', 'course_registrations');
            $has_st_entry_sess = $this->db->field_exists('entry_session_id', 'students');
            $this->db->group_start();
            if ($has_st_sess_name) {
                $this->db->where_in('s.session_name', $target_cohort_ids);
            }
            if ($has_st_entry_sess) {
                $this->db->or_where_in('s.entry_session_id', $target_cohort_ids);
            }
            if ($has_cr_entry) {
                $this->db->or_where_in('r.entry_session_id', $target_cohort_ids);
            }
            $this->db->group_end();
        }

        // Unified Contact / Semester / Level filter
        if (!empty($target_semester_ids)) {
            $this->db->group_start();
            $this->db->where_in('r.semester_id', $target_semester_ids);
            $this->db->or_where_in('r.level', $target_semester_ids);
            $this->db->group_end();
        }

        // If both semester_id and level were distinctly specified (e.g. First Semester + 100 Level)
        if ($semester_id && strtolower((string)$semester_id) !== 'all' &&
            $level && strtolower((string)$level) !== 'all' &&
            strtolower((string)$semester_id) !== strtolower((string)$level)) {
            $this->db->where('r.level', $level);
        }

        // Department filter
        if ($department_id && strtolower((string)$department_id) !== 'all') {
            $this->db->group_start();
            $this->db->where('s.department_id', $department_id);
            $this->db->or_where('p.department_id', $department_id);
            $this->db->group_end();
        }

        // Programme filter
        if ($programme_id && strtolower((string)$programme_id) !== 'all') {
            $this->db->group_start();
            $this->db->where('s.programme_id', $programme_id);
            if ($has_reg_prog) {
                $this->db->or_where('r.programme_id', $programme_id);
            }
            $this->db->group_end();
        }

        // Status filter
        if ($status && strtolower((string)$status) !== 'all') {
            $this->db->where('r.status', $status);
        }

        // Mode of Entry filter
        if ($entry_mode && strtolower((string)$entry_mode) !== 'all') {
            $em_lower = strtolower((string)$entry_mode);
            $is_de_filter = (strpos($em_lower, 'direct') !== false || $em_lower === 'de');
            $this->db->group_start();
            if ($is_de_filter) {
                if ($has_st_entry) {
                    $this->db->like('s.entry_mode', 'Direct');
                    $this->db->or_where('LOWER(s.entry_mode)', 'de');
                }
                if ($has_adm_entry) {
                    $this->db->or_like('a.entry_mode', 'Direct');
                    $this->db->or_where('LOWER(a.entry_mode)', 'de');
                }
                if ($has_adm_mode) {
                    $this->db->or_like('a.mode_of_entry', 'Direct');
                    $this->db->or_where('LOWER(a.mode_of_entry)', 'de');
                }
            } else {
                if ($has_st_entry) {
                    $this->db->where('s.entry_mode', $entry_mode);
                    $this->db->or_where('LOWER(s.entry_mode)', $em_lower);
                }
                if ($has_adm_entry) {
                    $this->db->or_where('a.entry_mode', $entry_mode);
                    $this->db->or_where('LOWER(a.entry_mode)', $em_lower);
                }
                if ($has_adm_mode) {
                    $this->db->or_where('a.mode_of_entry', $entry_mode);
                    $this->db->or_where('LOWER(a.mode_of_entry)', $em_lower);
                }
            }
            $this->db->group_end();
        }

        // Search by student name, matric number, or email
        if (!empty($search)) {
            $this->db->group_start();
            $this->db->like('u.full_name', $search);
            $this->db->or_like('u.email', $search);
            if ($has_admissions) {
                $this->db->or_like('a.matric_number', $search);
                $this->db->or_like('a.admission_number', $search);
            }
            $this->db->group_end();
        }

        $this->db->order_by('r.updated_at', 'DESC');
        $registrations = $this->db->get()->result_array();
        $this->attach_credit_rule_metadata($registrations);

        return $this->json_response(200, array('status' => 'success', 'data' => $registrations));
    }

    // =========================================================================
    // REGISTRATION DETAILS
    // =========================================================================

    public function get_registration_details()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_admin();
        $registration_id = $this->input->get('id', true);

        if (!$registration_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Registration ID required'));
        }

        $has_st_sess_name   = $this->db->field_exists('session_name', 'students');
        $has_acad_sess_col  = $this->db->field_exists('academic_session_id', 'course_registrations');
        $has_entry_sess_col = $this->db->field_exists('entry_session_id', 'course_registrations');
        $has_st_entry_sess  = $this->db->field_exists('entry_session_id', 'students');
        $detail_select = 'r.*, u.full_name, u.email, s.admission_id, s.programme_id as student_programme_id, p.name as programme_name';
        if ($this->db->table_exists('academic_sessions')) {
            if ($has_acad_sess_col) {
                $detail_select .= ", COALESCE(sess_acad.name, sess.name) as academic_session_name, COALESCE(sess_acad.name, sess.name) as reg_session_name, COALESCE(sess_acad.name, sess.name) as session_name";
            } else {
                $detail_select .= ", sess.name as academic_session_name, sess.name as reg_session_name, sess.name as session_name";
            }
            if ($has_st_sess_name) {
                $detail_select .= ", COALESCE(NULLIF(TRIM(s.session_name), ''), sess_entry.name) as student_entry_session";
            } else {
                $detail_select .= ", sess_entry.name as student_entry_session";
            }
        } elseif ($has_st_sess_name) {
            $detail_select .= ', s.session_name as session_name, s.session_name as student_entry_session';
        }
        if ($this->db->table_exists('semesters')) {
            $detail_select .= ', sem.name as semester_name';
        }
        $this->db->select($detail_select, false);
        $this->db->from('course_registrations r');
        $this->db->join('students s', 's.id = r.student_id');
        $this->db->join('users u', 'u.id = s.user_id');
        $this->db->join('programmes p', 'p.id = s.programme_id', 'left');
        if ($this->db->table_exists('academic_sessions')) {
            $this->db->join('academic_sessions sess', 'sess.id = r.session_id', 'left');
            if ($has_acad_sess_col) {
                $this->db->join('academic_sessions sess_acad', 'sess_acad.id = r.academic_session_id', 'left');
            }
            if ($has_entry_sess_col && $has_st_entry_sess) {
                $this->db->join('academic_sessions sess_entry', 'sess_entry.id = COALESCE(r.entry_session_id, s.entry_session_id)', 'left', false);
            } elseif ($has_entry_sess_col) {
                $this->db->join('academic_sessions sess_entry', 'sess_entry.id = r.entry_session_id', 'left');
            } elseif ($has_st_entry_sess) {
                $this->db->join('academic_sessions sess_entry', 'sess_entry.id = s.entry_session_id', 'left');
            } else {
                $this->db->join('academic_sessions sess_entry', '1 = 0', 'left', false);
            }
        }
        if ($this->db->table_exists('semesters')) {
            $this->db->join('semesters sem', 'sem.id = r.semester_id', 'left');
        }
        $this->db->where('r.id', $registration_id);
        $registration = $this->db->get()->row_array();

        if (!$registration) {
            return $this->json_response(404, array('status' => 'error', 'message' => 'Registration not found'));
        }
        if (empty($registration['programme_id']) && !empty($registration['student_programme_id'])) {
            $registration['programme_id'] = $registration['student_programme_id'];
        }

        $single_list = array($registration);
        $this->attach_credit_rule_metadata($single_list);
        $registration = $single_list[0];

        $items = $this->Course_registration_model->get_registration_items($registration_id);

        return $this->json_response(200, array('status' => 'success', 'data' => array(
            'registration' => $registration,
            'items' => $items
        )));
    }

    // =========================================================================
    // APPROVE / RETURN
    // =========================================================================

    public function process_approval()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_admin();
        $payload = json_decode(file_get_contents('php://input'), true);

        $registration_id = $payload['registration_id'] ?? null;
        $action = $payload['action'] ?? null;
        $reason = $payload['reason'] ?? null;

        if (!$registration_id || !in_array($action, ['approve', 'return'])) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid parameters'));
        }

        if ($action === 'return' && empty($reason)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Reason is required when returning for correction'));
        }

        $this->db->where('id', $registration_id);
        $registration = $this->db->get('course_registrations')->row_array();

        if (!$registration || $registration['status'] !== 'submitted') {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Registration must be in submitted state'));
        }

        $actor_id = isset($user['user_id']) ? $user['user_id']
                    : (isset($user['id']) ? $user['id'] : null);

        $data = array('updated_at' => date('Y-m-d H:i:s'));

        if ($action === 'approve') {
            $data['status'] = 'approved';
            if ($this->db->field_exists('approved_at', 'course_registrations')) {
                $data['approved_at'] = date('Y-m-d H:i:s');
            }
            if ($this->db->field_exists('approved_by', 'course_registrations')) {
                $data['approved_by'] = $actor_id;
            }
        } else {
            $data['status'] = 'returned';
            if ($this->db->field_exists('returned_at', 'course_registrations')) {
                $data['returned_at'] = date('Y-m-d H:i:s');
            }
            if ($this->db->field_exists('returned_by', 'course_registrations')) {
                $data['returned_by'] = $actor_id;
            }
            if ($this->db->field_exists('return_reason', 'course_registrations')) {
                $data['return_reason'] = $reason;
            }
        }

        $this->db->where('id', $registration_id);
        $this->db->update('course_registrations', $data);

        // Audit Trail
        $audit_data = array(
            'id'              => $this->Course_registration_model->generate_uuid(),
            'registration_id' => $registration_id,
            'actor_id'        => $actor_id,
            'action_type'     => $action,
            'reason'          => $reason ? $reason : 'Admin processed registration',
            'created_at'      => date('Y-m-d H:i:s')
        );
        $this->db->insert('course_registration_amendments', $audit_data);

        return $this->json_response(200, array('status' => 'success', 'message' => $action === 'approve' ? 'Registration approved' : 'Registration returned for correction'));
    }

    // =========================================================================
    // DELETE REGISTRATIONS
    // =========================================================================

    public function delete_registrations()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_admin();
        $payload = json_decode(file_get_contents('php://input'), true);

        if (!is_array($payload)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid JSON payload'));
        }

        $dry_run = !empty($payload['dry_run']);
        $delete_all = !empty($payload['delete_all']);
        $confirm_approved = !empty($payload['confirm_approved']);

        $registration_ids = isset($payload['registration_ids']) && is_array($payload['registration_ids'])
            ? array_filter($payload['registration_ids'])
            : array();
        if (!empty($payload['registration_id']) && is_string($payload['registration_id'])) {
            $registration_ids[] = trim($payload['registration_id']);
        }
        $registration_ids = array_values(array_unique($registration_ids));

        $student_ids = isset($payload['student_ids']) && is_array($payload['student_ids'])
            ? array_filter($payload['student_ids'])
            : array();
        if (!empty($payload['student_id']) && is_string($payload['student_id'])) {
            $student_ids[] = trim($payload['student_id']);
        }
        $student_ids = array_values(array_unique($student_ids));

        $session_id = isset($payload['session_id']) ? trim((string)$payload['session_id']) : null;
        $cohort = isset($payload['cohort']) ? trim((string)$payload['cohort']) : (isset($payload['entry_session']) ? trim((string)$payload['entry_session']) : null);
        $semester_id = isset($payload['semester_id']) ? trim((string)$payload['semester_id']) : null;
        $department_id = isset($payload['department_id']) ? trim((string)$payload['department_id']) : null;
        $programme_id = isset($payload['programme_id']) ? trim((string)$payload['programme_id']) : null;
        $level = isset($payload['level']) ? trim((string)$payload['level']) : null;
        $status = isset($payload['status']) ? trim((string)$payload['status']) : null;
        $entry_mode = isset($payload['entry_mode']) ? trim((string)$payload['entry_mode']) : null;
        $search = isset($payload['search']) ? trim((string)$payload['search']) : null;

        // Validation: must have either registration_ids, student_ids, or delete_all
        if (empty($registration_ids) && empty($student_ids) && !$delete_all) {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => 'No registrations or students specified for deletion'
            ));
        }

        // Safety guard: prevent deleting all registrations system-wide without any filters
        if ($delete_all &&
            (empty($session_id) || strtolower($session_id) === 'all') &&
            (empty($cohort) || strtolower($cohort) === 'all') &&
            (empty($semester_id) || strtolower($semester_id) === 'all') &&
            (empty($department_id) || strtolower($department_id) === 'all') &&
            (empty($programme_id) || strtolower($programme_id) === 'all') &&
            (empty($level) || strtolower($level) === 'all') &&
            (empty($status) || strtolower($status) === 'all') &&
            (empty($entry_mode) || strtolower($entry_mode) === 'all') &&
            empty($search)) {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => 'Bulk deletion requires at least one scoping filter (Session, Cohort, Department, Programme, Contact/Semester, Entry Mode, Status, or Search) to prevent accidental total database wipe'
            ));
        }

        $matched_registrations = $this->query_matching_registrations(array(
            'registration_ids' => $registration_ids,
            'student_ids'      => $student_ids,
            'session_id'       => $session_id,
            'cohort'           => $cohort,
            'semester_id'      => $semester_id,
            'department_id'    => $department_id,
            'programme_id'     => $programme_id,
            'level'            => $level,
            'status'           => $status,
            'entry_mode'       => $entry_mode,
            'search'           => $search,
        ));
        $matched_ids = array_column($matched_registrations, 'id');
        $matched_student_ids = array_unique(array_column($matched_registrations, 'student_id'));
        $total_registrations = count($matched_registrations);

        $by_status = array(
            'draft' => 0,
            'submitted' => 0,
            'approved' => 0,
            'returned' => 0
        );
        $approved_registrations = 0;
        foreach ($matched_registrations as $mr) {
            $st = strtolower($mr['status'] ?? 'draft');
            if (!isset($by_status[$st])) {
                $by_status[$st] = 0;
            }
            $by_status[$st]++;
            if ($st === 'approved') {
                $approved_registrations++;
            }
        }

        // Count items
        $total_items = 0;
        $has_item_status = $this->db->field_exists('status', 'course_registration_items');
        if (!empty($matched_ids)) {
            foreach (array_chunk($matched_ids, 500) as $id_chunk) {
                $this->db->where_in('registration_id', $id_chunk);
                if ($has_item_status) {
                    $this->db->group_start();
                    $this->db->where('status', 'active');
                    $this->db->or_where('status IS NULL', null, false);
                    $this->db->group_end();
                }
                $total_items += (int)$this->db->count_all_results('course_registration_items');
            }
        }

        // Check if any results or attempts exist for these students in this session/semester
        $students_with_results = 0;
        $attempts_with_scores = 0;
        if (!empty($matched_ids) && !empty($matched_student_ids) && $this->db->table_exists('result_attempts')) {
            $course_ids = array();
            foreach (array_chunk($matched_ids, 500) as $id_chunk) {
                $this->db->select('DISTINCT(course_id)');
                $this->db->where_in('registration_id', $id_chunk);
                if ($has_item_status) {
                    $this->db->group_start();
                    $this->db->where('status', 'active');
                    $this->db->or_where('status IS NULL', null, false);
                    $this->db->group_end();
                }
                $reg_courses = $this->db->get('course_registration_items')->result_array();
                foreach ($reg_courses as $rc) {
                    if (!empty($rc['course_id'])) {
                        $course_ids[$rc['course_id']] = true;
                    }
                }
            }
            $course_ids = array_keys($course_ids);

            if (!empty($course_ids)) {
                $scored_students = array();
                foreach (array_chunk($matched_student_ids, 500) as $stu_chunk) {
                    if ($this->db->field_exists('course_id', 'result_attempts')) {
                        $this->db->select('student_id, COUNT(id) as attempt_cnt');
                        $this->db->where_in('student_id', $stu_chunk);
                        $this->db->where_in('course_id', $course_ids);
                        $this->db->group_start();
                        $this->db->where('ca_score IS NOT NULL', null, false);
                        $this->db->or_where('exam_score IS NOT NULL', null, false);
                        $this->db->group_end();
                        $this->db->group_by('student_id');
                        $rows = $this->db->get('result_attempts')->result_array();
                        foreach ($rows as $r) {
                            $scored_students[$r['student_id']] = true;
                            $attempts_with_scores += (int)$r['attempt_cnt'];
                        }
                    } elseif ($this->db->table_exists('result_batches')) {
                        $this->db->select('ra.student_id, COUNT(ra.id) as attempt_cnt');
                        $this->db->from('result_attempts ra');
                        $this->db->join('result_batches rb', 'rb.id = ra.batch_id');
                        $this->db->where_in('ra.student_id', $stu_chunk);
                        $this->db->where_in('rb.course_id', $course_ids);
                        $this->db->group_start();
                        $this->db->where('ra.ca_score IS NOT NULL', null, false);
                        $this->db->or_where('ra.exam_score IS NOT NULL', null, false);
                        $this->db->group_end();
                        $this->db->group_by('ra.student_id');
                        $rows = $this->db->get()->result_array();
                        foreach ($rows as $r) {
                            $scored_students[$r['student_id']] = true;
                            $attempts_with_scores += (int)$r['attempt_cnt'];
                        }
                    }
                }
                $students_with_results = count($scored_students);
            }
        }

        if ($dry_run) {
            return $this->json_response(200, array(
                'status' => 'success',
                'data' => array(
                    'total_registrations' => $total_registrations,
                    'approved_registrations' => $approved_registrations,
                    'students_with_results' => $students_with_results,
                    'attempts_with_scores' => $attempts_with_scores,
                    'total_items' => $total_items,
                    'by_status' => $by_status,
                    'students_count' => count($matched_student_ids)
                )
            ));
        }

        if ($total_registrations === 0) {
            return $this->json_response(200, array(
                'status' => 'success',
                'message' => 'No matching registrations found to delete',
                'deleted_count' => 0
            ));
        }

        if ($approved_registrations > 0 && !$confirm_approved) {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => "Deletion includes {$approved_registrations} approved registration(s). Explicit confirmation is required."
            ));
        }

        // Perform deletion in database transaction
        $this->db->trans_start();

        $chunk_size = 500;
        for ($i = 0; $i < count($matched_ids); $i += $chunk_size) {
            $chunk = array_slice($matched_ids, $i, $chunk_size);

            $this->db->where_in('registration_id', $chunk);
            $this->db->delete('course_registration_items');

            // PRESERVE AUDIT TRAIL: Record deletion event in amendments instead of purging history
            if ($this->db->table_exists('course_registration_amendments')) {
                $del_amends = array();
                $actor_id_now = isset($user['user_id']) ? $user['user_id'] : ($user['id'] ?? null);
                $now_ts = date('Y-m-d H:i:s');
                foreach ($chunk as $d_reg_id) {
                    $del_amends[] = array(
                        'id'              => $this->Course_registration_model->generate_uuid(),
                        'registration_id' => $d_reg_id,
                        'actor_id'        => $actor_id_now,
                        'action_type'     => 'deleted',
                        'reason'          => 'Registration deleted via admin bulk delete',
                        'created_at'      => $now_ts
                    );
                }
                if (!empty($del_amends)) {
                    $this->db->insert_batch('course_registration_amendments', $del_amends);
                }
            }

            $this->db->where_in('id', $chunk);
            $this->db->delete('course_registrations');
        }

        $actor_id = isset($user['user_id']) ? $user['user_id']
                    : (isset($user['id']) ? $user['id'] : null);
        if ($this->db->table_exists('audit_logs')) {
            $this->db->insert('audit_logs', array(
                'id' => $this->Course_registration_model->generate_uuid(),
                'user_id' => $actor_id,
                'action' => 'delete_registrations',
                'details' => json_encode(array(
                    'count' => $total_registrations,
                    'items_count' => $total_items,
                    'session_id' => $session_id,
                    'semester_id' => $semester_id,
                    'department_id' => $department_id,
                    'programme_id' => $programme_id,
                    'level' => $level,
                    'status' => $status,
                    'entry_mode' => $entry_mode,
                    'search' => $search,
                    'delete_all' => $delete_all,
                    'sample_ids' => array_slice($matched_ids, 0, 10)
                )),
                'ip_address' => $this->input->ip_address(),
                'created_at' => date('Y-m-d H:i:s')
            ));
        }

        $this->db->trans_complete();

        if ($this->db->trans_status() === FALSE) {
            return $this->json_response(500, array(
                'status' => 'error',
                'message' => 'Database error occurred while deleting registrations'
            ));
        }

        return $this->json_response(200, array(
            'status' => 'success',
            'message' => "Successfully deleted {$total_registrations} registration(s) and {$total_items} course item(s)",
            'deleted_count' => $total_registrations
        ));
    }

    // =========================================================================
    // SHARED REGISTRATION MATCHER & CREDIT RECALCULATOR
    // =========================================================================

    private function query_matching_registrations($params)
    {
        $registration_ids = isset($params['registration_ids']) && is_array($params['registration_ids'])
            ? array_values(array_unique(array_filter($params['registration_ids'])))
            : array();
        $student_ids = isset($params['student_ids']) && is_array($params['student_ids'])
            ? array_values(array_unique(array_filter($params['student_ids'])))
            : array();
        $session_id    = isset($params['session_id']) ? trim((string)$params['session_id']) : null;
        $cohort        = isset($params['cohort']) ? trim((string)$params['cohort']) : (isset($params['entry_session']) ? trim((string)$params['entry_session']) : null);
        $semester_id   = isset($params['semester_id']) ? trim((string)$params['semester_id']) : null;
        $department_id = isset($params['department_id']) ? trim((string)$params['department_id']) : null;
        $programme_id  = isset($params['programme_id']) ? trim((string)$params['programme_id']) : null;
        $level         = isset($params['level']) ? trim((string)$params['level']) : null;
        $status        = isset($params['status']) ? trim((string)$params['status']) : null;
        $entry_mode    = isset($params['entry_mode']) ? trim((string)$params['entry_mode']) : null;
        $search        = isset($params['search']) ? trim((string)$params['search']) : null;

        if (!empty($registration_ids)) {
            $results = array();
            foreach (array_chunk($registration_ids, 500) as $id_chunk) {
                $this->db->select('r.id, r.student_id, r.session_id, r.semester_id, r.level, r.status, s.programme_id');
                $this->db->from('course_registrations r');
                $this->db->join('students s', 's.id = r.student_id');
                $this->db->where_in('r.id', $id_chunk);
                $chunk_rows = $this->db->get()->result_array();
                foreach ($chunk_rows as $cr) {
                    $results[] = $cr;
                }
            }
            return $results;
        }

        // Resolve target session IDs (UUID and Name) for Academic Session Envelope
        $target_session_ids = array();
        if ($session_id && strtolower($session_id) !== 'all') {
            $target_session_ids[] = $session_id;
            if ($this->db->table_exists('academic_sessions')) {
                $sess_row = $this->db->get_where('academic_sessions', array('id' => $session_id), 1)->row_array();
                if ($sess_row && !empty($sess_row['name'])) {
                    $target_session_ids[] = $sess_row['name'];
                } else {
                    $sess_row = $this->db->get_where('academic_sessions', array('name' => $session_id), 1)->row_array();
                    if ($sess_row && !empty($sess_row['id'])) {
                        $target_session_ids[] = $sess_row['id'];
                    }
                }
            }
            $target_session_ids = array_values(array_unique(array_filter($target_session_ids)));
        }

        // Resolve target cohort IDs (UUID and Name) for Entry Session Cohort
        $target_cohort_ids = array();
        if ($cohort && strtolower($cohort) !== 'all') {
            $target_cohort_ids[] = $cohort;
            if ($this->db->table_exists('academic_sessions')) {
                $c_row = $this->db->get_where('academic_sessions', array('id' => $cohort), 1)->row_array();
                if ($c_row && !empty($c_row['name'])) {
                    $target_cohort_ids[] = $c_row['name'];
                } else {
                    $c_row = $this->db->get_where('academic_sessions', array('name' => $cohort), 1)->row_array();
                    if ($c_row && !empty($c_row['id'])) {
                        $target_cohort_ids[] = $c_row['id'];
                    }
                }
            }
            $target_cohort_ids = array_values(array_unique(array_filter($target_cohort_ids)));
        }

        // Unified Contact / Semester / Level resolution
        $effective_period = ($semester_id !== null && $semester_id !== '' && strtolower((string)$semester_id) !== 'all')
            ? $semester_id
            : (($level !== null && $level !== '' && strtolower((string)$level) !== 'all') ? $level : null);

        $target_semester_ids = array();
        if ($effective_period !== null) {
            $target_semester_ids[] = $effective_period;
            $contact_num = null;
            if (preg_match('/contact\s*(\d+)/i', (string)$effective_period, $cm)) {
                $contact_num = (int)$cm[1];
            }
            if ($this->db->table_exists('semesters')) {
                $sem_row = $this->db->get_where('semesters', array('id' => $effective_period), 1)->row_array();
                if (!$sem_row) {
                    $sem_row = $this->db->get_where('semesters', array('name' => $effective_period), 1)->row_array();
                }
                if ($sem_row) {
                    if (!empty($sem_row['id'])) {
                        $target_semester_ids[] = $sem_row['id'];
                    }
                    if (!empty($sem_row['name'])) {
                        $target_semester_ids[] = $sem_row['name'];
                        if ($contact_num === null && preg_match('/contact\s*(\d+)/i', $sem_row['name'], $cm2)) {
                            $contact_num = (int)$cm2[1];
                        }
                    }
                }
            }
            if ($contact_num !== null) {
                $target_semester_ids[] = 'Contact ' . $contact_num;
                $target_semester_ids[] = 'Contact' . $contact_num;
                $target_semester_ids[] = (string)$contact_num;
                if ($this->db->table_exists('semesters')) {
                    $c_sem = $this->db->get_where('semesters', array('name' => 'Contact ' . $contact_num), 1)->row_array();
                    if ($c_sem && !empty($c_sem['id'])) {
                        $target_semester_ids[] = $c_sem['id'];
                    }
                }
            }
            $target_semester_ids = array_values(array_unique(array_filter($target_semester_ids)));
        }

        $has_admissions   = $this->db->table_exists('admissions');
        $has_st_entry     = $this->db->field_exists('entry_mode', 'students');
        $has_adm_entry    = $has_admissions && $this->db->field_exists('entry_mode', 'admissions');
        $has_adm_mode     = $has_admissions && $this->db->field_exists('mode_of_entry', 'admissions');
        $has_st_sess_name = $this->db->field_exists('session_name', 'students');
        $has_reg_prog     = $this->db->field_exists('programme_id', 'course_registrations');
        $need_user_join   = !empty($search);
        $need_adm_join    = (!empty($search) && $has_admissions) || ($entry_mode && strtolower($entry_mode) !== 'all' && ($has_adm_entry || $has_adm_mode));
        $need_prog_join   = ($department_id && strtolower($department_id) !== 'all');

        $this->db->select('r.id, r.student_id, r.session_id, r.semester_id, r.level, r.status, s.programme_id');
        $this->db->from('course_registrations r');
        $this->db->join('students s', 's.id = r.student_id');
        if ($need_prog_join) {
            $this->db->join('programmes p', 'p.id = s.programme_id', 'left');
        }
        if ($need_user_join) {
            $this->db->join('users u', 'u.id = s.user_id', 'left');
        }
        if ($need_adm_join) {
            $this->db->join('admissions a', 'a.id = s.admission_id', 'left');
        }

        if (!empty($student_ids)) {
            $this->db->where_in('r.student_id', $student_ids);
        }

        if (!empty($target_session_ids)) {
            $has_acad_sess_col = $this->db->field_exists('academic_session_id', 'course_registrations');
            $this->db->group_start();
            if ($has_acad_sess_col) {
                $this->db->where_in('r.academic_session_id', $target_session_ids);
                $this->db->or_where_in('r.session_id', $target_session_ids);
            } else {
                $this->db->where_in('r.session_id', $target_session_ids);
            }
            $this->db->group_end();
        }

        if (!empty($target_cohort_ids)) {
            $has_cr_entry = $this->db->field_exists('entry_session_id', 'course_registrations');
            $has_st_entry_sess = $this->db->field_exists('entry_session_id', 'students');
            $this->db->group_start();
            if ($has_st_sess_name) {
                $this->db->where_in('s.session_name', $target_cohort_ids);
            }
            if ($has_st_entry_sess) {
                $this->db->or_where_in('s.entry_session_id', $target_cohort_ids);
            }
            if ($has_cr_entry) {
                $this->db->or_where_in('r.entry_session_id', $target_cohort_ids);
            }
            $this->db->group_end();
        }

        if (!empty($target_semester_ids)) {
            $this->db->group_start();
            $this->db->where_in('r.semester_id', $target_semester_ids);
            $this->db->or_where_in('r.level', $target_semester_ids);
            $this->db->group_end();
        }

        if ($semester_id && strtolower((string)$semester_id) !== 'all' &&
            $level && strtolower((string)$level) !== 'all' &&
            strtolower((string)$semester_id) !== strtolower((string)$level)) {
            $this->db->where('r.level', $level);
        }

        if ($department_id && strtolower($department_id) !== 'all') {
            $this->db->group_start();
            $this->db->where('s.department_id', $department_id);
            $this->db->or_where('p.department_id', $department_id);
            $this->db->group_end();
        }

        if ($programme_id && strtolower($programme_id) !== 'all') {
            $this->db->group_start();
            $this->db->where('s.programme_id', $programme_id);
            if ($has_reg_prog) {
                $this->db->or_where('r.programme_id', $programme_id);
            }
            $this->db->group_end();
        }

        if ($status && strtolower($status) !== 'all') {
            $this->db->where('r.status', $status);
        }

        if ($entry_mode && strtolower($entry_mode) !== 'all') {
            $em_lower = strtolower((string)$entry_mode);
            $is_de_filter = (strpos($em_lower, 'direct') !== false || $em_lower === 'de');
            $this->db->group_start();
            if ($is_de_filter) {
                if ($has_st_entry) {
                    $this->db->like('s.entry_mode', 'Direct');
                    $this->db->or_where('LOWER(s.entry_mode)', 'de');
                }
                if ($has_adm_entry) {
                    $this->db->or_like('a.entry_mode', 'Direct');
                    $this->db->or_where('LOWER(a.entry_mode)', 'de');
                }
                if ($has_adm_mode) {
                    $this->db->or_like('a.mode_of_entry', 'Direct');
                    $this->db->or_where('LOWER(a.mode_of_entry)', 'de');
                }
            } else {
                if ($has_st_entry) {
                    $this->db->where('s.entry_mode', $entry_mode);
                    $this->db->or_where('LOWER(s.entry_mode)', $em_lower);
                }
                if ($has_adm_entry) {
                    $this->db->or_where('a.entry_mode', $entry_mode);
                    $this->db->or_where('LOWER(a.entry_mode)', $em_lower);
                }
                if ($has_adm_mode) {
                    $this->db->or_where('a.mode_of_entry', $entry_mode);
                    $this->db->or_where('LOWER(a.mode_of_entry)', $em_lower);
                }
            }
            $this->db->group_end();
        }

        if (!empty($search)) {
            $this->db->group_start();
            $this->db->like('u.full_name', $search);
            $this->db->or_like('u.email', $search);
            if ($has_admissions) {
                $this->db->or_like('a.matric_number', $search);
                $this->db->or_like('a.admission_number', $search);
            }
            $this->db->group_end();
        }

        return $this->db->get()->result_array();
    }

    private function recalculate_registrations_total_credits($registration_ids)
    {
        if (empty($registration_ids) || !$this->db->field_exists('total_credits', 'course_registrations')) {
            return;
        }
        $registration_ids = array_values(array_unique(array_filter($registration_ids)));
        sort($registration_ids);
        if (empty($registration_ids)) {
            return;
        }

        $now = date('Y-m-d H:i:s');
        $has_item_status = $this->db->field_exists('status', 'course_registration_items');
        $has_updated_at  = $this->db->field_exists('updated_at', 'course_registrations');
        $has_units       = $this->db->field_exists('credit_units', 'courses');
        $credit_col      = $has_units ? 'c.credit_units' : ($this->db->field_exists('credit_unit', 'courses') ? 'c.credit_unit' : '0');

        foreach (array_chunk($registration_ids, 300) as $chunk) {
            $this->db->select('i.registration_id, COALESCE(SUM(' . $credit_col . '), 0) as total_units', false);
            $this->db->from('course_registration_items i');
            $this->db->join('courses c', 'c.id = i.course_id', 'inner');
            $this->db->where_in('i.registration_id', $chunk);
            if ($has_item_status) {
                $this->db->group_start();
                $this->db->where('i.status', 'active');
                $this->db->or_where('i.status IS NULL', null, false);
                $this->db->group_end();
            }
            $this->db->group_by('i.registration_id');
            $rows = $this->db->get()->result_array();

            $totals_map = array_fill_keys($chunk, 0);
            foreach ($rows as $r) {
                $totals_map[$r['registration_id']] = (int)$r['total_units'];
            }

            $update_batch = array();
            foreach ($totals_map as $reg_id => $total_units) {
                $row_upd = array(
                    'id' => $reg_id,
                    'total_credits' => $total_units,
                );
                if ($has_updated_at) {
                    $row_upd['updated_at'] = $now;
                }
                $update_batch[] = $row_upd;
            }
            if (!empty($update_batch)) {
                $this->db->update_batch('course_registrations', $update_batch, 'id');
            }
        }
    }

    // =========================================================================
    // AMEND COURSES ON EXISTING REGISTRATIONS (SINGLE OR BULK ADD / REMOVE)
    // =========================================================================

    public function amend_registrations_courses()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_admin();
        $payload = json_decode(file_get_contents('php://input'), true);

        if (!is_array($payload)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid JSON payload'));
        }

        $operation  = isset($payload['operation']) ? strtolower(trim((string)$payload['operation'])) : 'inspect';
        $dry_run    = !empty($payload['dry_run']);
        $amend_all  = !empty($payload['amend_all']);
        $force_remove_with_scores = !empty($payload['force_remove_with_scores']);
        $registration_type_override = isset($payload['registration_type']) ? trim((string)$payload['registration_type']) : 'auto';

        if (!in_array($operation, array('inspect', 'add', 'remove'), true)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid operation. Must be inspect, add, or remove.'));
        }

        $registration_ids = isset($payload['registration_ids']) && is_array($payload['registration_ids'])
            ? array_filter($payload['registration_ids'])
            : array();
        if (!empty($payload['registration_id']) && is_string($payload['registration_id'])) {
            $registration_ids[] = trim($payload['registration_id']);
        }
        $registration_ids = array_values(array_unique($registration_ids));

        $student_ids = isset($payload['student_ids']) && is_array($payload['student_ids'])
            ? array_filter($payload['student_ids'])
            : array();
        if (!empty($payload['student_id']) && is_string($payload['student_id'])) {
            $student_ids[] = trim($payload['student_id']);
        }
        $student_ids = array_values(array_unique($student_ids));

        $session_id    = isset($payload['session_id']) ? trim((string)$payload['session_id']) : null;
        $cohort        = isset($payload['cohort']) ? trim((string)$payload['cohort']) : (isset($payload['entry_session']) ? trim((string)$payload['entry_session']) : null);
        $semester_id   = isset($payload['semester_id']) ? trim((string)$payload['semester_id']) : null;
        $department_id = isset($payload['department_id']) ? trim((string)$payload['department_id']) : null;
        $programme_id  = isset($payload['programme_id']) ? trim((string)$payload['programme_id']) : null;
        $level         = isset($payload['level']) ? trim((string)$payload['level']) : null;
        $status        = isset($payload['status']) ? trim((string)$payload['status']) : null;
        $entry_mode    = isset($payload['entry_mode']) ? trim((string)$payload['entry_mode']) : null;
        $search        = isset($payload['search']) ? trim((string)$payload['search']) : null;

        if (empty($registration_ids) && empty($student_ids) && !$amend_all) {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => 'No registrations or students specified for course amendment'
            ));
        }

        if ($amend_all &&
            (empty($session_id) || strtolower($session_id) === 'all') &&
            (empty($cohort) || strtolower($cohort) === 'all') &&
            (empty($semester_id) || strtolower($semester_id) === 'all') &&
            (empty($department_id) || strtolower($department_id) === 'all') &&
            (empty($programme_id) || strtolower($programme_id) === 'all') &&
            (empty($level) || strtolower($level) === 'all') &&
            (empty($status) || strtolower($status) === 'all') &&
            (empty($entry_mode) || strtolower($entry_mode) === 'all') &&
            empty($search)) {
            return $this->json_response(400, array(
                'status' => 'error',
                'message' => 'Bulk course amendment requires at least one scoping filter (Session, Cohort, Department, Programme, Contact/Semester, Entry Mode, Status, or Search).'
            ));
        }

        $matched_registrations = $this->query_matching_registrations(array(
            'registration_ids' => $registration_ids,
            'student_ids'      => $student_ids,
            'session_id'       => $session_id,
            'cohort'           => $cohort,
            'semester_id'      => $semester_id,
            'department_id'    => $department_id,
            'programme_id'     => $programme_id,
            'level'            => $level,
            'status'           => $status,
            'entry_mode'       => $entry_mode,
            'search'           => $search,
        ));

        $matched_ids = array_column($matched_registrations, 'id');
        $matched_student_ids = array_values(array_unique(array_column($matched_registrations, 'student_id')));
        $total_registrations = count($matched_registrations);

        $reg_to_student = array();
        $programme_ids_map = array();
        $levels_map = array();
        foreach ($matched_registrations as $mr) {
            $reg_to_student[$mr['id']] = $mr['student_id'];
            if (!empty($mr['programme_id'])) {
                $programme_ids_map[$mr['programme_id']] = true;
            }
            if (!empty($mr['level'])) {
                $levels_map[$mr['level']] = true;
            }
        }

        $has_item_status = $this->db->field_exists('status', 'course_registration_items');

        // ---------------------------------------------------------------------
        // OPERATION: INSPECT (Returns registered courses across target cohort)
        // ---------------------------------------------------------------------
        if ($operation === 'inspect') {
            $course_reg_sets = array();
            $course_reg_types = array();

            if (!empty($matched_ids)) {
                foreach (array_chunk($matched_ids, 500) as $id_chunk) {
                    $this->db->select('course_id, registration_id, registration_type');
                    $this->db->from('course_registration_items');
                    $this->db->where_in('registration_id', $id_chunk);
                    if ($has_item_status) {
                        $this->db->group_start();
                        $this->db->where('status', 'active');
                        $this->db->or_where('status IS NULL', null, false);
                        $this->db->group_end();
                    }
                    $rows = $this->db->get()->result_array();
                    foreach ($rows as $row) {
                        $cid = $row['course_id'];
                        if (!$cid) continue;
                        $course_reg_sets[$cid][$row['registration_id']] = true;
                        if (!empty($row['registration_type'])) {
                            $course_reg_types[$cid][$row['registration_type']] = true;
                        }
                    }
                }
            }

            $registered_courses = array();
            if (!empty($course_reg_sets)) {
                $cids = array_keys($course_reg_sets);
                foreach (array_chunk($cids, 500) as $cid_chunk) {
                    $this->db->select('c.id, c.code, c.title, c.credit_units, c.level, c.type, c.programme_id, p.name as programme_name');
                    $this->db->from('courses c');
                    $this->db->join('programmes p', 'p.id = c.programme_id', 'left');
                    $this->db->where_in('c.id', $cid_chunk);
                    $c_rows = $this->db->get()->result_array();
                    foreach ($c_rows as $cr) {
                        $cid = $cr['id'];
                        $cr['registrations_count'] = isset($course_reg_sets[$cid]) ? count($course_reg_sets[$cid]) : 0;
                        $cr['registration_types'] = isset($course_reg_types[$cid]) ? array_keys($course_reg_types[$cid]) : array();
                        $registered_courses[] = $cr;
                    }
                }

                usort($registered_courses, function ($a, $b) {
                    if ($b['registrations_count'] !== $a['registrations_count']) {
                        return $b['registrations_count'] - $a['registrations_count'];
                    }
                    return strcmp((string)$a['code'], (string)$b['code']);
                });
            }

            return $this->json_response(200, array(
                'status' => 'success',
                'data' => array(
                    'total_registrations' => $total_registrations,
                    'students_count'      => count($matched_student_ids),
                    'programme_ids'       => array_keys($programme_ids_map),
                    'levels'              => array_keys($levels_map),
                    'registered_courses'  => $registered_courses,
                )
            ));
        }

        // Validate course_ids for 'add' and 'remove'
        $course_ids = isset($payload['course_ids']) && is_array($payload['course_ids'])
            ? array_filter($payload['course_ids'])
            : array();
        if (!empty($payload['course_id']) && is_string($payload['course_id'])) {
            $course_ids[] = trim($payload['course_id']);
        }
        $course_ids = array_values(array_unique($course_ids));

        if (empty($course_ids)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Please select at least one course.'));
        }

        if ($total_registrations === 0) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'No matching registrations found for the target selection.'));
        }

        // Fetch course metadata
        $this->db->select('id, code, title, credit_units, level, type, programme_id');
        $this->db->from('courses');
        $this->db->where_in('id', $course_ids);
        $course_rows = $this->db->get()->result_array();
        if (empty($course_rows)) {
            return $this->json_response(404, array('status' => 'error', 'message' => 'Selected course(s) not found in catalogue.'));
        }

        $course_map = array();
        foreach ($course_rows as $cr) {
            $course_map[$cr['id']] = $cr;
        }
        $valid_course_ids = array_keys($course_map);

        $actor_id = isset($user['user_id']) ? $user['user_id'] : ($user['id'] ?? null);
        $now = date('Y-m-d H:i:s');

        // ---------------------------------------------------------------------
        // OPERATION: ADD COURSES TO EXISTING REGISTRATIONS
        // ---------------------------------------------------------------------
        if ($operation === 'add') {
            $existing_active   = array(); // [reg_id][course_id] => true
            $existing_inactive = array(); // [reg_id][course_id] => item_id

            foreach (array_chunk($matched_ids, 500) as $id_chunk) {
                $this->db->select('id, registration_id, course_id' . ($has_item_status ? ', status' : ''));
                $this->db->from('course_registration_items');
                $this->db->where_in('registration_id', $id_chunk);
                $this->db->where_in('course_id', $valid_course_ids);
                $rows = $this->db->get()->result_array();
                foreach ($rows as $r) {
                    $rid = $r['registration_id'];
                    $cid = $r['course_id'];
                    $is_act = !$has_item_status || strtolower((string)($r['status'] ?? 'active')) === 'active';
                    if ($is_act) {
                        $existing_active[$rid][$cid] = true;
                    } else {
                        $existing_inactive[$rid][$cid] = $r['id'];
                    }
                }
            }

            $courses_breakdown = array();
            $total_items_to_add = 0;
            $already_registered_total = 0;
            $affected_regs_preview = array();

            foreach ($valid_course_ids as $cid) {
                $c_info = $course_map[$cid];
                $already_cnt = 0;
                $to_add_cnt = 0;
                foreach ($matched_ids as $rid) {
                    if (!empty($existing_active[$rid][$cid])) {
                        $already_cnt++;
                    } else {
                        $to_add_cnt++;
                        $affected_regs_preview[$rid] = true;
                    }
                }
                $total_items_to_add += $to_add_cnt;
                $already_registered_total += $already_cnt;
                $courses_breakdown[] = array(
                    'course_id'                => $cid,
                    'code'                     => $c_info['code'],
                    'title'                    => $c_info['title'],
                    'credit_units'             => (int)$c_info['credit_units'],
                    'level'                    => $c_info['level'],
                    'type'                     => $c_info['type'],
                    'already_registered_count' => $already_cnt,
                    'to_add_count'             => $to_add_cnt,
                );
            }

            if ($dry_run) {
                return $this->json_response(200, array(
                    'status' => 'success',
                    'data' => array(
                        'operation'                    => 'add',
                        'total_registrations'          => $total_registrations,
                        'students_count'               => count($matched_student_ids),
                        'affected_registrations_count' => count($affected_regs_preview),
                        'total_items_to_add'           => $total_items_to_add,
                        'already_registered_total'     => $already_registered_total,
                        'courses_breakdown'            => $courses_breakdown,
                    )
                ));
            }

            if ($total_items_to_add === 0) {
                return $this->json_response(200, array(
                    'status' => 'success',
                    'message' => 'All targeted students already have the selected course(s) registered. No duplicate entries were created.',
                    'added_items_count' => 0,
                    'affected_registrations_count' => 0,
                    'skipped_existing_count' => $already_registered_total,
                ));
            }

            $items_to_insert = array();
            $items_to_reactivate = array();
            $affected_reg_ids = array();

            foreach ($matched_ids as $rid) {
                foreach ($valid_course_ids as $cid) {
                    if (!empty($existing_active[$rid][$cid])) {
                        continue;
                    }
                    $c_info = $course_map[$cid];
                    $reg_type = ($registration_type_override && strtolower($registration_type_override) !== 'auto')
                        ? $registration_type_override
                        : (!empty($c_info['type']) ? $c_info['type'] : 'core');

                    $affected_reg_ids[$rid] = true;

                    if (!empty($existing_inactive[$rid][$cid])) {
                        $upd = array(
                            'id'                => $existing_inactive[$rid][$cid],
                            'registration_type' => $reg_type,
                            'updated_at'        => $now,
                        );
                        if ($has_item_status) {
                            $upd['status'] = 'active';
                        }
                        $items_to_reactivate[] = $upd;
                    } else {
                        $ins = array(
                            'id'                => $this->Course_registration_model->generate_uuid(),
                            'registration_id'   => $rid,
                            'course_id'         => $cid,
                            'registration_type' => $reg_type,
                            'created_at'        => $now,
                            'updated_at'        => $now,
                        );
                        if ($has_item_status) {
                            $ins['status'] = 'active';
                        }
                        $items_to_insert[] = $ins;
                    }
                }
            }

            $affected_reg_list = array_keys($affected_reg_ids);

            $this->db->trans_start();

            if (!empty($items_to_reactivate)) {
                foreach (array_chunk($items_to_reactivate, 300) as $r_chunk) {
                    $this->db->update_batch('course_registration_items', $r_chunk, 'id');
                }
            }

            if (!empty($items_to_insert)) {
                foreach (array_chunk($items_to_insert, 300) as $i_chunk) {
                    $this->db->insert_batch('course_registration_items', $i_chunk);
                }
            }

            $this->recalculate_registrations_total_credits($affected_reg_list);

            $added_codes = array_column($course_rows, 'code');
            if ($this->db->table_exists('course_registration_amendments')) {
                if (count($affected_reg_list) <= 50) {
                    $amend_rows = array();
                    foreach ($affected_reg_list as $arid) {
                        $amend_rows[] = array(
                            'id'              => $this->Course_registration_model->generate_uuid(),
                            'registration_id' => $arid,
                            'actor_id'        => $actor_id,
                            'action_type'     => 'add_course',
                            'reason'          => 'Admin added course(s): ' . implode(', ', $added_codes),
                            'created_at'      => $now,
                        );
                    }
                    if (!empty($amend_rows)) {
                        $this->db->insert_batch('course_registration_amendments', $amend_rows);
                    }
                } else {
                    $this->db->insert('course_registration_amendments', array(
                        'id'              => $this->Course_registration_model->generate_uuid(),
                        'registration_id' => $affected_reg_list[0],
                        'actor_id'        => $actor_id,
                        'action_type'     => 'batch_add_course',
                        'reason'          => 'Admin batch added course(s): ' . implode(', ', $added_codes) . ' to ' . count($affected_reg_list) . ' registrations',
                        'new_value'       => json_encode(array('courses' => $added_codes, 'affected_count' => count($affected_reg_list))),
                        'created_at'      => $now,
                    ));
                }
            }

            if ($this->db->table_exists('audit_logs')) {
                $this->db->insert('audit_logs', array(
                    'id'         => $this->Course_registration_model->generate_uuid(),
                    'user_id'    => $actor_id,
                    'action'     => 'amend_registrations_add_courses',
                    'details'    => json_encode(array(
                        'courses'                => $added_codes,
                        'course_ids'             => $valid_course_ids,
                        'affected_registrations' => count($affected_reg_list),
                        'items_added'            => count($items_to_insert) + count($items_to_reactivate),
                        'skipped_existing'       => $already_registered_total,
                    )),
                    'ip_address' => $this->input->ip_address(),
                    'created_at' => $now,
                ));
            }

            $this->db->trans_complete();

            if ($this->db->trans_status() === FALSE) {
                return $this->json_response(500, array('status' => 'error', 'message' => 'Database error while adding courses to registrations.'));
            }

            $added_count = count($items_to_insert) + count($items_to_reactivate);
            $affected_count = count($affected_reg_list);
            return $this->json_response(200, array(
                'status'                       => 'success',
                'message'                      => "Successfully added " . implode(', ', $added_codes) . " ({$added_count} course entry/entries) across {$affected_count} registration(s).",
                'added_items_count'            => $added_count,
                'affected_registrations_count' => $affected_count,
                'skipped_existing_count'       => $already_registered_total,
            ));
        }

        // ---------------------------------------------------------------------
        // OPERATION: REMOVE COURSES FROM EXISTING REGISTRATIONS
        // ---------------------------------------------------------------------
        $matching_items = array();
        foreach (array_chunk($matched_ids, 500) as $id_chunk) {
            $this->db->select('id, registration_id, course_id');
            $this->db->from('course_registration_items');
            $this->db->where_in('registration_id', $id_chunk);
            $this->db->where_in('course_id', $valid_course_ids);
            if ($has_item_status) {
                $this->db->group_start();
                $this->db->where('status', 'active');
                $this->db->or_where('status IS NULL', null, false);
                $this->db->group_end();
            }
            $rows = $this->db->get()->result_array();
            foreach ($rows as $r) {
                $matching_items[] = $r;
            }
        }

        // Check if any targeted students have recorded CA or Exam scores for the selected courses
        $scored_student_courses = array(); // [student_id][course_id] => attempt_cnt
        $attempts_with_scores = 0;
        $scored_students_set = array();

        if (!empty($matching_items) && !empty($matched_student_ids) && $this->db->table_exists('result_attempts')) {
            foreach (array_chunk($matched_student_ids, 500) as $stu_chunk) {
                if ($this->db->field_exists('course_id', 'result_attempts')) {
                    $this->db->select('student_id, course_id, COUNT(id) as attempt_cnt');
                    $this->db->from('result_attempts');
                    $this->db->where_in('student_id', $stu_chunk);
                    $this->db->where_in('course_id', $valid_course_ids);
                    $this->db->group_start();
                    $this->db->where('ca_score IS NOT NULL', null, false);
                    $this->db->or_where('exam_score IS NOT NULL', null, false);
                    $this->db->group_end();
                    $this->db->group_by(array('student_id', 'course_id'));
                    $s_rows = $this->db->get()->result_array();
                    foreach ($s_rows as $sr) {
                        $scored_student_courses[$sr['student_id']][$sr['course_id']] = (int)$sr['attempt_cnt'];
                        $scored_students_set[$sr['student_id']] = true;
                        $attempts_with_scores += (int)$sr['attempt_cnt'];
                    }
                } elseif ($this->db->table_exists('result_batches')) {
                    $this->db->select('ra.student_id, rb.course_id, COUNT(ra.id) as attempt_cnt');
                    $this->db->from('result_attempts ra');
                    $this->db->join('result_batches rb', 'rb.id = ra.batch_id');
                    $this->db->where_in('ra.student_id', $stu_chunk);
                    $this->db->where_in('rb.course_id', $valid_course_ids);
                    $this->db->group_start();
                    $this->db->where('ra.ca_score IS NOT NULL', null, false);
                    $this->db->or_where('ra.exam_score IS NOT NULL', null, false);
                    $this->db->group_end();
                    $this->db->group_by(array('ra.student_id', 'rb.course_id'));
                    $s_rows = $this->db->get()->result_array();
                    foreach ($s_rows as $sr) {
                        $scored_student_courses[$sr['student_id']][$sr['course_id']] = (int)$sr['attempt_cnt'];
                        $scored_students_set[$sr['student_id']] = true;
                        $attempts_with_scores += (int)$sr['attempt_cnt'];
                    }
                }
            }
        }

        // Build per-course removal stats
        $per_course_reg_cnt = array_fill_keys($valid_course_ids, 0);
        $per_course_scored_cnt = array_fill_keys($valid_course_ids, 0);
        $regs_with_target = array();

        foreach ($matching_items as $item) {
            $rid = $item['registration_id'];
            $cid = $item['course_id'];
            $sid = $reg_to_student[$rid] ?? null;
            $regs_with_target[$rid] = true;
            if (isset($per_course_reg_cnt[$cid])) {
                $per_course_reg_cnt[$cid]++;
            }
            if ($sid && !empty($scored_student_courses[$sid][$cid])) {
                if (isset($per_course_scored_cnt[$cid])) {
                    $per_course_scored_cnt[$cid]++;
                }
            }
        }

        $courses_breakdown = array();
        $total_items_to_remove = 0;
        foreach ($valid_course_ids as $cid) {
            $c_info = $course_map[$cid];
            $reg_cnt = $per_course_reg_cnt[$cid] ?? 0;
            $scored_cnt = $per_course_scored_cnt[$cid] ?? 0;
            $removable_cnt = $force_remove_with_scores ? $reg_cnt : max(0, $reg_cnt - $scored_cnt);
            $total_items_to_remove += $removable_cnt;

            $courses_breakdown[] = array(
                'course_id'         => $cid,
                'code'              => $c_info['code'],
                'title'             => $c_info['title'],
                'credit_units'      => (int)$c_info['credit_units'],
                'level'             => $c_info['level'],
                'type'              => $c_info['type'],
                'registered_count'  => $reg_cnt,
                'with_scores_count' => $scored_cnt,
                'removable_count'   => $removable_cnt,
            );
        }

        if ($dry_run) {
            return $this->json_response(200, array(
                'status' => 'success',
                'data' => array(
                    'operation'                         => 'remove',
                    'total_registrations'               => $total_registrations,
                    'students_count'                    => count($matched_student_ids),
                    'registrations_with_target_courses' => count($regs_with_target),
                    'total_items_matching'              => count($matching_items),
                    'total_items_to_remove'             => $total_items_to_remove,
                    'students_with_results'             => count($scored_students_set),
                    'attempts_with_scores'              => $attempts_with_scores,
                    'courses_breakdown'                 => $courses_breakdown,
                )
            ));
        }

        if (empty($matching_items)) {
            return $this->json_response(200, array(
                'status' => 'success',
                'message' => 'None of the targeted registrations currently contain the selected course(s).',
                'removed_items_count' => 0,
                'affected_registrations_count' => 0,
                'skipped_with_scores_count' => 0,
            ));
        }

        $item_ids_to_delete = array();
        $affected_reg_ids = array();
        $skipped_with_scores_count = 0;

        foreach ($matching_items as $item) {
            $rid = $item['registration_id'];
            $cid = $item['course_id'];
            $sid = $reg_to_student[$rid] ?? null;
            $has_score = $sid && !empty($scored_student_courses[$sid][$cid]);

            if ($has_score && !$force_remove_with_scores) {
                $skipped_with_scores_count++;
                continue;
            }

            $item_ids_to_delete[] = $item['id'];
            $affected_reg_ids[$rid] = true;
        }

        if (empty($item_ids_to_delete) && $skipped_with_scores_count > 0) {
            return $this->json_response(400, array(
                'status' => 'error',
                'requires_force_scores' => true,
                'skipped_with_scores_count' => $skipped_with_scores_count,
                'message' => "Course removal was blocked because {$skipped_with_scores_count} student course entry/entries already have recorded CA or Exam scores. Enable 'Force remove even if scores exist' to remove anyway."
            ));
        }

        $affected_reg_list = array_keys($affected_reg_ids);
        $removed_codes = array_column($course_rows, 'code');

        $this->db->trans_start();

        $has_item_status = $this->db->field_exists('status', 'course_registration_items');
        $has_dropped_at  = $this->db->field_exists('dropped_at', 'course_registration_items');
        $drop_upd = array();
        if ($has_item_status) {
            $drop_upd['status'] = 'dropped';
        }
        if ($has_dropped_at) {
            $drop_upd['dropped_at']  = $now;
            $drop_upd['dropped_by']  = $actor_id;
            $drop_upd['drop_reason'] = 'Admin removed course(s): ' . implode(', ', $removed_codes);
        }
        foreach (array_chunk($item_ids_to_delete, 500) as $del_chunk) {
            $this->db->where_in('id', $del_chunk);
            $this->db->update('course_registration_items', $drop_upd);
        }

        $this->recalculate_registrations_total_credits($affected_reg_list);

        if ($this->db->table_exists('course_registration_amendments')) {
            if (count($affected_reg_list) <= 50) {
                $amend_rows = array();
                foreach ($affected_reg_list as $arid) {
                    $amend_rows[] = array(
                        'id'              => $this->Course_registration_model->generate_uuid(),
                        'registration_id' => $arid,
                        'actor_id'        => $actor_id,
                        'action_type'     => 'remove_course',
                        'reason'          => 'Admin removed course(s): ' . implode(', ', $removed_codes),
                        'created_at'      => $now,
                    );
                }
                if (!empty($amend_rows)) {
                    $this->db->insert_batch('course_registration_amendments', $amend_rows);
                }
            } else {
                $this->db->insert('course_registration_amendments', array(
                    'id'              => $this->Course_registration_model->generate_uuid(),
                    'registration_id' => $affected_reg_list[0],
                    'actor_id'        => $actor_id,
                    'action_type'     => 'batch_remove_course',
                    'reason'          => 'Admin batch removed course(s): ' . implode(', ', $removed_codes) . ' across ' . count($affected_reg_list) . ' registrations',
                    'new_value'       => json_encode(array('courses' => $removed_codes, 'affected_count' => count($affected_reg_list))),
                    'created_at'      => $now,
                ));
            }
        }

        if ($this->db->table_exists('audit_logs')) {
            $this->db->insert('audit_logs', array(
                'id'         => $this->Course_registration_model->generate_uuid(),
                'user_id'    => $actor_id,
                'action'     => 'amend_registrations_remove_courses',
                'details'    => json_encode(array(
                    'courses'                  => $removed_codes,
                    'course_ids'               => $valid_course_ids,
                    'affected_registrations'   => count($affected_reg_list),
                    'items_removed'            => count($item_ids_to_delete),
                    'skipped_with_scores'      => $skipped_with_scores_count,
                    'force_remove_with_scores' => $force_remove_with_scores,
                )),
                'ip_address' => $this->input->ip_address(),
                'created_at' => $now,
            ));
        }

        $this->db->trans_complete();

        if ($this->db->trans_status() === FALSE) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Database error while removing courses from registrations.'));
        }

        $removed_count = count($item_ids_to_delete);
        $affected_count = count($affected_reg_list);
        $msg = "Successfully removed " . implode(', ', $removed_codes) . " ({$removed_count} course entry/entries) from {$affected_count} registration(s).";
        if ($skipped_with_scores_count > 0) {
            $msg .= " ({$skipped_with_scores_count} entry/entries with recorded scores were preserved.)";
        }

        return $this->json_response(200, array(
            'status'                       => 'success',
            'message'                      => $msg,
            'removed_items_count'          => $removed_count,
            'affected_registrations_count' => $affected_count,
            'skipped_with_scores_count'    => $skipped_with_scores_count,
        ));
    }


    // =========================================================================
    // CLASS LISTS
    // =========================================================================

    public function get_class_list()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_admin();

        $session_id = $this->input->get('session_id', true);
        $semester_id = $this->input->get('semester_id', true);
        $course_id = $this->input->get('course_id', true);
        $level = $this->input->get('level', true);
        $programme_id = $this->input->get('programme_id', true);
        $department_id = $this->input->get('department_id', true);

        if (!$session_id || !$semester_id || !$course_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Session, semester, and course ID are required'));
        }

        $has_origin = $this->db->field_exists('origin_result_attempt_id', 'course_registration_items');
        $has_st_entry = $this->db->field_exists('entry_mode', 'students');
        
        $select = 'i.registration_type, i.id as registration_item_id, r.id as registration_id, r.status as registration_status, r.level as envelope_level, u.full_name, u.email, s.id as student_id, s.admission_id, s.department_id, s.current_level, p.name as programme_name';
        if ($has_st_entry) {
            $select .= ', s.entry_mode';
        }
        if ($has_origin) {
            $select .= ', i.origin_result_attempt_id, i.origin_score, i.origin_grade, i.origin_session_id, i.origin_semester_id';
        }

        $target_session_ids = array($session_id);
        if ($this->db->table_exists('academic_sessions')) {
            $sess_row = $this->db->get_where('academic_sessions', array('id' => $session_id), 1)->row_array();
            if ($sess_row && !empty($sess_row['name'])) {
                $target_session_ids[] = $sess_row['name'];
            } else {
                $sess_row = $this->db->get_where('academic_sessions', array('name' => $session_id), 1)->row_array();
                if ($sess_row && !empty($sess_row['id'])) {
                    $target_session_ids[] = $sess_row['id'];
                }
            }
        }
        $target_session_ids = array_unique(array_filter($target_session_ids));

        $target_semester_ids = array($semester_id);
        if ($this->db->table_exists('semesters')) {
            $sem_row = $this->db->get_where('semesters', array('id' => $semester_id), 1)->row_array();
            if ($sem_row && !empty($sem_row['name'])) {
                $target_semester_ids[] = $sem_row['name'];
            } else {
                $sem_row = $this->db->get_where('semesters', array('name' => $semester_id), 1)->row_array();
                if ($sem_row && !empty($sem_row['id'])) {
                    $target_semester_ids[] = $sem_row['id'];
                }
            }
        }
        $target_semester_ids = array_unique(array_filter($target_semester_ids));

        $this->db->select($select);
        $this->db->from('course_registration_items i');
        $this->db->join('course_registrations r', 'r.id = i.registration_id');
        $this->db->join('students s', 's.id = r.student_id');
        $this->db->join('users u', 'u.id = s.user_id');
        $this->db->join('courses c', 'c.id = i.course_id', 'left');
        $this->db->join('programmes p', 'p.id = COALESCE(s.programme_id, c.programme_id)', 'left');
        $this->db->where('i.course_id', $course_id);

        $contact_num = null;
        if ($level && preg_match('/contact\s*(\d+)/i', $level, $m)) {
            $contact_num = (int)$m[1];
            $target_semester_ids[] = 'Contact ' . $contact_num;
            $target_semester_ids[] = (string)$contact_num;
        }
        if ($level) {
            $target_semester_ids[] = $level;
        }
        if (preg_match('/contact\s*(\d+)/i', $semester_id, $matches)) {
            $contact_num = (int)$matches[1];
            $target_semester_ids[] = 'Contact ' . $contact_num;
            $target_semester_ids[] = (string)$contact_num;
        }
        if (!empty($sem_row['name']) && stripos($sem_row['name'], 'Contact') !== false && preg_match('/contact\s*(\d+)/i', $sem_row['name'], $m)) {
            $contact_num = (int)$m[1];
            $target_semester_ids[] = 'Contact ' . $contact_num;
            $target_semester_ids[] = (string)$contact_num;
        }
        $target_semester_ids = array_unique(array_filter($target_semester_ids));

        // Session scoping: check both envelope session_id and student's session_name
        $this->db->group_start();
        $this->db->where_in('r.session_id', $target_session_ids);
        $this->db->or_where_in('s.session_name', $target_session_ids);
        $this->db->group_end();

        // Active items and approved/submitted envelopes
        $this->db->where_in('r.status', array('approved', 'submitted', 'draft'));
        if ($this->db->field_exists('status', 'course_registration_items')) {
            $this->db->group_start();
            $this->db->where('i.status', 'active');
            $this->db->or_where('i.status IS NULL', null, false);
            $this->db->group_end();
        }

        // Target level / contact matching:
        // - CARRYOVER / REPEAT: explicitly registered as carryover for this course in this session (any envelope level)
        // - REGULAR (CORE / ELECTIVE): registered for this course at the targeted semester/level/contact
        $this->db->group_start();
        $this->db->where_in('LOWER(i.registration_type)', array('carryover', 'repeat'));
        $this->db->or_group_start();
            $this->db->group_start();
            $this->db->where_not_in('LOWER(i.registration_type)', array('carryover', 'repeat'));
            $this->db->or_where('i.registration_type IS NULL', null, false);
            $this->db->group_end();

            $this->db->group_start();
            $this->db->where_in('r.semester_id', $target_semester_ids);
            $this->db->or_where_in('r.level', $target_semester_ids);
            if ($level) {
                $this->db->or_where('r.level', $level);
                $this->db->or_where('LOWER(r.level)', strtolower($level));
                if ($contact_num !== null) {
                    $this->db->or_where('r.level', (string)$contact_num);
                    $this->db->or_where('r.level', 'Contact ' . $contact_num);
                    $this->db->or_where('r.level', 'Contact' . $contact_num);
                }
            }
            $this->db->group_end();
        $this->db->group_end();
        $this->db->group_end();

        if (!empty($programme_id) && $programme_id !== 'all') {
            $this->db->group_start();
            $this->db->where('s.programme_id', $programme_id);
            $this->db->or_where('c.programme_id', $programme_id);
            $this->db->or_where('p.id', $programme_id);
            $this->db->or_where('p.name', $programme_id);
            if ($this->db->field_exists('programme_id', 'course_registrations')) {
                $this->db->or_where('r.programme_id', $programme_id);
            }
            $this->db->group_end();
        }
        if (!empty($department_id) && $department_id !== 'all') {
            $this->db->group_start();
            $this->db->where('s.department_id', $department_id);
            $this->db->or_where('p.department_id', $department_id);
            $this->db->group_end();
        }

        $this->db->order_by('u.full_name', 'ASC');

        $students = $this->db->get()->result_array();
        if (!is_array($students)) {
            $students = array();
        }

        // Clean names of any corrupted encoding / replacement characters
        foreach ($students as &$row) {
            if (isset($row['full_name'])) {
                $row['full_name'] = str_replace(array("\xEF\xBF\xBD", "\u{FFFD}", "\xE2\x80\x99", "\xE2\x80\x98", 'â€™', 'â€˜', '`', 'Â´'), "'", $row['full_name']);
            }
        }
        unset($row);

        // Resolve previous attempts and outstanding carryover status
        $this->load->model('Outstanding_course_model');
        $carryover_sources = $this->Outstanding_course_model->get_outstanding_students_for_courses_before(
            array($course_id),
            $session_id,
            $semester_id
        );
        $co_for_course = $carryover_sources[$course_id] ?? array();

        foreach ($students as &$row) {
            $sid = $row['student_id'];
            if (isset($co_for_course[$sid])) {
                $row['registration_type'] = 'carryover';
                $row['is_carryover'] = true;
                $row['origin_result_attempt_id'] = $co_for_course[$sid]['id'];
                $row['previous_attempt'] = $co_for_course[$sid];
            } elseif (in_array(strtolower((string)$row['registration_type']), array('carryover', 'repeat'))) {
                $row['is_carryover'] = true;
            }
        }
        unset($row);

        // Deduplicate students: if a student has both a regular and a carryover entry, regular wins
        $deduped_students = [];
        foreach ($students as $row) {
            $sid = $row['student_id'];
            if (!isset($deduped_students[$sid])) {
                $deduped_students[$sid] = $row;
            } else {
                $existing_is_co = in_array(strtolower($deduped_students[$sid]['registration_type']), ['carryover', 'repeat']);
                $new_is_co = in_array(strtolower($row['registration_type']), ['carryover', 'repeat']);
                if ($existing_is_co && !$new_is_co) {
                    $deduped_students[$sid] = $row;
                }
            }
        }

        $result_students = array_values($deduped_students);

        return $this->json_response(200, array(
            'status' => 'success',
            'data' => $result_students
        ));
    }

    public function bulk_preview()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();

        $reg_session_id  = $this->input->get('reg_session_id', true);
        $reg_semester_id = $this->input->get('reg_semester_id', true);
        $entry_session   = $this->input->get('entry_session', true);
        $entry_mode      = $this->input->get('entry_mode', true);
        $programme_id    = $this->input->get('programme_id', true);
        $level           = $this->input->get('level', true);
        $overwrite       = $this->input->get('overwrite', true) == '1';
        $mode            = $this->input->get('mode', true);

        if (!$mode) {
            $mode = $overwrite ? 'overwrite_normal' : 'unregistered_only';
        }

        $raw_reg_session = $reg_session_id;
        if (!$entry_session) {
            $entry_session = 'all';
        }
        if (!$reg_session_id || !$reg_semester_id || !$programme_id || !$level) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'All target parameters are required'));
        }

        // Resolve session name â†’ UUID
        if ($this->db->table_exists('academic_sessions')) {
            $sess_row = $this->db->get_where('academic_sessions', array('id' => $reg_session_id), 1)->row_array();
            if (!$sess_row) {
                $sess_row = $this->db->get_where('academic_sessions', array('name' => $reg_session_id), 1)->row_array();
            }
            if ($sess_row && isset($sess_row['id'])) {
                $reg_session_id = $sess_row['id'];
            }
        }

        // Map shorthand semester names to actual database names
        if (strtolower($reg_semester_id) === 'first') {
            $reg_semester_id = 'First Semester';
        } elseif (strtolower($reg_semester_id) === 'second') {
            $reg_semester_id = 'Second Semester';
        }

        // Resolve semester name â†’ UUID
        if ($this->db->table_exists('semesters')) {
            $sem_row = $this->db->get_where('semesters', array('id' => $reg_semester_id), 1)->row_array();
            if (!$sem_row) {
                $sem_row = $this->db->get_where('semesters', array('name' => $reg_semester_id), 1)->row_array();
            }
            if ($sem_row && isset($sem_row['id'])) {
                $reg_semester_id = $sem_row['id'];
            }
        }

        // 1. Get the department_id of the selected programme
        $this->db->select('department_id');
        $this->db->where('id', $programme_id);
        $prog = $this->db->get('programmes')->row_array();
        $department_id = $prog ? $prog['department_id'] : null;

        $has_admissions    = $this->db->table_exists('admissions');
        $has_st_entry      = $this->db->field_exists('entry_mode', 'students');
        $has_st_entry_sess = $this->db->field_exists('entry_session_id', 'students');
        $has_adm_entry     = $has_admissions && $this->db->field_exists('entry_mode', 'admissions');
        $has_adm_mode      = $has_admissions && $this->db->field_exists('mode_of_entry', 'admissions');
        $has_adm_level     = $has_admissions && $this->db->field_exists('level', 'admissions');

        $entry_sess_row = $this->resolve_session_row($entry_session);
        $entry_targets = array_values(array_unique(array_filter(array(
            $entry_session,
            $entry_sess_row ? $entry_sess_row['id'] : null,
            $entry_sess_row ? $entry_sess_row['name'] : null,
        ))));

        // Fetch cohort students for the selected programme & entry session
        $select = 's.id, u.full_name, s.admission_id, s.session_name';
        if ($has_st_entry_sess) {
            $select .= ', s.entry_session_id';
        }
        if ($has_st_entry) {
            $select .= ', s.entry_mode';
        }
        if ($has_admissions) {
            $select .= ', a.matric_number, a.admission_number';
            if ($has_adm_entry) {
                $select .= ', a.entry_mode as adm_entry_mode';
            }
            if ($has_adm_mode) {
                $select .= ', a.mode_of_entry';
            }
            if ($has_adm_level) {
                $select .= ', a.level as admission_level';
            }
        }
        $this->db->select($select);
        $this->db->from('students s');
        $this->db->join('users u', 'u.id = s.user_id');
        if ($has_admissions) {
            $this->db->join('admissions a', 'a.id = s.admission_id', 'left');
        }
        if (strtolower((string)$entry_session) !== 'all' && !empty($entry_targets)) {
            $this->db->group_start();
            $this->db->where_in('s.session_name', $entry_targets);
            if ($has_st_entry_sess) {
                $this->db->or_where_in('s.entry_session_id', $entry_targets);
            }
            $this->db->group_end();
        }
        $this->db->group_start();
        $this->db->where('s.programme_id', $programme_id);
        if ($department_id) {
            $this->db->or_group_start();
            $this->db->where('s.programme_id IS NULL', null, false);
            $this->db->where('s.department_id', $department_id);
            $this->db->group_end();
        }
        $this->db->group_end();

        $this->db->order_by('u.full_name', 'ASC');
        $raw_students = $this->db->get()->result_array();

        $level_step = $this->extract_level_step($level);
        $filter_mode_lower = strtolower(trim((string)$entry_mode));
        $filter_is_de = ($filter_mode_lower === 'direct entry' || $filter_mode_lower === 'direct_entry' || $filter_mode_lower === 'de');
        $filter_is_fresh = ($filter_mode_lower === 'fresh' || $filter_mode_lower === 'utme');

        // Filter by Academic Session + Contact progression, Entry Cohort, and Entry Mode
        $candidate_students = array();
        $contacts_student_counts = array(
            'Contact 1' => 0,
            'Contact 2' => 0,
            'Contact 3' => 0,
            'Contact 4' => 0,
            'Contact 5' => 0,
            'Contact 6' => 0,
        );
        foreach ($raw_students as $st) {
            $is_de = $this->is_direct_entry_student($st);
            $st['entry_mode'] = $is_de ? 'Direct Entry' : 'Fresh';

            if ($filter_is_de && !$is_de) {
                continue;
            }
            if ($filter_is_fresh && $is_de) {
                continue;
            }

            for ($c_idx = 1; $c_idx <= 6; $c_idx++) {
                $c_label = 'Contact ' . $c_idx;
                if ($this->does_student_match_academic_session_and_contact($st, $raw_reg_session, $c_label, $entry_session)) {
                    $contacts_student_counts[$c_label]++;
                }
            }

            if (!$this->does_student_match_academic_session_and_contact($st, $raw_reg_session, $level, $entry_session)) {
                continue;
            }

            $env = $this->resolve_student_session_envelope($st, $entry_session, $level, $raw_reg_session);
            $st['entry_session_id']      = $env['entry_session_id'];
            $st['entry_session_name']    = $env['entry_session_name'];
            $st['academic_session_id']   = $env['academic_session_id'];
            $st['academic_session_name'] = $env['academic_session_name'];
            $candidate_students[] = $st;
        }

        // Check existing registration envelopes for the candidate students at this Contact / Level
        $existing_env_map = array();
        $non_co_reg_map   = array();
        if (!empty($candidate_students)) {
            $s_ids = array_column($candidate_students, 'id');
            foreach (array_chunk($s_ids, 500) as $s_chunk) {
                $this->db->select('student_id, id, session_id, total_credits, status');
                $this->db->from('course_registrations');
                $this->db->where_in('student_id', $s_chunk);
                $this->db->group_start();
                $this->db->where('semester_id', $reg_semester_id);
                $this->db->or_where('level', $level);
                $this->db->group_end();
                $this->db->where('level', $level);
                $env_rows = $this->db->get()->result_array();
                foreach ($env_rows as $er) {
                    $existing_env_map[$er['student_id']] = $er;
                }
            }

            $found_reg_ids = array_column($existing_env_map, 'id');
            if (!empty($found_reg_ids)) {
                $has_item_status = $this->db->field_exists('status', 'course_registration_items');
                foreach (array_chunk($found_reg_ids, 500) as $r_chunk) {
                    $this->db->select(' DISTINCT(registration_id) as registration_id', false);
                    $this->db->from('course_registration_items');
                    $this->db->where_in('registration_id', $r_chunk);
                    $this->db->where_not_in('UPPER(registration_type)', array('CARRYOVER', 'REPEAT'));
                    if ($has_item_status) {
                        $this->db->group_start();
                        $this->db->where('status', 'active');
                        $this->db->or_where('status IS NULL', null, false);
                        $this->db->group_end();
                    }
                    $r_items = $this->db->get()->result_array();
                    foreach ($r_items as $ri) {
                        $non_co_reg_map[$ri['registration_id']] = true;
                    }
                }
            }
        }

        $students = array();
        $already_registered_count = 0;
        $unregistered_count = 0;
        $derived_academic_sessions = array();

        foreach ($candidate_students as $st_row) {
            $sid = $st_row['id'];
            $env_row = isset($existing_env_map[$sid]) ? $existing_env_map[$sid] : null;
            $has_non_co = $env_row && !empty($non_co_reg_map[$env_row['id']]);

            if ($mode === 'unregistered_only' && $has_non_co) {
                continue;
            }
            if ($mode === 'append_existing' && !$env_row) {
                continue;
            }

            if ($env_row) {
                $st_row['has_existing_registration'] = true;
                $st_row['existing_credits'] = (int)($env_row['total_credits'] ?? 0);
                $already_registered_count++;
            } else {
                $st_row['has_existing_registration'] = false;
                $st_row['existing_credits'] = 0;
                $unregistered_count++;
            }

            if (!empty($st_row['academic_session_name'])) {
                $derived_academic_sessions[$st_row['academic_session_name']] = true;
            }
            $students[] = $st_row;
        }

        $eligible_students_count = count($students);

        $contact_num = null;
        if (preg_match('/contact\s*(\d+)/i', $level, $m)) {
            $contact_num = (int)$m[1];
        }
        $has_course_contact = $this->db->field_exists('contact_number', 'courses');

        // Fetch curriculum courses for this programme/level/semester
        $this->db->where('programme_id', $programme_id);
        $this->db->group_start();
        $this->db->where('level', $level);
        $this->db->or_where('LOWER(level)', strtolower($level));
        if ($contact_num !== null) {
            $this->db->or_where('level', (string)$contact_num);
            $this->db->or_where('level', 'Contact ' . $contact_num);
            $this->db->or_where('level', 'Contact' . $contact_num);
            if ($has_course_contact) {
                $this->db->or_where('contact_number', $contact_num);
            }
        }
        $this->db->group_end();
        $courses = $this->db->get('courses')->result_array();

        // Fallback 1: match by contact_number or level directly
        if (empty($courses)) {
            $this->db->where('programme_id', $programme_id);
            if ($contact_num !== null && $has_course_contact) {
                $this->db->where('contact_number', $contact_num);
            } else {
                $this->db->where('level', $level);
            }
            $courses = $this->db->get('courses')->result_array();
        }

        // Fallback 2: if still empty, fetch all courses for this programme
        if (empty($courses)) {
            $this->db->where('programme_id', $programme_id);
            $courses = $this->db->get('courses')->result_array();
        }

        $core_courses = array();
        $elective_courses = array();

        foreach ($courses as $c) {
            if (strtolower($c['type']) === 'elective') {
                $elective_courses[] = $c;
            } else {
                $core_courses[] = $c;
            }
        }

        return $this->json_response(200, array('status' => 'success', 'data' => array(
            'mode'                      => $mode,
            'eligible_students_count'   => $eligible_students_count,
            'already_registered_count'  => $already_registered_count,
            'unregistered_count'        => $unregistered_count,
            'derived_academic_sessions' => array_keys($derived_academic_sessions),
            'contacts_student_counts'   => $contacts_student_counts,
            'eligible_students'         => $students,
            'core_courses'              => $core_courses,
            'elective_courses'          => $elective_courses
        )));
    }

    public function bulk_process()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();
        $payload = json_decode(file_get_contents('php://input'), true);

        $reg_session_id      = $payload['reg_session_id'] ?? null;
        $reg_semester_id     = $payload['reg_semester_id'] ?? null;
        $entry_session       = $payload['entry_session'] ?? 'all';
        $entry_mode          = $payload['entry_mode'] ?? null;
        $programme_id        = $payload['programme_id'] ?? null;
        $level               = $payload['level'] ?? null;
        $selected_course_ids = isset($payload['selected_course_ids']) && is_array($payload['selected_course_ids'])
            ? array_values(array_unique(array_filter($payload['selected_course_ids'])))
            : array();
        $overwrite           = !empty($payload['overwrite']);
        $mode                = $payload['mode'] ?? ($overwrite ? 'overwrite_normal' : 'unregistered_only');

        $raw_reg_session = $reg_session_id;
        if (!$entry_session) {
            $entry_session = 'all';
        }
        if (!$reg_session_id || !$reg_semester_id || !$programme_id || !$level || empty($selected_course_ids)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid parameters or no courses selected'));
        }

        // Resolve session name â†’ UUID (the FK references academic_sessions.id)
        if ($this->db->table_exists('academic_sessions') && strtolower((string)$reg_session_id) !== 'all') {
            $sess_row = $this->db->get_where('academic_sessions', array('id' => $reg_session_id), 1)->row_array();
            if (!$sess_row) {
                $sess_row = $this->db->get_where('academic_sessions', array('name' => $reg_session_id), 1)->row_array();
            }
            if ($sess_row && isset($sess_row['id'])) {
                $reg_session_id = $sess_row['id'];
            } else {
                return $this->json_response(400, array('status' => 'error', 'message' => 'Invalid session selected: could not resolve session UUID.'));
            }
        }

        // Map shorthand semester names to actual database names
        if (strtolower($reg_semester_id) === 'first') {
            $reg_semester_id = 'First Semester';
        } elseif (strtolower($reg_semester_id) === 'second') {
            $reg_semester_id = 'Second Semester';
        }

        // Resolve semester name â†’ UUID if needed
        if ($this->db->table_exists('semesters')) {
            $sem_row = $this->db->get_where('semesters', array('id' => $reg_semester_id), 1)->row_array();
            if (!$sem_row) {
                $sem_row = $this->db->get_where('semesters', array('name' => $reg_semester_id), 1)->row_array();
            }
            if ($sem_row && isset($sem_row['id'])) {
                $reg_semester_id = $sem_row['id'];
            } else {
                return $this->json_response(400, array('status' => 'error', 'message' => "Invalid semester selected: could not resolve semester UUID for '$reg_semester_id'."));
            }
        }

        $this->db->select('department_id');
        $this->db->where('id', $programme_id);
        $prog = $this->db->get('programmes')->row_array();
        $department_id = $prog ? $prog['department_id'] : null;

        $has_admissions    = $this->db->table_exists('admissions');
        $has_st_entry      = $this->db->field_exists('entry_mode', 'students');
        $has_st_entry_sess = $this->db->field_exists('entry_session_id', 'students');
        $has_adm_entry     = $has_admissions && $this->db->field_exists('entry_mode', 'admissions');
        $has_adm_mode      = $has_admissions && $this->db->field_exists('mode_of_entry', 'admissions');
        $has_adm_level     = $has_admissions && $this->db->field_exists('level', 'admissions');

        $entry_sess_row = $this->resolve_session_row($entry_session);
        $entry_targets = array_values(array_unique(array_filter(array(
            $entry_session,
            $entry_sess_row ? $entry_sess_row['id'] : null,
            $entry_sess_row ? $entry_sess_row['name'] : null,
        ))));

        $select = 's.id, s.admission_id, s.session_name';
        if ($has_st_entry_sess) {
            $select .= ', s.entry_session_id';
        }
        if ($has_st_entry) {
            $select .= ', s.entry_mode';
        }
        if ($has_admissions) {
            $select .= ', a.matric_number';
            if ($has_adm_entry) {
                $select .= ', a.entry_mode as adm_entry_mode';
            }
            if ($has_adm_mode) {
                $select .= ', a.mode_of_entry';
            }
            if ($has_adm_level) {
                $select .= ', a.level as admission_level';
            }
        }
        $this->db->select($select);
        $this->db->from('students s');
        if ($has_admissions) {
            $this->db->join('admissions a', 'a.id = s.admission_id', 'left');
        }
        if (strtolower((string)$entry_session) !== 'all' && !empty($entry_targets)) {
            $this->db->group_start();
            $this->db->where_in('s.session_name', $entry_targets);
            if ($has_st_entry_sess) {
                $this->db->or_where_in('s.entry_session_id', $entry_targets);
            }
            $this->db->group_end();
        }
        $this->db->group_start();
        $this->db->where('s.programme_id', $programme_id);
        if ($department_id) {
            $this->db->or_group_start();
            $this->db->where('s.programme_id IS NULL', null, false);
            $this->db->where('s.department_id', $department_id);
            $this->db->group_end();
        }
        $this->db->group_end();

        $raw_students = $this->db->get()->result_array();

        $level_step = $this->extract_level_step($level);
        $filter_mode_lower = strtolower(trim((string)$entry_mode));
        $filter_is_de = ($filter_mode_lower === 'direct entry' || $filter_mode_lower === 'direct_entry' || $filter_mode_lower === 'de');
        $filter_is_fresh = ($filter_mode_lower === 'fresh' || $filter_mode_lower === 'utme');

        $candidate_students = array();
        foreach ($raw_students as $st) {
            $is_de = $this->is_direct_entry_student($st);
            if ($filter_is_de && !$is_de) {
                continue;
            }
            if ($filter_is_fresh && $is_de) {
                continue;
            }
            if (!$this->does_student_match_academic_session_and_contact($st, $raw_reg_session, $level, $entry_session)) {
                continue;
            }
            $env = $this->resolve_student_session_envelope($st, $entry_session, $level, $raw_reg_session);
            $st['entry_session_id']    = $env['entry_session_id'];
            $st['academic_session_id'] = $env['academic_session_id'];
            $candidate_students[] = $st;
        }

        if (empty($candidate_students)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'No eligible students found to process.'));
        }

        $has_approved_at   = $this->db->field_exists('approved_at', 'course_registrations');
        $has_approved_by   = $this->db->field_exists('approved_by', 'course_registrations');
        $has_level         = $this->db->field_exists('level', 'course_registrations');
        $has_programme     = $this->db->field_exists('programme_id', 'course_registrations');
        $has_submitted     = $this->db->field_exists('submitted_at', 'course_registrations');
        $has_acad_sess_col = $this->db->field_exists('academic_session_id', 'course_registrations');
        $has_entry_sess_col= $this->db->field_exists('entry_session_id', 'course_registrations');
        $has_item_status   = $this->db->field_exists('status', 'course_registration_items');

        $cand_ids = array_column($candidate_students, 'id');
        $env_map = array();
        foreach (array_chunk($cand_ids, 500) as $stu_chunk) {
            $this->db->where_in('student_id', $stu_chunk);
            $this->db->group_start();
            $this->db->where('semester_id', $reg_semester_id);
            if ($has_level) {
                $this->db->or_where('level', $level);
            }
            $this->db->group_end();
            if ($has_level) {
                $this->db->where('level', $level);
            }
            $existing_envs = $this->db->get('course_registrations')->result_array();
            foreach ($existing_envs as $env) {
                $env_map[$env['student_id']] = $env['id'];
            }
        }

        $non_co_reg_map = array();
        $all_found_reg_ids = array_values($env_map);
        if (!empty($all_found_reg_ids)) {
            foreach (array_chunk($all_found_reg_ids, 500) as $r_chunk) {
                $this->db->select('DISTINCT(registration_id) as registration_id', false);
                $this->db->from('course_registration_items');
                $this->db->where_in('registration_id', $r_chunk);
                $this->db->where_not_in('UPPER(registration_type)', array('CARRYOVER', 'REPEAT'));
                if ($has_item_status) {
                    $this->db->group_start();
                    $this->db->where('status', 'active');
                    $this->db->or_where('status IS NULL', null, false);
                    $this->db->group_end();
                }
                $r_items = $this->db->get()->result_array();
                foreach ($r_items as $ri) {
                    $non_co_reg_map[$ri['registration_id']] = true;
                }
            }
        }

        $students = array();
        foreach ($candidate_students as $st) {
            $sid = $st['id'];
            $existing_rid = isset($env_map[$sid]) ? $env_map[$sid] : null;
            $has_non_co = $existing_rid && !empty($non_co_reg_map[$existing_rid]);
            if ($mode === 'unregistered_only' && $has_non_co) {
                continue;
            }
            if ($mode === 'append_existing' && !$existing_rid) {
                continue;
            }
            $students[] = $st;
        }

        if (empty($students)) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'No eligible students found to process.'));
        }

        // Get course details for type mapping
        $this->db->where_in('id', $selected_course_ids);
        $course_records = $this->db->get('courses')->result_array();
        $course_map = array();
        foreach ($course_records as $cr) {
            $course_map[$cr['id']] = $cr['type'];
        }

        $this->db->trans_start();

        $now = date('Y-m-d H:i:s');
        $actor_id = isset($user['user_id']) ? $user['user_id'] : ($user['id'] ?? null);

        $existing_reg_ids = array();
        foreach ($students as $st) {
            if (isset($env_map[$st['id']])) {
                $existing_reg_ids[] = $env_map[$st['id']];
            }
        }

        // If full overwrite mode, remove existing non-carryover items in bulk chunks
        if ($mode === 'overwrite_normal' && !empty($existing_reg_ids)) {
            foreach (array_chunk($existing_reg_ids, 500) as $reg_chunk) {
                $this->db->where_in('registration_id', $reg_chunk);
                $this->db->where_not_in('registration_type', array('CARRYOVER', 'REPEAT'));
                $this->db->delete('course_registration_items');
            }
        }

        // Fetch remaining existing items for existing envelopes in bulk chunks
        $existing_items_map = array(); // [reg_id][course_id] => true
        if (!empty($existing_reg_ids)) {
            foreach (array_chunk($existing_reg_ids, 500) as $reg_chunk) {
                $this->db->select('registration_id, course_id');
                $this->db->from('course_registration_items');
                $this->db->where_in('registration_id', $reg_chunk);
                if ($has_item_status) {
                    $this->db->where('status', 'active');
                }
                $curr_items = $this->db->get()->result_array();
                foreach ($curr_items as $ci) {
                    $existing_items_map[$ci['registration_id']][$ci['course_id']] = true;
                }
            }
        }

        $new_envelopes = array();
        $updated_envelopes = array();
        $items_to_insert = array();
        $all_affected_reg_ids = array();

        foreach ($students as $st) {
            $reg_id = $env_map[$st['id']] ?? null;
            $teaching_sess_id = !empty($st['academic_session_id']) ? $st['academic_session_id'] : $reg_session_id;
            $entry_sess_id    = !empty($st['entry_session_id']) ? $st['entry_session_id'] : null;

            if (!$reg_id) {
                if ($mode === 'append_existing') {
                    continue;
                }
                $reg_id = $this->Course_registration_model->generate_uuid();
                $reg_row = array(
                    'id'          => $reg_id,
                    'student_id'  => $st['id'],
                    'session_id'  => $teaching_sess_id,
                    'semester_id' => $reg_semester_id,
                    'status'      => 'approved',
                    'created_at'  => $now,
                    'updated_at'  => $now,
                );
                if ($has_acad_sess_col)  { $reg_row['academic_session_id'] = $teaching_sess_id; }
                if ($has_entry_sess_col) { $reg_row['entry_session_id']    = $entry_sess_id; }
                if ($has_level)          { $reg_row['level']               = $level; }
                if ($has_programme)      { $reg_row['programme_id']        = $programme_id; }
                if ($has_submitted)      { $reg_row['submitted_at']        = $now; }
                if ($has_approved_at)    { $reg_row['approved_at']         = $now; }
                if ($has_approved_by)    { $reg_row['approved_by']         = $actor_id; }

                $new_envelopes[] = $reg_row;
            } else {
                $upd_env = array(
                    'id'         => $reg_id,
                    'session_id' => $teaching_sess_id,
                    'updated_at' => $now,
                );
                if ($has_acad_sess_col)  { $upd_env['academic_session_id'] = $teaching_sess_id; }
                if ($has_entry_sess_col && $entry_sess_id) { $upd_env['entry_session_id'] = $entry_sess_id; }
                $updated_envelopes[] = $upd_env;
            }

            $all_affected_reg_ids[] = $reg_id;

            foreach ($selected_course_ids as $c_id) {
                if (empty($existing_items_map[$reg_id][$c_id])) {
                    $item_row = array(
                        'id'                => $this->Course_registration_model->generate_uuid(),
                        'registration_id'   => $reg_id,
                        'course_id'         => $c_id,
                        'registration_type' => isset($course_map[$c_id]) ? $course_map[$c_id] : 'core',
                        'created_at'        => $now,
                        'updated_at'        => $now,
                    );
                    if ($has_item_status) {
                        $item_row['status'] = 'active';
                    }
                    $items_to_insert[] = $item_row;
                    $existing_items_map[$reg_id][$c_id] = true;
                }
            }
        }

        if (!empty($new_envelopes)) {
            foreach (array_chunk($new_envelopes, 300) as $env_chunk) {
                $this->db->insert_batch('course_registrations', $env_chunk);
            }
        }

        if (!empty($updated_envelopes)) {
            foreach (array_chunk($updated_envelopes, 300) as $uenv_chunk) {
                $this->db->update_batch('course_registrations', $uenv_chunk, 'id');
            }
        }

        if (!empty($items_to_insert)) {
            foreach (array_chunk($items_to_insert, 300) as $item_chunk) {
                $this->db->insert_batch('course_registration_items', $item_chunk);
            }
        }

        $this->recalculate_registrations_total_credits($all_affected_reg_ids);

        $this->db->trans_complete();

        if ($this->db->trans_status() === FALSE) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Database transaction failed'));
        }

        $items_added_cnt = count($items_to_insert);
        $students_cnt = count($all_affected_reg_ids);
        return $this->json_response(200, array(
            'status' => 'success',
            'message' => "Successfully processed {$students_cnt} student(s) ({$items_added_cnt} course entry/entries added)."
        ));
    }


    public function get_registered_courses()
    {
        $this->require_login();
        
        $session_id = $this->input->get('session_id');
        $semester_id = $this->input->get('semester_id');
        $department_id = $this->input->get('department_id');
        $programme_id = $this->input->get('programme_id');

        if (!$session_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Missing session parameter'));
        }

        $this->load->library('Period_resolver');
        $period = $this->period_resolver->resolve($session_id, $semester_id && $semester_id !== 'all' ? $semester_id : null);
        $target_session_ids = $period['session_ids'];
        $target_semester_ids = $period['semester_ids'];
        $contact_num = $period['contact_number'];
        $target_level = $period['label'];

        $this->db->select('c.id, c.code, c.title, c.level, c.type, 
                           COALESCE(c.contact_number, 
                               CASE 
                                   WHEN c.level LIKE "%Contact 1%" THEN 1
                                   WHEN c.level LIKE "%Contact 2%" THEN 2
                                   WHEN c.level LIKE "%Contact 3%" THEN 3
                                   WHEN c.level LIKE "%Contact 4%" THEN 4
                                   WHEN c.level LIKE "%Contact 5%" THEN 5
                                   WHEN c.level LIKE "%Contact 6%" THEN 6
                                   ELSE NULL
                               END) as contact_number,
                           COUNT(DISTINCT r.student_id) as registered_count,
                           SUM(CASE WHEN LOWER(i.registration_type) IN ("carryover", "repeat") THEN 1 ELSE 0 END) as carryover_count');
        $this->db->from('courses c');
        $this->db->join('programmes p', 'p.id = c.programme_id', 'left');

        // Session scoping for registration items in this teaching session
        $sess_conditions = array();
        foreach ($target_session_ids as $ts_id) {
            $sess_conditions[] = $this->db->escape($ts_id);
        }
        $sess_in = implode(',', $sess_conditions);
        $sess_sql = $this->db->field_exists('academic_session_id', 'course_registrations')
            ? "(r.academic_session_id IN ($sess_in) OR r.session_id IN ($sess_in))"
            : "r.session_id IN ($sess_in)";

        $this->db->join('course_registration_items i', 'i.course_id = c.id AND (i.status = "active" OR i.status IS NULL)', 'left', false);
        $this->db->join('course_registrations r', 'r.id = i.registration_id AND ' . $sess_sql . ' AND r.status IN ("approved", "submitted", "draft")', 'left', false);
        $this->db->join('students s', 's.id = r.student_id', 'left', false);

        // Target contact / level course matching:
        // When a specific contact is selected (e.g. Contact 5, Contact 6):
        // 1. Regular courses belonging to this Contact (c.contact_number = contact_num OR c.level = target_level)
        // 2. Courses registered by students who are currently enrolled in this Contact
        if ($semester_id && $semester_id !== 'all') {
            $this->db->group_start();
            if ($contact_num !== null) {
                if ($this->db->field_exists('contact_number', 'courses')) {
                    $this->db->where('c.contact_number', $contact_num);
                    $this->db->or_where('c.contact_number', (string)$contact_num);
                }
                $this->db->or_where_in('c.level', $target_semester_ids);
                if ($target_level) {
                    $this->db->or_where('c.level', $target_level);
                    $this->db->or_where('LOWER(c.level)', strtolower($target_level));
                }
            }
            $this->db->or_where_in('r.semester_id', $target_semester_ids);
            $this->db->or_where_in('r.level', $target_semester_ids);
            if ($target_level) {
                $this->db->or_where('r.level', $target_level);
                $this->db->or_where('LOWER(r.level)', strtolower($target_level));
                if ($contact_num !== null) {
                    $this->db->or_where('r.level', (string)$contact_num);
                    $this->db->or_where('r.level', 'Contact ' . $contact_num);
                    $this->db->or_where('r.level', 'Contact' . $contact_num);
                }
            }
            // Always include courses that students in this teaching session have registered as carryovers/repeats
            $this->db->or_where_in('LOWER(i.registration_type)', array('carryover', 'repeat'));
            $this->db->group_end();
        }

        // Programme filter
        if ($programme_id && $programme_id !== 'all') {
            $this->db->group_start();
            $this->db->where('c.programme_id', $programme_id);
            $this->db->or_where('p.id', $programme_id);
            $this->db->or_where('s.programme_id', $programme_id);
            $this->db->group_end();
        }

        // Department filter (only applied when programme_id is not already filtering)
        if ((!$programme_id || $programme_id === 'all') && $department_id && $department_id !== 'all') {
            $this->db->group_start();
            $this->db->where('p.department_id', $department_id);
            $this->db->or_where('s.department_id', $department_id);
            $this->db->group_end();
        }

        $this->db->group_by('c.id');
        $this->db->order_by('c.level', 'ASC');
        $this->db->order_by('c.code', 'ASC');

        $courses = $this->db->get()->result_array();

        return $this->json_response(200, $courses);
    }


    public function get_course_roster()
    {
        $this->require_login();
        $this->load->model('Courses_model');
        $this->load->model('Course_registration_model');

        $session_id    = $this->input->get('session_id');
        $cohort        = $this->input->get('cohort') ?: ($this->input->get('entry_session') ?: 'all');
        $semester_id   = $this->input->get('semester_id');
        $programme_id  = $this->input->get('programme_id');
        $department_id = $this->input->get('department_id');
        $course_id     = $this->input->get('course_id');
        $entry_mode    = $this->input->get('entry_mode');

        if (!$session_id || !$semester_id || !$programme_id) {
            return $this->json_response(400, array(
                'status'  => 'error',
                'message' => 'Missing required parameters: session_id, semester_id, and programme_id are required.'
            ));
        }

        // 1. Resolve session identifiers
        $target_session_ids = array($session_id);
        if ($this->db->table_exists('academic_sessions')) {
            $sess_row = $this->db->get_where('academic_sessions', array('id' => $session_id), 1)->row_array();
            if ($sess_row && !empty($sess_row['name'])) {
                $target_session_ids[] = $sess_row['name'];
            } else {
                $sess_row = $this->db->get_where('academic_sessions', array('name' => $session_id), 1)->row_array();
                if ($sess_row && !empty($sess_row['id'])) {
                    $target_session_ids[] = $sess_row['id'];
                }
            }
        }
        $target_session_ids = array_values(array_unique(array_filter($target_session_ids)));

        // 2. Resolve semester / contact / level
        $target_semester_ids = array($semester_id);
        $target_level = null;
        $contact_num = null;

        if (preg_match('/contact\\s*(\\d+)/i', $semester_id, $matches)) {
            $contact_num = (int)$matches[1];
            $target_level = 'Contact ' . $contact_num;
            $target_semester_ids[] = $target_level;
        }

        if ($this->db->table_exists('semesters')) {
            $sem = $this->db->get_where('semesters', array('name' => $semester_id), 1)->row_array();
            if (!$sem) {
                $sem = $this->db->get_where('semesters', array('id' => $semester_id), 1)->row_array();
            }
            if ($sem) {
                $target_semester_ids[] = $sem['id'];
                $target_semester_ids[] = $sem['name'];
                if (stripos($sem['name'], 'Contact') !== false && preg_match('/contact\\s*(\\d+)/i', $sem['name'], $m)) {
                    $contact_num = (int)$m[1];
                    $target_level = 'Contact ' . $contact_num;
                    $target_semester_ids[] = $target_level;
                }
            }
        }
        $target_semester_ids = array_values(array_unique(array_filter($target_semester_ids)));

        // 3. Query all cohort students for this programme & session
        $has_admissions    = $this->db->table_exists('admissions');
        $has_st_entry      = $this->db->field_exists('entry_mode', 'students');
        $has_st_entry_sess = $this->db->field_exists('entry_session_id', 'students');
        $has_adm_entry     = $has_admissions && $this->db->field_exists('entry_mode', 'admissions');
        $has_adm_moe       = $has_admissions && $this->db->field_exists('mode_of_entry', 'admissions');
        $has_adm_level     = $has_admissions && $this->db->field_exists('level', 'admissions');

        $roster_select = "s.id as student_id, s.admission_id, s.session_name, u.full_name, u.email,
            COALESCE(ad.matric_number, '') as matric_number,
            COALESCE(ad.admission_number, '') as admission_number";
        if ($has_st_entry_sess) {
            $roster_select .= ", s.entry_session_id";
        }
        if ($has_st_entry) {
            $roster_select .= ", s.entry_mode";
        }
        if ($has_adm_entry) {
            $roster_select .= ", ad.entry_mode as adm_entry_mode";
        }
        if ($has_adm_moe) {
            $roster_select .= ", ad.mode_of_entry";
        }
        if ($has_adm_level) {
            $roster_select .= ", ad.level as admission_level";
        }

        $cohort_sess_row = $this->resolve_session_row($cohort);
        $cohort_targets = array_values(array_unique(array_filter(array(
            $cohort,
            $cohort_sess_row ? $cohort_sess_row['id'] : null,
            $cohort_sess_row ? $cohort_sess_row['name'] : null,
        ))));

        $this->db->select($roster_select, false);
        $this->db->from('students s');
        $this->db->join('users u', 'u.id = s.user_id');
        $this->db->join('admissions ad', 'ad.id = s.admission_id', 'left');
        $this->db->where('s.programme_id', $programme_id);
        if (strtolower((string)$cohort) !== 'all' && !empty($cohort_targets)) {
            $this->db->group_start();
            $this->db->where_in('s.session_name', $cohort_targets);
            if ($has_st_entry_sess) {
                $this->db->or_where_in('s.entry_session_id', $cohort_targets);
            }
            $this->db->group_end();
        }
        if ($department_id && strtolower((string)$department_id) !== 'all') {
            $this->db->where('s.department_id', $department_id);
        }
        $this->db->order_by('u.full_name', 'ASC');
        $raw_students_rows = $this->db->get()->result_array();

        // Also identify any students who already have an existing registration envelope in this Academic Session + Contact
        $already_in_period_student_ids = array();
        if (!empty($raw_students_rows)) {
            $has_cr_acad_sess = $this->db->field_exists('academic_session_id', 'course_registrations');
            $all_prog_sids = array_column($raw_students_rows, 'student_id');
            foreach (array_chunk($all_prog_sids, 500) as $p_chunk) {
                $this->db->select('DISTINCT(cr.student_id) as student_id', false);
                $this->db->from('course_registrations cr');
                $this->db->where_in('cr.student_id', $p_chunk);
                if (strtolower((string)$session_id) !== 'all' && !empty($target_session_ids)) {
                    $this->db->group_start();
                    $this->db->where_in('cr.session_id', $target_session_ids);
                    if ($has_cr_acad_sess) {
                        $this->db->or_where_in('cr.academic_session_id', $target_session_ids);
                    }
                    $this->db->group_end();
                }
                $this->db->group_start();
                $this->db->where_in('cr.semester_id', $target_semester_ids);
                $this->db->or_where_in('cr.level', $target_semester_ids);
                $this->db->group_end();
                $this->db->where_in('cr.status', array('approved', 'submitted', 'draft'));
                $existing_cr_rows = $this->db->get()->result_array();
                foreach ($existing_cr_rows as $ecr) {
                    $already_in_period_student_ids[$ecr['student_id']] = true;
                }
            }
        }

        $em_lower = strtolower(trim((string)$entry_mode));
        $filter_is_fresh = ($em_lower === 'fresh' || $em_lower === 'utme');
        $filter_is_de    = ($em_lower === 'direct_entry' || $em_lower === 'direct entry' || $em_lower === 'de');

        $students_rows = array();
        $derived_academic_sessions = array();
        $all_score_session_ids = $target_session_ids;
        $contacts_student_counts = array(
            'Contact 1' => 0,
            'Contact 2' => 0,
            'Contact 3' => 0,
            'Contact 4' => 0,
            'Contact 5' => 0,
            'Contact 6' => 0,
        );

        foreach ($raw_students_rows as $st) {
            $is_de = $this->is_direct_entry_student($st);
            $st['entry_mode'] = $is_de ? 'Direct Entry' : 'Fresh';

            if ($filter_is_fresh && $is_de) {
                continue;
            }
            if ($filter_is_de && !$is_de) {
                continue;
            }

            // Count how many students in this programme match each Contact in the selected Academic Session
            for ($c_idx = 1; $c_idx <= 6; $c_idx++) {
                $c_label = 'Contact ' . $c_idx;
                if ($this->does_student_match_academic_session_and_contact($st, $session_id, $c_label, $cohort)) {
                    $contacts_student_counts[$c_label]++;
                }
            }

            // Direct Entry students start at Contact 2 and cannot be in Contact 1 roster
            if ($contact_num === 1 && $is_de) {
                continue;
            }

            $matches_formula = $this->does_student_match_academic_session_and_contact($st, $session_id, $target_level ?: $semester_id, $cohort);
            $has_existing_in_period = isset($already_in_period_student_ids[$st['student_id']]);

            if (!$matches_formula && !$has_existing_in_period) {
                continue;
            }

            $env = $this->resolve_student_session_envelope($st, $cohort, $target_level ?: $semester_id, $session_id);
            $st['academic_session_id']   = $env['academic_session_id'];
            $st['academic_session_name'] = $env['academic_session_name'];
            $st['entry_session_id']      = $env['entry_session_id'];
            if (!empty($env['academic_session_name'])) {
                $derived_academic_sessions[$env['academic_session_name']] = true;
                $all_score_session_ids[] = $env['academic_session_name'];
            }
            if (!empty($env['academic_session_id'])) {
                $all_score_session_ids[] = $env['academic_session_id'];
            }
            $students_rows[] = $st;
        }
        $all_score_session_ids = array_values(array_unique(array_filter($all_score_session_ids)));
        $cohort_count = count($students_rows);
        $student_ids = array_column($students_rows, 'student_id');

        // 4. Query curriculum courses for this Programme & Contact/Level
        $has_course_contact = $this->db->field_exists('contact_number', 'courses');
        $has_credit_units   = $this->db->field_exists('credit_units', 'courses');
        $credit_col         = $has_credit_units ? 'c.credit_units' : ($this->db->field_exists('credit_unit', 'courses') ? 'c.credit_unit' : '0');
        $this->db->select('c.id, c.code, c.title, ' . $credit_col . ' as credit_unit, c.type, c.level' . ($has_course_contact ? ', c.contact_number' : ''));
        $this->db->from('courses c');
        $this->db->where('c.programme_id', $programme_id);
        if ($contact_num !== null) {
            $this->db->group_start();
            if ($has_course_contact) {
                $this->db->where('c.contact_number', $contact_num);
                $this->db->or_where('c.contact_number', (string)$contact_num);
            }
            if ($target_level) {
                $this->db->or_where('c.level', $target_level);
                $this->db->or_where('c.level', (string)$contact_num);
                $this->db->or_where('c.level', 'Contact ' . $contact_num);
            }
            $this->db->group_end();
        }
        $this->db->order_by('c.code', 'ASC');
        $curriculum_courses = $this->db->get()->result_array();

        $courses_map = array();
        foreach ($curriculum_courses as $c) {
            $courses_map[$c['id']] = array(
                'id'                 => $c['id'],
                'code'               => $c['code'],
                'title'              => $c['title'],
                'credit_unit'        => isset($c['credit_unit']) ? (int)$c['credit_unit'] : (isset($c['credit_units']) ? (int)$c['credit_units'] : 0),
                'type'               => !empty($c['type']) ? strtolower($c['type']) : 'core',
                'level'              => $c['level'] ?? '',
                'registered_count'   => 0,
                'unregistered_count' => $cohort_count,
                'total_cohort'       => $cohort_count,
            );
        }

        // 5. Query registrations and items for this cohort
        $reg_items_by_course = array(); // [course_id][student_id] => item
        $has_item_status = $this->db->field_exists('status', 'course_registration_items');

        if (!empty($student_ids)) {
            foreach (array_chunk($student_ids, 500) as $s_chunk) {
                $this->db->select('cr.student_id, cr.id as registration_id, cri.id as item_id, cri.course_id, cri.registration_type, c.code, c.title, ' . $credit_col . ' as credit_unit, c.type as course_type');
                $this->db->from('course_registration_items cri');
                $this->db->join('course_registrations cr', 'cr.id = cri.registration_id');
                $this->db->join('courses c', 'c.id = cri.course_id', 'left');
                $this->db->where_in('cr.student_id', $s_chunk);
                $this->db->group_start();
                $this->db->where_in('cr.semester_id', $target_semester_ids);
                $this->db->or_where_in('cr.level', $target_semester_ids);
                $this->db->group_end();
                $this->db->where_in('cr.status', array('approved', 'submitted', 'draft'));
                if ($has_item_status) {
                    $this->db->group_start();
                    $this->db->where('cri.status', 'active');
                    $this->db->or_where('cri.status IS NULL', null, false);
                    $this->db->group_end();
                }
                $items = $this->db->get()->result_array();
                foreach ($items as $it) {
                    $c_id = $it['course_id'];
                    $s_id = $it['student_id'];
                    if (!isset($courses_map[$c_id]) && !empty($it['code'])) {
                        $courses_map[$c_id] = array(
                            'id'                 => $c_id,
                            'code'               => $it['code'],
                            'title'              => $it['title'],
                            'credit_unit'        => (int)($it['credit_unit'] ?? 0),
                            'type'               => !empty($it['course_type']) ? strtolower($it['course_type']) : 'core',
                            'level'              => $target_level ?: $semester_id,
                            'registered_count'   => 0,
                            'unregistered_count' => $cohort_count,
                            'total_cohort'       => $cohort_count,
                        );
                    }
                    if (!isset($reg_items_by_course[$c_id])) {
                        $reg_items_by_course[$c_id] = array();
                    }
                    $reg_items_by_course[$c_id][$s_id] = $it;
                }
            }
        }

        // Count registrations per course
        foreach ($courses_map as $c_id => &$c_data) {
            $reg_cnt = isset($reg_items_by_course[$c_id]) ? count($reg_items_by_course[$c_id]) : 0;
            $c_data['registered_count'] = $reg_cnt;
            $c_data['unregistered_count'] = max(0, $cohort_count - $reg_cnt);
        }
        unset($c_data);

        $courses_list = array_values($courses_map);
        usort($courses_list, function($a, $b) {
            return strcmp($a['code'], $b['code']);
        });

        // 6. Determine selected course
        $selected_course = null;
        if ($course_id && isset($courses_map[$course_id])) {
            $selected_course = $courses_map[$course_id];
        } elseif (!empty($courses_list)) {
            $selected_course = $courses_list[0];
            $course_id = $selected_course['id'];
        }

        // 7. Check for recorded examination scores for the selected course
        $scores_by_student = array();
        $has_rb_acad_sess = $this->db->table_exists('result_batches') && $this->db->field_exists('academic_session_id', 'result_batches');
        if ($course_id && !empty($student_ids)) {
            foreach (array_chunk($student_ids, 500) as $s_chunk) {
                $this->db->select('ra.student_id, ra.total_score, ra.grade, ra.status as attempt_status, rb.status as batch_status');
                $this->db->from('result_attempts ra');
                $this->db->join('result_batches rb', 'rb.id = ra.batch_id');
                $this->db->where_in('ra.student_id', $s_chunk);
                $this->db->where('rb.course_id', $course_id);
                if (!empty($all_score_session_ids)) {
                    $this->db->group_start();
                    $this->db->where_in('rb.session_id', $all_score_session_ids);
                    if ($has_rb_acad_sess) {
                        $this->db->or_where_in('rb.academic_session_id', $all_score_session_ids);
                    }
                    $this->db->group_end();
                }
                $this->db->group_start();
                $this->db->where_in('rb.semester_id', $target_semester_ids);
                $this->db->or_where_in('rb.level', $target_semester_ids);
                $this->db->group_end();
                $this->db->where('ra.status', 'active');
                $scores = $this->db->get()->result_array();
                foreach ($scores as $sc) {
                    $scores_by_student[$sc['student_id']] = $sc;
                }
            }
        }

        // 8. Build student roster for the selected course
        $roster_students = array();
        $registered_count = 0;
        $unregistered_count = 0;
        $with_scores_count = 0;

        foreach ($students_rows as $st) {
            $s_id = $st['student_id'];
            $is_registered = ($course_id && isset($reg_items_by_course[$course_id][$s_id]));
            $item_info = $is_registered ? $reg_items_by_course[$course_id][$s_id] : null;
            $score_info = isset($scores_by_student[$s_id]) ? $scores_by_student[$s_id] : null;

            if ($is_registered) {
                $registered_count++;
            } else {
                $unregistered_count++;
            }
            if ($score_info && ($score_info['total_score'] !== null || !empty($score_info['grade']))) {
                $with_scores_count++;
            }

            $roster_students[] = array(
                'student_id'            => $s_id,
                'full_name'             => $st['full_name'],
                'email'                 => $st['email'],
                'matric_number'         => $st['matric_number'],
                'admission_number'      => $st['admission_number'],
                'entry_mode'            => $st['entry_mode'],
                'session_name'          => $st['session_name'],
                'academic_session_name' => $st['academic_session_name'] ?? null,
                'is_registered'         => $is_registered,
                'registration_type'     => $item_info ? $item_info['registration_type'] : null,
                'registration_id'       => $item_info ? $item_info['registration_id'] : null,
                'registration_item_id'  => $item_info ? $item_info['item_id'] : null,
                'has_score'             => ($score_info !== null && ($score_info['total_score'] !== null || !empty($score_info['grade']))),
                'score'                 => $score_info ? $score_info['total_score'] : null,
                'grade'                 => $score_info ? $score_info['grade'] : null,
            );
        }

        return $this->json_response(200, array(
            'status'          => 'success',
            'courses'         => $courses_list,
            'selected_course' => $selected_course,
            'students'        => $roster_students,
            'summary'         => array(
                'total_cohort_students'     => $cohort_count,
                'registered_count'          => $registered_count,
                'unregistered_count'        => $unregistered_count,
                'with_scores_count'         => $with_scores_count,
                'derived_academic_sessions' => array_keys($derived_academic_sessions),
                'contacts_student_counts'   => $contacts_student_counts,
            )
        ));
    }

    /**
     * Update Course Roster
     * Registers, unregisters, or toggles registration for one or more students in a specific course.
     * Includes score-guard verification to prevent accidental drops of students with recorded scores.
     */
    

    public function update_course_roster()
    {
        $user = $this->require_admin();
        $actor_id = isset($user['id']) ? $user['id'] : null;

        $this->load->model('Courses_model');
        $this->load->model('Course_registration_model');

        $input = json_decode($this->input->raw_input_stream, true);
        if (!$input) {
            $input = $this->input->post();
        }

        $session_id               = $input['session_id'] ?? null;
        $semester_id              = $input['semester_id'] ?? null;
        $programme_id             = $input['programme_id'] ?? null;
        $course_id                = $input['course_id'] ?? null;
        $action                   = $input['action'] ?? null; // 'register', 'unregister', or 'toggle'
        $student_ids              = $input['student_ids'] ?? array();
        $force_remove_with_scores = !empty($input['force_remove_with_scores']);
        $drop_reason              = trim((string)($input['reason'] ?? ''));

        if (!$session_id || !$semester_id || !$programme_id || !$course_id || !$action || empty($student_ids)) {
            return $this->json_response(400, array(
                'status'  => 'error',
                'message' => 'Missing required fields: session_id, semester_id, programme_id, course_id, action, and student_ids.'
            ));
        }

        if (!is_array($student_ids)) {
            $student_ids = array($student_ids);
        }
        $student_ids = array_values(array_unique(array_filter($student_ids)));
        sort($student_ids);

        // Resolve course
        $course = $this->db->get_where('courses', array('id' => $course_id), 1)->row_array();
        if (!$course) {
            return $this->json_response(404, array('status' => 'error', 'message' => 'Course not found.'));
        }

        // Resolve period via Period_resolver
        $this->load->library('Period_resolver');
        $period = $this->period_resolver->resolve($session_id, $semester_id);
        $target_session_ids     = $period['session_ids'];
        $resolved_session_uuid  = $period['session_id'];
        $target_semester_ids    = $period['semester_ids'];
        $resolved_semester_uuid = $period['semester_id'];
        $contact_num            = $period['contact_number'];
        $target_level           = $period['label'];

        // Pre-check schema metadata OUTSIDE any transaction
        $has_item_status     = $this->db->field_exists('status', 'course_registration_items');
        $has_dropped_at      = $this->db->field_exists('dropped_at', 'course_registration_items');
        $has_level           = $this->db->field_exists('level', 'course_registrations');
        $has_programme       = $this->db->field_exists('programme_id', 'course_registrations');
        $has_submitted       = $this->db->field_exists('submitted_at', 'course_registrations');
        $has_approved_at     = $this->db->field_exists('approved_at', 'course_registrations');
        $has_approved_by     = $this->db->field_exists('approved_by', 'course_registrations');
        $has_source          = $this->db->field_exists('source', 'course_registrations');
        $has_acad_sess_col   = $this->db->field_exists('academic_session_id', 'course_registrations');
        $has_entry_sess_col  = $this->db->field_exists('entry_session_id', 'course_registrations');
        $has_res_amendments  = $this->db->table_exists('result_amendments');
        $has_reg_amendments  = $this->db->table_exists('course_registration_amendments');
        $has_admissions      = $this->db->table_exists('admissions');
        $has_st_entry        = $this->db->field_exists('entry_mode', 'students');
        $has_st_entry_sess   = $this->db->field_exists('entry_session_id', 'students');
        $has_adm_entry       = $has_admissions && $this->db->field_exists('entry_mode', 'admissions');
        $has_adm_moe         = $has_admissions && $this->db->field_exists('mode_of_entry', 'admissions');
        $has_adm_level       = $has_admissions && $this->db->field_exists('level', 'admissions');
        $has_rb_acad_sess    = $this->db->table_exists('result_batches') && $this->db->field_exists('academic_session_id', 'result_batches');

        // 0. Resolve per-student Entry Session & Teaching Academic Session Envelope
        $student_env_map = array();
        $all_score_session_ids = $target_session_ids;
        $valid_student_ids = array();

        foreach (array_chunk($student_ids, 500) as $s_chunk) {
            $st_sel = 's.id, s.admission_id, s.session_name';
            if ($has_st_entry_sess) { $st_sel .= ', s.entry_session_id'; }
            if ($has_st_entry)      { $st_sel .= ', s.entry_mode'; }
            if ($has_admissions) {
                $st_sel .= ', ad.matric_number';
                if ($has_adm_entry) { $st_sel .= ', ad.entry_mode as adm_entry_mode'; }
                if ($has_adm_moe)   { $st_sel .= ', ad.mode_of_entry'; }
                if ($has_adm_level) { $st_sel .= ', ad.level as admission_level'; }
            }
            $this->db->select($st_sel, false);
            $this->db->from('students s');
            if ($has_admissions) {
                $this->db->join('admissions ad', 'ad.id = s.admission_id', 'left');
            }
            $this->db->where_in('s.id', $s_chunk);
            $st_rows = $this->db->get()->result_array();
            foreach ($st_rows as $sr) {
                $is_de = $this->is_direct_entry_student($sr);
                if ($contact_num === 1 && $is_de && $action === 'register') {
                    continue;
                }
                $env = $this->resolve_student_session_envelope($sr, 'all', $target_level ?: $semester_id, $session_id);
                $student_env_map[$sr['id']] = $env;
                $valid_student_ids[] = $sr['id'];
                if (!empty($env['academic_session_id'])) {
                    $all_score_session_ids[] = $env['academic_session_id'];
                }
                if (!empty($env['academic_session_name'])) {
                    $all_score_session_ids[] = $env['academic_session_name'];
                }
            }
        }
        $student_ids = array_values(array_unique($valid_student_ids));
        sort($student_ids);
        $all_score_session_ids = array_values(array_unique(array_filter($all_score_session_ids)));

        if (empty($student_ids)) {
            return $this->json_response(400, array(
                'status'  => 'error',
                'message' => 'No eligible students found for this Contact and Entry Mode.'
            ));
        }

        // 1. Fetch existing registration items (both active and dropped) for these students and this course
        $existing_items        = array(); // [student_id] => active item
        $inactive_items_by_reg = array(); // [registration_id] => dropped/inactive item
        $envelope_map          = array(); // [student_id] => envelope

        foreach (array_chunk($student_ids, 500) as $s_chunk) {
            $this->db->select('cri.id as item_id, cri.registration_id, cr.student_id, cr.session_id, cr.semester_id, cr.level' . ($has_item_status ? ', cri.status' : ''));
            $this->db->from('course_registration_items cri');
            $this->db->join('course_registrations cr', 'cr.id = cri.registration_id');
            $this->db->where_in('cr.student_id', $s_chunk);
            $this->db->where('cri.course_id', $course_id);
            $this->db->group_start();
            $this->db->where_in('cr.semester_id', $target_semester_ids);
            $this->db->or_where_in('cr.level', $target_semester_ids);
            $this->db->group_end();
            $this->db->where_in('cr.status', array('approved', 'submitted', 'draft'));
            $item_rows = $this->db->get()->result_array();

            foreach ($item_rows as $ir) {
                $sid = $ir['student_id'];
                $is_active = !$has_item_status || empty($ir['status']) || strtolower((string)$ir['status']) === 'active';
                if ($is_active) {
                    $existing_items[$sid] = $ir;
                } else {
                    $inactive_items_by_reg[$ir['registration_id']] = $ir;
                }
                if (!isset($envelope_map[$sid])) {
                    $envelope_map[$sid] = array(
                        'id'          => $ir['registration_id'],
                        'student_id'  => $sid,
                        'session_id'  => $ir['session_id'],
                        'semester_id' => $ir['semester_id'],
                        'level'       => $ir['level'],
                    );
                }
            }
        }

        // For any student who doesn't have an envelope mapped yet, find an existing envelope
        $missing_env_sids = array_values(array_diff($student_ids, array_keys($envelope_map)));
        if (!empty($missing_env_sids)) {
            foreach (array_chunk($missing_env_sids, 500) as $m_chunk) {
                $this->db->select('id, student_id, session_id, semester_id, level, status');
                $this->db->from('course_registrations');
                $this->db->where_in('student_id', $m_chunk);
                $this->db->group_start();
                $this->db->where_in('semester_id', $target_semester_ids);
                $this->db->or_where_in('level', $target_semester_ids);
                $this->db->group_end();
                $this->db->where_in('status', array('approved', 'submitted', 'draft'));
                $this->db->order_by('created_at', 'DESC');
                $other_envelopes = $this->db->get()->result_array();
                foreach ($other_envelopes as $oe) {
                    if (!isset($envelope_map[$oe['student_id']])) {
                        $envelope_map[$oe['student_id']] = $oe;
                    }
                }
            }
        }

        // Determine students to add vs students to remove
        $to_add = array();
        $to_remove = array();

        foreach ($student_ids as $sid) {
            $is_reg = isset($existing_items[$sid]);
            if ($action === 'register') {
                if (!$is_reg) $to_add[] = $sid;
            } elseif ($action === 'unregister') {
                if ($is_reg) $to_remove[] = $sid;
            } elseif ($action === 'toggle') {
                if ($is_reg) {
                    $to_remove[] = $sid;
                } else {
                    $to_add[] = $sid;
                }
            }
        }

        // 3. Safety Check: If unregistering, verify if students have recorded scores!
        $scores_with_students = array();
        if (!empty($to_remove)) {
            $raw_scores = array();
            foreach (array_chunk($to_remove, 500) as $rem_chunk) {
                $this->db->select('ra.id as attempt_id, ra.batch_id, ra.student_id, ra.total_score, ra.grade, ra.is_locked, rb.status as batch_status, u.full_name, ad.matric_number');
                $this->db->from('result_attempts ra');
                $this->db->join('result_batches rb', 'rb.id = ra.batch_id');
                $this->db->join('students s', 's.id = ra.student_id');
                $this->db->join('users u', 'u.id = s.user_id');
                $this->db->join('admissions ad', 'ad.id = s.admission_id', 'left');
                $this->db->where_in('ra.student_id', $rem_chunk);
                $this->db->where('rb.course_id', $course_id);
                if (!empty($all_score_session_ids)) {
                    $this->db->group_start();
                    $this->db->where_in('rb.session_id', $all_score_session_ids);
                    if ($has_rb_acad_sess) {
                        $this->db->or_where_in('rb.academic_session_id', $all_score_session_ids);
                    }
                    $this->db->group_end();
                }
                $this->db->group_start();
                $this->db->where_in('rb.semester_id', $target_semester_ids);
                $this->db->or_where_in('rb.level', $target_semester_ids);
                $this->db->group_end();
                $this->db->where('ra.status', 'active');
                $chunk_scores = $this->db->get()->result_array();
                foreach ($chunk_scores as $cs) {
                    $raw_scores[] = $cs;
                }
            }

            $scores_with_students = array_filter($raw_scores, function($sc) {
                return ($sc['total_score'] !== null || (!empty($sc['grade']) && !in_array($sc['grade'], array('-', 'â€”', ''))));
            });

            if (!empty($scores_with_students)) {
                $has_locked = false;
                $affected = array();
                foreach ($scores_with_students as $sws) {
                    $is_batch_locked = in_array($sws['batch_status'], array('approved', 'published'));
                    $is_attempt_locked = !empty($sws['is_locked']) || $is_batch_locked;
                    if ($is_attempt_locked) {
                        $has_locked = true;
                    }
                    $affected[] = array(
                        'student_id'    => $sws['student_id'],
                        'full_name'     => $sws['full_name'],
                        'matric_number' => $sws['matric_number'],
                        'score'         => $sws['total_score'],
                        'grade'         => $sws['grade'],
                        'is_locked'     => $is_attempt_locked ? 1 : 0
                    );
                }

                if ($has_locked && (!$force_remove_with_scores || empty($drop_reason))) {
                    return $this->json_response(409, array(
                        'status'            => 'warning',
                        'warning_type'      => 'has_locked_scores',
                        'message'           => count($affected) . ' student(s) have APPROVED or PUBLISHED examination results for ' . $course['code'] . '. Removing their registration requires explicit confirmation and a written reason.',
                        'affected_students' => $affected,
                        'requires_reason'   => true
                    ));
                }

                if (!$force_remove_with_scores) {
                    return $this->json_response(409, array(
                        'status'            => 'warning',
                        'warning_type'      => 'has_scores',
                        'message'           => count($affected) . ' student(s) already have recorded examination scores for course ' . $course['code'] . '. Removing their registration will prevent their scores from showing on the broadsheet. Please confirm if you wish to drop them anyway.',
                        'affected_students' => $affected,
                    ));
                }
            }
        }

        // 4. Bulk-resolve carryover status for $to_add OUTSIDE the transaction (1 query instead of N queries)
        $default_course_type = isset($course['type']) ? strtolower(trim((string)$course['type'])) : 'core';
        if (!in_array($default_course_type, array('core', 'elective'), true)) {
            $default_course_type = 'core';
        }
        $carryover_students_map = array();
        if (!empty($to_add) && $resolved_session_uuid && $resolved_semester_uuid && $this->db->table_exists('result_attempts')) {
            $this->load->model('Outstanding_course_model');
            $outstanding_for_course = $this->Outstanding_course_model->get_outstanding_students_for_course_before(
                $course_id,
                $resolved_session_uuid,
                $resolved_semester_uuid
            );
            if (is_array($outstanding_for_course)) {
                $carryover_students_map = $outstanding_for_course;
            }
        }

        // 5. Prepare all batch write payloads in memory BEFORE starting the transaction
        $now = date('Y-m-d H:i:s');
        $affected_registration_ids   = array();
        $audit_rows                  = array();
        $result_amendments_to_insert = array();
        $item_ids_to_drop            = array();
        $new_envelopes               = array();
        $items_to_reactivate         = array();
        $items_to_insert             = array();

        // 5a. Prepare REMOVALS (Soft-drop)
        if (!empty($to_remove)) {
            foreach ($to_remove as $sid) {
                if (isset($existing_items[$sid])) {
                    $reg_id  = $existing_items[$sid]['registration_id'];
                    $item_id = $existing_items[$sid]['item_id'];
                    $item_ids_to_drop[] = $item_id;
                    $affected_registration_ids[] = $reg_id;

                    $audit_rows[] = array(
                        'id'              => $this->Course_registration_model->generate_uuid(),
                        'registration_id' => $reg_id,
                        'actor_id'        => $actor_id,
                        'action_type'     => 'roster_drop',
                        'course_id'       => $course_id,
                        'reason'          => $drop_reason ?: ('Admin dropped student from course ' . $course['code']),
                        'created_at'      => $now,
                    );

                    if (!empty($scores_with_students) && $has_res_amendments) {
                        foreach ($scores_with_students as $sws) {
                            if ($sws['student_id'] === $sid) {
                                $result_amendments_to_insert[] = array(
                                    'id'         => $this->Course_registration_model->generate_uuid(),
                                    'attempt_id' => $sws['attempt_id'],
                                    'batch_id'   => $sws['batch_id'],
                                    'student_id' => $sid,
                                    'field'      => 'roster_drop',
                                    'old_value'  => 'registered',
                                    'new_value'  => 'dropped',
                                    'reason'     => $drop_reason ?: ('Admin dropped student with score (' . ($sws['grade'] ?: $sws['total_score']) . ') from roster for ' . $course['code']),
                                    'actor_id'   => $actor_id,
                                    'created_at' => $now
                                );
                            }
                        }
                    }
                }
            }
        }

        // 5b. Prepare ADDITIONS
        if (!empty($to_add)) {
            foreach ($to_add as $sid) {
                $st_env = isset($student_env_map[$sid]) ? $student_env_map[$sid] : null;
                $teaching_sess_uuid = ($st_env && !empty($st_env['academic_session_id'])) ? $st_env['academic_session_id'] : $resolved_session_uuid;
                $entry_sess_uuid    = ($st_env && !empty($st_env['entry_session_id'])) ? $st_env['entry_session_id'] : null;

                if (isset($envelope_map[$sid])) {
                    $reg_id = $envelope_map[$sid]['id'];
                } else {
                    $reg_id = $this->Course_registration_model->generate_uuid();
                    $reg_row = array(
                        'id'          => $reg_id,
                        'student_id'  => $sid,
                        'session_id'  => $teaching_sess_uuid,
                        'semester_id' => $resolved_semester_uuid,
                        'status'      => 'approved',
                        'created_at'  => $now,
                        'updated_at'  => $now,
                    );
                    if ($has_acad_sess_col)  { $reg_row['academic_session_id'] = $teaching_sess_uuid; }
                    if ($has_entry_sess_col) { $reg_row['entry_session_id']    = $entry_sess_uuid; }
                    if ($has_level)          { $reg_row['level']               = $target_level ?: $semester_id; }
                    if ($has_programme)      { $reg_row['programme_id']        = $programme_id; }
                    if ($has_submitted)      { $reg_row['submitted_at']        = $now; }
                    if ($has_approved_at)    { $reg_row['approved_at']         = $now; }
                    if ($has_approved_by)    { $reg_row['approved_by']         = $actor_id; }
                    if ($has_source)         { $reg_row['source']              = 'admin'; }
                    $new_envelopes[]    = $reg_row;
                    $envelope_map[$sid] = $reg_row;
                }

                $affected_registration_ids[] = $reg_id;
                $reg_type = isset($carryover_students_map[$sid]) ? 'carryover' : $default_course_type;

                if (isset($inactive_items_by_reg[$reg_id])) {
                    $upd = array(
                        'id'                => $inactive_items_by_reg[$reg_id]['item_id'],
                        'registration_type' => $reg_type,
                    );
                    if ($has_item_status) {
                        $upd['status'] = 'active';
                    }
                    if ($has_dropped_at) {
                        $upd['dropped_at']  = null;
                        $upd['dropped_by']  = null;
                        $upd['drop_reason'] = null;
                    }
                    $items_to_reactivate[] = $upd;
                } else {
                    $ins = array(
                        'id'                => $this->Course_registration_model->generate_uuid(),
                        'registration_id'   => $reg_id,
                        'course_id'         => $course_id,
                        'registration_type' => $reg_type,
                        'created_at'        => $now,
                    );
                    if ($has_item_status) {
                        $ins['status'] = 'active';
                    }
                    $items_to_insert[] = $ins;
                }

                $audit_rows[] = array(
                    'id'              => $this->Course_registration_model->generate_uuid(),
                    'registration_id' => $reg_id,
                    'actor_id'        => $actor_id,
                    'action_type'     => 'roster_add',
                    'course_id'       => $course_id,
                    'reason'          => 'Admin registered student for course ' . $course['code'] . ' via roster',
                    'created_at'      => $now,
                );
            }
        }

        // Deterministic lock ordering across all batch arrays to prevent InnoDB deadlocks
        sort($item_ids_to_drop);
        $affected_registration_ids = array_values(array_unique(array_filter($affected_registration_ids)));
        sort($affected_registration_ids);
        if (!empty($new_envelopes)) {
            usort($new_envelopes, function($a, $b) { return strcmp($a['id'], $b['id']); });
        }
        if (!empty($items_to_reactivate)) {
            usort($items_to_reactivate, function($a, $b) { return strcmp($a['id'], $b['id']); });
        }
        if (!empty($items_to_insert)) {
            usort($items_to_insert, function($a, $b) { return strcmp($a['id'], $b['id']); });
        }

        // 6. Execute fast batch writes in a transaction with automatic deadlock retry
        $max_tx_attempts = 3;
        $tx_attempt      = 0;
        $tx_succeeded    = false;
        $orig_db_debug   = $this->db->db_debug;

        while ($tx_attempt < $max_tx_attempts) {
            $tx_attempt++;
            $this->db->db_debug = ($tx_attempt < $max_tx_attempts) ? false : $orig_db_debug;

            $this->db->trans_start();

            // 6a. Insert new parent course_registrations envelopes FIRST
            if (!empty($new_envelopes)) {
                foreach (array_chunk($new_envelopes, 300) as $env_chunk) {
                    $this->db->insert_batch('course_registrations', $env_chunk);
                }
            }

            // 6b. Soft-drop removed items by primary key
            if (!empty($item_ids_to_drop)) {
                $drop_upd = array();
                if ($has_item_status) {
                    $drop_upd['status'] = 'dropped';
                }
                if ($has_dropped_at) {
                    $drop_upd['dropped_at']  = $now;
                    $drop_upd['dropped_by']  = $actor_id;
                    $drop_upd['drop_reason'] = $drop_reason ?: ('Admin dropped student from course roster: ' . $course['code']);
                }
                foreach (array_chunk($item_ids_to_drop, 500) as $drop_chunk) {
                    if (!empty($drop_upd)) {
                        $this->db->where_in('id', $drop_chunk);
                        $this->db->update('course_registration_items', $drop_upd);
                    } else {
                        $this->db->where_in('id', $drop_chunk);
                        $this->db->delete('course_registration_items');
                    }
                }
            }

            // 6c. Reactivate previously dropped items by primary key
            if (!empty($items_to_reactivate)) {
                foreach (array_chunk($items_to_reactivate, 300) as $react_chunk) {
                    $this->db->update_batch('course_registration_items', $react_chunk, 'id');
                }
            }

            // 6d. Batch-insert new course_registration_items
            if (!empty($items_to_insert)) {
                foreach (array_chunk($items_to_insert, 300) as $ins_chunk) {
                    $this->db->insert_batch('course_registration_items', $ins_chunk);
                }
            }

            // 6e. Batch-insert result_amendments if any
            if (!empty($result_amendments_to_insert) && $has_res_amendments) {
                foreach (array_chunk($result_amendments_to_insert, 300) as $ra_chunk) {
                    $this->db->insert_batch('result_amendments', $ra_chunk);
                }
            }

            // 6f. Batch-insert course_registration_amendments
            if (!empty($audit_rows) && $has_reg_amendments) {
                foreach (array_chunk($audit_rows, 300) as $audit_chunk) {
                    $this->db->insert_batch('course_registration_amendments', $audit_chunk);
                }
            }

            // 6g. Recalculate total credits for all affected envelopes in bulk
            if (!empty($affected_registration_ids)) {
                $this->registration_service->recalculate_credits($affected_registration_ids);
            }

            $this->db->trans_complete();
            $this->db->db_debug = $orig_db_debug;

            if ($this->db->trans_status() !== FALSE) {
                $tx_succeeded = true;
                break;
            }

            $db_err = $this->db->error();
            $err_code = isset($db_err['code']) ? (int)$db_err['code'] : 0;
            if ($tx_attempt < $max_tx_attempts && in_array($err_code, array(1213, 1205), true)) {
                usleep(mt_rand(40000, 150000) * $tx_attempt);
                continue;
            }
            break;
        }

        if (!$tx_succeeded) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Failed to update course roster. Transaction aborted.'));
        }

        $msg_parts = array();
        if (count($to_add) > 0) {
            $msg_parts[] = 'registered ' . count($to_add) . ' student(s)';
        }
        if (count($to_remove) > 0) {
            $msg_parts[] = 'dropped ' . count($to_remove) . ' student(s)';
        }
        $msg = 'Successfully ' . (!empty($msg_parts) ? implode(' and ', $msg_parts) : 'updated 0 students') . ' for ' . $course['code'] . '.';

        return $this->json_response(200, array(
            'status'        => 'success',
            'message'       => $msg,
            'added_count'   => count($to_add),
            'removed_count' => count($to_remove),
        ));
    }

    /**
     * Backfills Academic Session Envelopes and Entry Cohorts across
     * students, course_registrations, and result_batches.
     * Safe, idempotent, non-destructive.
     */
    public function backfill_academic_session_envelopes()
    {
        $this->require_admin();

        // Historical session values cannot be inferred safely from a web
        // request.  The previous implementation created a fixed set of
        // years and guessed mappings from levels, which could silently
        // reclassify academic history.  Keep the route as an explicit
        // retirement response for callers of the old endpoint rather than
        // allowing it to mutate data.
        return $this->json_response(410, array(
            'status' => 'error',
            'message' => 'The automated academic-session backfill has been retired. Run db/migrations/024_audit_academic_session_envelopes.sql in phpMyAdmin, review all exceptions, then apply only an approved reconciliation script.'
        ));

        /*
         * Retained below temporarily as a reference while historical data is
         * reconciled. Do not restore this code: it contains institution-
         * specific 2021-2027 assumptions and is intentionally unreachable.
         */
        $user = $this->require_admin();

        // 1. Ensure columns exist
        $this->Course_registration_model->ensure_registration_columns();
        if ($this->load->model('Results_model')) {
            $this->Results_model->ensure_results_columns();
        }

        // 2. Ensure canonical academic sessions exist
        $canonical_sessions = array(
            '2021/2022' => array('2021-10-01', '2022-09-30', 0),
            '2022/2023' => array('2022-10-01', '2023-09-30', 0),
            '2023/2024' => array('2023-10-01', '2024-09-30', 0),
            '2024/2025' => array('2024-10-01', '2025-09-30', 0),
            '2025/2026' => array('2025-10-01', '2026-09-30', 0),
            '2026/2027' => array('2026-10-01', '2027-09-30', 1),
        );

        $sessions_ensured = 0;
        foreach ($canonical_sessions as $s_name => $meta) {
            $existing = $this->db->get_where('academic_sessions', array('name' => $s_name), 1)->row_array();
            if (!$existing) {
                $this->db->insert('academic_sessions', array(
                    'id'         => $this->generate_uuid(),
                    'name'       => $s_name,
                    'start_date' => $meta[0],
                    'end_date'   => $meta[1],
                    'is_active'  => $meta[2],
                    'created_at' => date('Y-m-d H:i:s'),
                ));
                $sessions_ensured++;
            }
        }

        // 3. Backfill students.entry_session_id from session_name
        $sql_st = "UPDATE students s
                   INNER JOIN academic_sessions sess ON sess.name = TRIM(s.session_name)
                   SET s.entry_session_id = sess.id
                   WHERE s.entry_session_id IS NULL OR s.entry_session_id = ''";
        $this->db->query($sql_st);
        $st_updated = $this->db->affected_rows();

        // 4. Backfill course_registrations.entry_session_id from students.entry_session_id
        $sql_cr_entry = "UPDATE course_registrations cr
                         INNER JOIN students s ON s.id = cr.student_id
                         SET cr.entry_session_id = s.entry_session_id
                         WHERE s.entry_session_id IS NOT NULL AND s.entry_session_id != ''
                           AND (cr.entry_session_id IS NULL OR cr.entry_session_id = '')";
        $this->db->query($sql_cr_entry);
        $cr_entry_updated = $this->db->affected_rows();

        // Fallback for cr.entry_session_id using existing cr.session_id
        $sql_cr_entry_fallback = "UPDATE course_registrations cr
                                  INNER JOIN academic_sessions sess ON (sess.id = cr.session_id OR sess.name = cr.session_id)
                                  SET cr.entry_session_id = sess.id
                                  WHERE cr.entry_session_id IS NULL OR cr.entry_session_id = ''";
        $this->db->query($sql_cr_entry_fallback);

        // 5. Backfill course_registrations.academic_session_id deterministically
        $cr_academic_updated = 0;

        // Fresh mapping: 2021/2022 entry -> C1=2021/2022, C2=2022/2023, C3=2023/2024, C4=2024/2025, C5=2025/2026, C6=2026/2027
        $fresh_map = array(
            'Contact 1' => '2021/2022',
            'Contact 2' => '2022/2023',
            'Contact 3' => '2023/2024',
            'Contact 4' => '2024/2025',
            'Contact 5' => '2025/2026',
            'Contact 6' => '2026/2027',
        );

        foreach ($fresh_map as $contact_name => $target_session_name) {
            $sess_row = $this->db->get_where('academic_sessions', array('name' => $target_session_name), 1)->row_array();
            if ($sess_row) {
                $target_id = $sess_row['id'];
                $sql = "UPDATE course_registrations cr
                        INNER JOIN students s ON s.id = cr.student_id
                        INNER JOIN academic_sessions sess_entry ON sess_entry.id = cr.entry_session_id AND sess_entry.name = '2021/2022'
                        SET cr.academic_session_id = ?
                        WHERE (s.entry_mode IS NULL OR (s.entry_mode NOT LIKE '%Direct%' AND s.entry_mode != 'de'))
                          AND (cr.level = ? OR cr.level = ? OR cr.semester_id IN (
                              SELECT id FROM semesters WHERE name = ?
                          ))
                          AND (cr.academic_session_id IS NULL OR cr.academic_session_id = '')";
                $c_num = preg_replace('/[^0-9]/', '', $contact_name);
                $this->db->query($sql, array($target_id, $contact_name, $c_num, $contact_name));
                $cr_academic_updated += $this->db->affected_rows();
            }
        }

        // Direct Entry mapping: 2021/2022 entry -> C2=2021/2022, C3=2022/2023, C4=2023/2024, C5=2024/2025, C6=2025/2026
        $de_map = array(
            'Contact 2' => '2021/2022',
            'Contact 3' => '2022/2023',
            'Contact 4' => '2023/2024',
            'Contact 5' => '2024/2025',
            'Contact 6' => '2025/2026',
        );

        foreach ($de_map as $contact_name => $target_session_name) {
            $sess_row = $this->db->get_where('academic_sessions', array('name' => $target_session_name), 1)->row_array();
            if ($sess_row) {
                $target_id = $sess_row['id'];
                $sql = "UPDATE course_registrations cr
                        INNER JOIN students s ON s.id = cr.student_id
                        INNER JOIN academic_sessions sess_entry ON sess_entry.id = cr.entry_session_id AND sess_entry.name = '2021/2022'
                        SET cr.academic_session_id = ?
                        WHERE (s.entry_mode LIKE '%Direct%' OR s.entry_mode = 'de')
                          AND (cr.level = ? OR cr.level = ? OR cr.semester_id IN (
                              SELECT id FROM semesters WHERE name = ?
                          ))
                          AND (cr.academic_session_id IS NULL OR cr.academic_session_id = '')";
                $c_num = preg_replace('/[^0-9]/', '', $contact_name);
                $this->db->query($sql, array($target_id, $contact_name, $c_num, $contact_name));
                $cr_academic_updated += $this->db->affected_rows();
            }
        }

        // Fallback for any unmapped registrations: keep cr.session_id
        $this->db->query("UPDATE course_registrations cr SET cr.academic_session_id = cr.session_id WHERE cr.academic_session_id IS NULL OR cr.academic_session_id = ''");

        // 6. Backfill result_batches
        // 6A. Backfill cohort_session_id
        $this->db->query("UPDATE result_batches rb SET rb.cohort_session_id = rb.session_id WHERE rb.cohort_session_id IS NULL OR rb.cohort_session_id = ''");
        $rb_cohort_updated = $this->db->affected_rows();

        // 6B. Correlate result_batches.academic_session_id from matching course registrations
        $sql_rb = "UPDATE result_batches rb
                   INNER JOIN (
                       SELECT cri.course_id, cr.semester_id, cr.academic_session_id
                       FROM course_registrations cr
                       JOIN course_registration_items cri ON cri.registration_id = cr.id
                       WHERE cr.academic_session_id IS NOT NULL AND cr.academic_session_id != ''
                       GROUP BY cri.course_id, cr.semester_id, cr.academic_session_id
                   ) reg_match ON reg_match.course_id = rb.course_id AND reg_match.semester_id = rb.semester_id
                   SET rb.academic_session_id = reg_match.academic_session_id
                   WHERE rb.academic_session_id IS NULL OR rb.academic_session_id = ''";
        $this->db->query($sql_rb);
        $rb_academic_updated = $this->db->affected_rows();

        // Fallback for standalone batches
        $this->db->query("UPDATE result_batches rb SET rb.academic_session_id = rb.session_id WHERE rb.academic_session_id IS NULL OR rb.academic_session_id = ''");

        return $this->json_response(200, array(
            'status'  => 'success',
            'message' => 'Academic session envelope backfill completed successfully.',
            'data'    => array(
                'sessions_ensured'               => $sessions_ensured,
                'students_updated'               => $st_updated,
                'course_reg_entry_updated'       => $cr_entry_updated,
                'course_reg_academic_updated'    => $cr_academic_updated,
                'result_batches_cohort_updated'  => $rb_cohort_updated,
                'result_batches_academic_updated'=> $rb_academic_updated,
            ),
        ));
    }
}

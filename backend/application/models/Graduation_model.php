<?php
defined('BASEPATH') or exit('No direct script access allowed');

/**
 * Graduation_model
 * Implements NUC BMAS and CCMAS Graduation Clearance, Senate List Generation,
 * Deficiency Audit, and Institutional Document Formatting.
 */
class Graduation_model extends CI_Model
{
    protected $_config_cache = null;

    public function __construct()
    {
        parent::__construct();
        $this->load->database();
        if (!$this->load->is_loaded('academic_policy')) {
            $this->load->library('academic_policy');
        }
        if (!$this->load->is_loaded('academic_calculator')) {
            $this->load->library('academic_calculator');
        }
    }

    /**
     * Default graduation configuration values
     */
    public function default_config()
    {
        return [
            'framework'                 => 'CCMAS', // 'CCMAS' or 'BMAS'
            'min_cgpa_ccmas'            => '1.50',
            'min_cgpa_bmas'             => '1.00',
            'min_tce_utme'              => '120',
            'min_tce_de'                => '90',
            'final_contact'             => 'all',   // 'all', 'Contact 4', 'Contact 6', '400', '600'
            'strict_zero_carryovers'    => '1',     // 1 = cannot graduate with any unpassed course attempt
            'strict_zero_pending'       => '1',     // 1 = cannot graduate with any unrecorded/NR score
            'require_fee_clearance'     => '0',     // 0 = disabled, 1 = verified fee clearance
            'institution_name'          => 'FEDERAL UNIVERSITY DUTSIN-MA',
            'institution_address'       => 'P.M.B. 5001 KATSINA STATE',
            'affiliate_name'            => 'MASLAHA COMMUNITY COLLEGE OF EDUCATION, FUNTUA',
            'faculty_name'              => 'FACULTY OF EDUCATION',
            'signatory_hod'             => 'Name of H.O.D',
            'signatory_dean'            => 'Name of Dean',
            'signatory_vc'              => 'Name of Vice Chancellor',
        ];
    }

    /**
     * Helper to build a deterministic override key that fits strictly within VARCHAR(50)
     */
    private function _build_override_key($session_id, $programme_id = null)
    {
        if (empty($session_id)) {
            return null;
        }
        $raw = trim($session_id) . '_' . (!empty($programme_id) ? trim($programme_id) : 'all');
        // 'grad_ovr_' is 9 chars + 32-char md5 hash = 41 chars, strictly <= 50 chars
        return 'grad_ovr_' . md5($raw);
    }

    /**
     * Retrieves graduation settings merged with defaults
     */
    public function get_config($session_id = null, $programme_id = null)
    {
        $defaults = $this->default_config();
        $settings = [];

        if ($this->db->table_exists('academic_settings')) {
            // First load global graduation keys (ignoring override hashes/prefixes)
            $rows = $this->db->like('setting_key', 'grad_', 'after')->get('academic_settings')->result_array();
            foreach ($rows as $r) {
                if (strpos($r['setting_key'], 'grad_override_') === 0 || strpos($r['setting_key'], 'grad_ovr_') === 0) {
                    continue;
                }
                $clean_key = preg_replace('/^grad_/', '', $r['setting_key']);
                $settings[$clean_key] = $r['setting_value'];
            }

            // Check if cohort/session specific override exists
            if (!empty($session_id)) {
                $candidates = [
                    $this->_build_override_key($session_id, $programme_id),
                ];
                if (!empty($programme_id)) {
                    $candidates[] = $this->_build_override_key($session_id, null);
                }
                // Legacy fallback candidates
                $legacy_key = 'grad_override_' . preg_replace('/[^a-zA-Z0-9_]/', '_', $session_id);
                if ($programme_id) {
                    $legacy_key .= '_' . preg_replace('/[^a-zA-Z0-9_]/', '_', $programme_id);
                }
                $candidates[] = substr($legacy_key, 0, 50);
                $candidates[] = $legacy_key;
                if ($programme_id) {
                    $legacy_sess = 'grad_override_' . preg_replace('/[^a-zA-Z0-9_]/', '_', $session_id);
                    $candidates[] = substr($legacy_sess, 0, 50);
                    $candidates[] = $legacy_sess;
                }

                foreach (array_unique($candidates) as $cand_key) {
                    if (!$cand_key) continue;
                    $spec_row = $this->db->get_where('academic_settings', ['setting_key' => $cand_key])->row_array();
                    if ($spec_row && !empty($spec_row['setting_value'])) {
                        $decoded = json_decode($spec_row['setting_value'], true);
                        if (is_array($decoded)) {
                            $settings = array_merge($settings, $decoded);
                            break;
                        }
                    }
                }
            }
        }

        $merged = array_merge($defaults, $settings);
        return $merged;
    }

    /**
     * Persists graduation configuration
     */
    public function save_config($data, $session_id = null, $programme_id = null, $user_id = null)
    {
        if (!$this->db->table_exists('academic_settings')) {
            return false;
        }

        $now = date('Y-m-d H:i:s');
        $session_id = !empty($session_id) && $session_id !== 'null' ? trim($session_id) : null;
        $programme_id = !empty($programme_id) && $programme_id !== 'null' ? trim($programme_id) : null;

        // Cohort/Session-specific override
        if ($session_id) {
            $override_key = $this->_build_override_key($session_id, $programme_id);
            $val = json_encode($data);

            // Clean up any old truncated legacy key that might conflict or sit orphaned
            $legacy_prefix = substr('grad_override_' . preg_replace('/[^a-zA-Z0-9_]/', '_', $session_id), 0, 50);
            $this->db->where('setting_key', $legacy_prefix)->delete('academic_settings');

            $existing = $this->db->get_where('academic_settings', ['setting_key' => $override_key])->row_array();
            if ($existing) {
                $this->db->where('id', $existing['id'])->update('academic_settings', [
                    'setting_value' => $val,
                    'updated_at'    => $now,
                    'updated_by'    => $user_id,
                ]);
            } else {
                $sql = "INSERT INTO `academic_settings` (`id`, `setting_key`, `setting_value`, `updated_at`, `updated_by`)
                        VALUES (?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE
                        `setting_value` = VALUES(`setting_value`),
                        `updated_at` = VALUES(`updated_at`),
                        `updated_by` = VALUES(`updated_by`)";
                $this->db->query($sql, [
                    $this->_generate_uuid(),
                    $override_key,
                    $val,
                    $now,
                    $user_id,
                ]);
            }
            return true;
        }

        // Global graduation keys
        foreach ($data as $key => $val) {
            $setting_key = 'grad_' . $key;
            if (is_array($val) || is_object($val)) {
                $val = json_encode($val);
            }
            if (strlen($setting_key) > 50) {
                $setting_key = substr($setting_key, 0, 50);
            }
            $existing = $this->db->get_where('academic_settings', ['setting_key' => $setting_key])->row_array();
            if ($existing) {
                $this->db->where('id', $existing['id'])->update('academic_settings', [
                    'setting_value' => (string)$val,
                    'updated_at'    => $now,
                    'updated_by'    => $user_id,
                ]);
            } else {
                $sql = "INSERT INTO `academic_settings` (`id`, `setting_key`, `setting_value`, `updated_at`, `updated_by`)
                        VALUES (?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE
                        `setting_value` = VALUES(`setting_value`),
                        `updated_at` = VALUES(`updated_at`),
                        `updated_by` = VALUES(`updated_by`)";
                $this->db->query($sql, [
                    $this->_generate_uuid(),
                    $setting_key,
                    (string)$val,
                    $now,
                    $user_id,
                ]);
            }
        }

        return true;
    }

    /**
     * Audits and evaluates the entire cohort for graduation clearance.
     *
     * @param array $filters Options: session_id, programme_id, framework, cohort, entry_mode, etc.
     * @return array Contains graduating_students (cleared), ineligible_students, summary_stats, config
     */
    public function audit_cohort_graduation($filters = [])
    {
        $session_id   = $filters['session_id'] ?? null;
        $programme_id = $filters['programme_id'] ?? null;
        $cohort_filter= $filters['cohort'] ?? null;
        $entry_mode_f = strtolower(trim((string)($filters['entry_mode'] ?? 'all')));
        $search       = trim((string)($filters['search'] ?? ''));

        // Load active configuration
        $config = $this->get_config($session_id, $programme_id);

        // Allow runtime overrides from request if explicitly passed
        if (!empty($filters['framework'])) {
            $config['framework'] = strtoupper(trim($filters['framework']));
        }
        if (isset($filters['min_cgpa']) && is_numeric($filters['min_cgpa'])) {
            if ($config['framework'] === 'CCMAS') {
                $config['min_cgpa_ccmas'] = (string)$filters['min_cgpa'];
            } else {
                $config['min_cgpa_bmas'] = (string)$filters['min_cgpa'];
            }
        }
        if (isset($filters['min_tce_utme']) && is_numeric($filters['min_tce_utme'])) {
            $config['min_tce_utme'] = (string)$filters['min_tce_utme'];
        }
        if (isset($filters['min_tce_de']) && is_numeric($filters['min_tce_de'])) {
            $config['min_tce_de'] = (string)$filters['min_tce_de'];
        }
        if (isset($filters['final_contact'])) {
            $config['final_contact'] = trim($filters['final_contact']);
        }
        if (isset($filters['strict_zero_carryovers'])) {
            $config['strict_zero_carryovers'] = $filters['strict_zero_carryovers'] ? '1' : '0';
        }
        if (isset($filters['strict_zero_pending'])) {
            $config['strict_zero_pending'] = $filters['strict_zero_pending'] ? '1' : '0';
        }

        $min_cgpa = ($config['framework'] === 'BMAS')
            ? (float)($config['min_cgpa_bmas'] ?? 1.00)
            : (float)($config['min_cgpa_ccmas'] ?? 1.50);

        $min_tce_utme = (int)($config['min_tce_utme'] ?? 120);
        $min_tce_de   = (int)($config['min_tce_de'] ?? 90);

        // 1. Fetch Students
        $students = $this->_fetch_candidates($session_id, $programme_id, $cohort_filter);
        if (empty($students)) {
            return [
                'graduating_students' => [],
                'ineligible_students' => [],
                'summary_stats'       => $this->_empty_summary_stats(),
                'config'              => $config,
                'metadata'            => $this->_fetch_metadata($session_id, $programme_id),
            ];
        }

        $student_ids = array_column($students, 'student_id');

        // 2. Fetch Attempts, Carryover Corrections & Course Registrations for all candidates
        $attempts_by_student   = $this->_fetch_all_attempts_for_students($student_ids);
        $corrections_by_student= $this->_fetch_all_corrections_for_students($student_ids);
        $registrations_by_stud = $this->_fetch_all_registrations_for_students($student_ids);

        $graduating_students = [];
        $ineligible_students = [];

        $class_counts = [
            'First Class Honours'                      => 0,
            'Second Class Honours (Upper Division)'    => 0,
            'Second Class Honours (Lower Division)'    => 0,
            'Third Class Honours'                      => 0,
            'Pass Degree'                              => 0,
        ];

        $deficiency_counts = [
            'outstanding' => 0,
            'pending'     => 0,
            'tce'         => 0,
            'cgpa'        => 0,
            'level'       => 0,
            'finance'     => 0,
        ];

        foreach ($students as $student) {
            $sid = $student['student_id'];

            // Determine Entry Mode & Entry Level
            $is_de = $this->_is_direct_entry($student);
            $canonical_entry_mode = $is_de ? 'DE' : 'UTME';
            $canonical_entry_level= $is_de ? '200' : '100';

            // Filter by entry mode if requested
            if ($entry_mode_f !== 'all') {
                if ($entry_mode_f === 'de' || $entry_mode_f === 'direct_entry') {
                    if (!$is_de) continue;
                } else if ($entry_mode_f === 'utme') {
                    if ($is_de) continue;
                }
            }

            // Search filter
            if ($search !== '') {
                $search_blob = strtolower($student['full_name'] . ' ' . ($student['matric_number'] ?? '') . ' ' . ($student['jamb_reg_no'] ?? ''));
                if (strpos($search_blob, strtolower($search)) === false) {
                    continue;
                }
            }

            $raw_attempts = $attempts_by_student[$sid] ?? [];
            $corrections  = $corrections_by_student[$sid] ?? [];
            $registered   = $registrations_by_stud[$sid] ?? [];

            // Merge historical attempts and carryover corrections
            $all_attempts = $this->_merge_attempts_and_corrections($raw_attempts, $corrections);

            // Group attempts by course code to determine course-level resolution
            $courses_evaluation = $this->_evaluate_student_courses($all_attempts, $registered, $is_de);
            $outstanding_courses = $courses_evaluation['outstanding']; // unresolved failures
            $pending_courses     = $courses_evaluation['pending'];     // unrecorded/NR courses
            $passed_courses      = $courses_evaluation['passed'];      // passed courses

            // Calculate career metrics (TCR, TCE, TQP, CGPA) using academic calculator
            $metrics = $this->_calculate_career_metrics($all_attempts);
            $tcr  = $metrics['registered_credits'];
            $tce  = $metrics['earned_credits'];
            $tqp  = $metrics['quality_points'];
            $cgpa = $metrics['cgpa'];

            // Expected TCE and CGPA
            $req_min_tce = $is_de ? $min_tce_de : $min_tce_utme;
            $req_min_cgpa = $min_cgpa;

            // Audit Criteria / Deficiencies
            $deficiencies = [];

            // 1. Strict Zero Outstanding Carryovers
            if ($config['strict_zero_carryovers'] === '1' && !empty($outstanding_courses)) {
                $deficiencies[] = [
                    'category' => 'outstanding',
                    'title'    => 'Unresolved Failed Courses',
                    'message'  => 'Outstanding carryover(s): ' . implode(', ', array_unique($outstanding_courses)),
                    'courses'  => array_values(array_unique($outstanding_courses)),
                ];
                $deficiency_counts['outstanding']++;
            }

            // 2. Strict Zero Pending/Unrecorded Results
            if ($config['strict_zero_pending'] === '1' && !empty($pending_courses)) {
                $deficiencies[] = [
                    'category' => 'pending',
                    'title'    => 'Incomplete / Pending Results',
                    'message'  => 'Missing or unrecorded result(s): ' . implode(', ', array_unique($pending_courses)),
                    'courses'  => array_values(array_unique($pending_courses)),
                ];
                $deficiency_counts['pending']++;
            }

            // 3. Minimum TCE Threshold
            if ($tce < $req_min_tce) {
                $deficit = $req_min_tce - $tce;
                $deficiencies[] = [
                    'category' => 'tce',
                    'title'    => 'Earned Credit Units Deficiency',
                    'message'  => "Earned {$tce} credit units, minimum required for {$canonical_entry_mode} is {$req_min_tce} units (deficit: {$deficit} units)",
                    'earned'   => $tce,
                    'required' => $req_min_tce,
                    'deficit'  => $deficit,
                ];
                $deficiency_counts['tce']++;
            }

            // 4. Minimum CGPA Threshold
            if ($cgpa < $req_min_cgpa) {
                $deficiencies[] = [
                    'category' => 'cgpa',
                    'title'    => 'CGPA Below Graduation Minimum',
                    'message'  => "Cumulative GPA ({$cgpa}) is below the required {$config['framework']} threshold of " . number_format($req_min_cgpa, 2),
                    'cgpa'     => $cgpa,
                    'required' => $req_min_cgpa,
                ];
                $deficiency_counts['cgpa']++;
            }

            // 5. Terminal Level / Contact Check (if configured)
            if ($config['final_contact'] !== 'all' && $config['final_contact'] !== '') {
                $has_reached_final = $this->_check_terminal_contact_reached($student, $all_attempts, $config['final_contact']);
                if (!$has_reached_final) {
                    $deficiencies[] = [
                        'category' => 'level',
                        'title'    => 'Terminal Contact Not Completed',
                        'message'  => "Has not completed final graduation contact/level: {$config['final_contact']}",
                    ];
                    $deficiency_counts['level']++;
                }
            }

            // 6. Fee Clearance (if required)
            if ($config['require_fee_clearance'] === '1') {
                $has_fee_clearance = $this->_check_fee_clearance($student);
                if (!$has_fee_clearance) {
                    $deficiencies[] = [
                        'category' => 'finance',
                        'title'    => 'Outstanding Financial Balance',
                        'message'  => 'School fees / graduation charges not fully cleared',
                    ];
                    $deficiency_counts['finance']++;
                }
            }

            // Format formatted demographic fields
            $formatted_name = $this->_format_name_pdf($student['full_name']);
            $formatted_dob  = $this->_format_dob_pdf($student['dob'] ?? null);
            $formatted_origin = $this->_format_origin_pdf($student['state'] ?? null);
            $formatted_jamb   = $this->_resolve_jamb_number($student);
            $year_admitted    = $this->_resolve_year_admitted($student);
            $current_level    = $this->_resolve_current_level($student, $all_attempts);

            // Determine Degree Classification based on Framework
            $degree_class = $this->_resolve_degree_class($cgpa, $config['framework']);

            if (empty($deficiencies)) {
                // CLEARED STUDENT
                if (isset($class_counts[$degree_class])) {
                    $class_counts[$degree_class]++;
                }

                $graduating_students[] = [
                    'sn'            => count($graduating_students) + 1,
                    'student_id'    => $sid,
                    'matric_number' => $student['matric_number'] ?? ($student['admission_number'] ?? 'N/A'),
                    'names'         => $formatted_name,
                    'gender'        => $this->_format_gender_pdf($student['gender'] ?? null),
                    'jamb_reg_no'   => $formatted_jamb,
                    'dob'           => $formatted_dob,
                    'origin'        => $formatted_origin,
                    'current_level' => $current_level,
                    'entry_level'   => $canonical_entry_level,
                    'entry_mode'    => $canonical_entry_mode,
                    'year_admitted' => $year_admitted,
                    'tce'           => $tce,
                    'tcr'           => $tcr,
                    'tqp'           => $tqp,
                    'cgpa'          => number_format($cgpa, 2, '.', ''),
                    'class'         => $degree_class,
                    'remark'        => 'Pass',
                ];
            } else {
                // INELIGIBLE / DEFICIENT STUDENT
                $ineligible_students[] = [
                    'sn'            => count($ineligible_students) + 1,
                    'student_id'    => $sid,
                    'matric_number' => $student['matric_number'] ?? ($student['admission_number'] ?? 'N/A'),
                    'names'         => $formatted_name,
                    'gender'        => $this->_format_gender_pdf($student['gender'] ?? null),
                    'jamb_reg_no'   => $formatted_jamb,
                    'dob'           => $formatted_dob,
                    'origin'        => $formatted_origin,
                    'current_level' => $current_level,
                    'entry_level'   => $canonical_entry_level,
                    'entry_mode'    => $canonical_entry_mode,
                    'year_admitted' => $year_admitted,
                    'tce'           => $tce,
                    'tcr'           => $tcr,
                    'tqp'           => $tqp,
                    'cgpa'          => number_format($cgpa, 2, '.', ''),
                    'degree_class'  => $degree_class,
                    'deficiencies'  => $deficiencies,
                    'outstanding_courses' => array_values(array_unique($outstanding_courses)),
                    'pending_courses'     => array_values(array_unique($pending_courses)),
                ];
            }
        }

        // Sort graduating students alphabetically by Matric No / Names matching university standard
        usort($graduating_students, function($a, $b) {
            $m = strcmp($a['matric_number'], $b['matric_number']);
            if ($m !== 0) return $m;
            return strcmp($a['names'], $b['names']);
        });
        // Re-index S/N
        foreach ($graduating_students as $idx => &$gs) {
            $gs['sn'] = $idx + 1;
        }
        unset($gs);

        // Sort ineligible students by number of deficiencies DESC, then Matric
        usort($ineligible_students, function($a, $b) {
            $cnt_a = count($a['deficiencies']);
            $cnt_b = count($b['deficiencies']);
            if ($cnt_a !== $cnt_b) return $cnt_b - $cnt_a;
            return strcmp($a['matric_number'], $b['matric_number']);
        });
        foreach ($ineligible_students as $idx => &$is) {
            $is['sn'] = $idx + 1;
        }
        unset($is);

        $total_audited = count($students);
        $total_cleared = count($graduating_students);
        $total_ineligible = count($ineligible_students);

        $summary_stats = [
            'total_audited'     => $total_audited,
            'cleared_count'     => $total_cleared,
            'cleared_percent'   => $total_audited > 0 ? round(($total_cleared / $total_audited) * 100, 1) : 0,
            'ineligible_count'  => $total_ineligible,
            'ineligible_percent'=> $total_audited > 0 ? round(($total_ineligible / $total_audited) * 100, 1) : 0,
            'class_breakdown'   => $class_counts,
            'deficiency_breakdown' => $deficiency_counts,
        ];

        return [
            'graduating_students' => $graduating_students,
            'ineligible_students' => $ineligible_students,
            'summary_stats'       => $summary_stats,
            'config'              => $config,
            'metadata'            => $this->_fetch_metadata($session_id, $programme_id),
        ];
    }

    /**
     * Single student clearance audit with full course-by-course breakdown
     */
    public function audit_single_student($student_id, $session_id = null)
    {
        $this->db->select('s.*, u.full_name, u.gender, u.dob, u.state, u.lga, u.email, u.phone, p.name as programme_name, p.code as programme_code, d.name as department_name');
        if ($this->db->table_exists('admissions')) {
            $this->db->select('adm.matric_number, adm.admission_number, adm.level as admission_level, adm.mode_of_entry as admission_mode_of_entry, adm.session_id as admission_session_id');
            $this->db->join('admissions adm', 'adm.id = s.admission_id', 'left');
        }
        if ($this->db->table_exists('application_jamb')) {
            $this->db->select('aj.jamb_number, aj.jamb_score');
            $this->db->join('application_jamb aj', 'aj.application_id = adm.application_id', 'left');
        }
        $this->db->join('users u', 'u.id = s.user_id', 'left');
        $this->db->join('programmes p', 'p.id = s.programme_id', 'left');
        $this->db->join('departments d', 'd.id = s.department_id', 'left');
        $this->db->where('s.id', $student_id);
        $student = $this->db->get('students s')->row_array();

        if (!$student) {
            return null;
        }

        $config = $this->get_config($session_id, $student['programme_id']);
        $raw_attempts = $this->_fetch_all_attempts_for_students([$student_id])[$student_id] ?? [];
        $corrections  = $this->_fetch_all_corrections_for_students([$student_id])[$student_id] ?? [];
        $registered   = $this->_fetch_all_registrations_for_students([$student_id])[$student_id] ?? [];

        $all_attempts = $this->_merge_attempts_and_corrections($raw_attempts, $corrections);
        $is_de = $this->_is_direct_entry($student);
        $courses_eval = $this->_evaluate_student_courses($all_attempts, $registered, $is_de);
        $metrics = $this->_calculate_career_metrics($all_attempts);

        $degree_class = $this->_resolve_degree_class($metrics['cgpa'], $config['framework']);

        return [
            'student'           => $student,
            'is_direct_entry'   => $is_de,
            'config'            => $config,
            'metrics'           => $metrics,
            'degree_class'      => $degree_class,
            'courses_eval'      => $courses_eval,
            'all_attempts'      => $all_attempts,
        ];
    }

    // -------------------------------------------------------------------------
    // Private Query & Evaluation Helpers
    // -------------------------------------------------------------------------

    private function _fetch_candidates($session_id, $programme_id, $cohort = null)
    {
        $this->db->select('s.id as student_id, s.user_id, s.programme_id, s.department_id, s.current_level, s.entry_mode, s.session_name, s.entry_session_id, s.created_at');
        $this->db->select('u.full_name, u.gender, u.dob, u.state, u.lga, u.email, u.phone');

        $hasAdmissions = $this->db->table_exists('admissions');
        if ($hasAdmissions) {
            $this->db->select('adm.matric_number, adm.admission_number, adm.level as admission_level, adm.mode_of_entry as admission_mode_of_entry, adm.session_id as admission_session_id');
        }

        $hasJamb = $this->db->table_exists('application_jamb');
        if ($hasJamb) {
            $this->db->select('aj.jamb_number');
        }

        $this->db->from('students s');
        $this->db->join('users u', 'u.id = s.user_id', 'inner');
        if ($hasAdmissions) {
            $this->db->join('admissions adm', 'adm.id = s.admission_id', 'left');
            if ($hasJamb) {
                $this->db->join('application_jamb aj', 'aj.application_id = adm.application_id', 'left');
            }
        }

        if ($programme_id && $programme_id !== 'all') {
            $this->db->where('s.programme_id', $programme_id);
        }

        // Exclude completely inactive or dropped students if status exists
        if ($this->db->field_exists('status', 'students')) {
            $this->db->where_not_in('s.status', ['withdrawn', 'expelled', 'suspended']);
        }

        // Cohort filter
        if ($cohort && strtolower($cohort) !== 'all') {
            $this->db->group_start();
            $this->db->where('s.session_name', $cohort);
            $this->db->or_like('s.session_name', $cohort);
            if ($this->db->field_exists('entry_session_id', 'students')) {
                $this->db->or_where('s.entry_session_id', $cohort);
            }
            $this->db->group_end();
        }

        $this->db->order_by('adm.matric_number', 'ASC');
        $this->db->order_by('u.full_name', 'ASC');
        return $this->db->get()->result_array();
    }

    private function _fetch_all_attempts_for_students(array $student_ids)
    {
        if (empty($student_ids)) return [];

        $this->db->select('a.id, a.student_id, a.total_score, a.grade, a.grade_point, a.quality_point, a.status as attempt_status');
        $this->db->select('b.course_id, c.code as course_code, c.title as course_title, c.credit_units');
        $this->db->select('b.session_id, sess.name as session_name, b.semester_id, sem.name as semester_name, b.level, b.status as batch_status, sess.start_date');
        $this->db->from('result_attempts a');
        $this->db->join('result_batches b', 'b.id = a.batch_id');
        $this->db->join('courses c', 'c.id = b.course_id');
        $this->db->join('academic_sessions sess', 'sess.id = b.session_id', 'left');
        $this->db->join('semesters sem', 'sem.id = b.semester_id', 'left');
        $this->db->where_in('a.student_id', $student_ids);
        $this->db->where('a.status', 'active');
        $this->db->where_in('b.status', ['published', 'approved']);
        $this->db->order_by('sess.start_date', 'ASC');
        $this->db->order_by('sess.name', 'ASC');
        $this->db->order_by('sem.name', 'ASC');
        $this->db->order_by('a.created_at', 'ASC');

        $rows = $this->db->get()->result_array();
        $by_student = [];
        foreach ($rows as $r) {
            $by_student[$r['student_id']][] = $r;
        }
        return $by_student;
    }

    private function _fetch_all_corrections_for_students(array $student_ids)
    {
        if (empty($student_ids) || !$this->db->table_exists('carryover_corrections')) {
            return [];
        }

        $this->db->select('cc.*, c.code as course_code, c.title as course_title, c.credit_units');
        $this->db->select('sess.name as session_name, sem.name as semester_name, sess.start_date');
        $this->db->from('carryover_corrections cc');
        $this->db->join('courses c', 'c.id = cc.course_id');
        $this->db->join('academic_sessions sess', 'sess.id = cc.session_id', 'left');
        $this->db->join('semesters sem', 'sem.id = cc.semester_id', 'left');
        $this->db->where_in('cc.student_id', $student_ids);

        $rows = $this->db->get()->result_array();
        $by_student = [];
        foreach ($rows as $r) {
            $by_student[$r['student_id']][] = $r;
        }
        return $by_student;
    }

    private function _fetch_all_registrations_for_students(array $student_ids)
    {
        if (empty($student_ids) || !$this->db->table_exists('course_registrations')) {
            return [];
        }

        $this->db->select('cr.student_id, cri.course_id, c.code as course_code, c.title as course_title, c.credit_units, cr.session_id, cr.semester_id, cr.level, cr.status as reg_status');
        $this->db->from('course_registrations cr');
        $this->db->join('course_registration_items cri', 'cri.registration_id = cr.id');
        $this->db->join('courses c', 'c.id = cri.course_id');
        $this->db->where_in('cr.student_id', $student_ids);
        $this->db->where_in('cr.status', ['approved', 'submitted', 'draft']);
        $this->db->where('(cri.status = "active" OR cri.status IS NULL)');

        $rows = $this->db->get()->result_array();
        $by_student = [];
        foreach ($rows as $r) {
            $by_student[$r['student_id']][] = $r;
        }
        return $by_student;
    }

    private function _merge_attempts_and_corrections(array $attempts, array $corrections)
    {
        if (empty($corrections)) {
            return $attempts;
        }

        $existing_att_ids = array_fill_keys(array_column($attempts, 'id'), true);
        foreach ($corrections as $corr) {
            $res_att_id = $corr['result_attempt_id'] ?? null;
            if (!$res_att_id || empty($existing_att_ids[$res_att_id])) {
                $att = $this->academic_calculator->correction_to_attempt($corr);
                $att['contact_id']    = $corr['semester_id'];
                $att['semester_name'] = $corr['semester_name'] ?? '';
                $att['level']         = $corr['level'] ?? '';
                $att['batch_status']  = 'published';
                $att['start_date']    = $corr['start_date'] ?? null;
                $att['status']        = 'active';
                $attempts[] = $att;
            }
        }

        usort($attempts, function($a, $b) {
            $sd_a = $a['start_date'] ?? '';
            $sd_b = $b['start_date'] ?? '';
            if ($sd_a !== $sd_b) return strcmp($sd_a, $sd_b);
            $ca_a = $a['created_at'] ?? '';
            $ca_b = $b['created_at'] ?? '';
            return strcmp($ca_a, $ca_b);
        });

        return $attempts;
    }

    /**
     * Evaluates course-by-course status to pinpoint unresolved failures vs pending vs passed courses
     */
    private function _evaluate_student_courses(array $attempts, array $registered, $is_de = false)
    {
        $courses_eval = [];
        $attempts_by_code = [];

        foreach ($attempts as $att) {
            $code = strtoupper(trim((string)($att['course_code'] ?? '')));
            if ($code === '') continue;

            // Direct Entry Contact 1 exemption
            if ($is_de && $this->_is_contact_1_period($att['semester_name'] ?? '', $att['level'] ?? '')) {
                continue;
            }

            $attempts_by_code[$code][] = $att;
        }

        $registered_codes = [];
        foreach ($registered as $reg) {
            $code = strtoupper(trim((string)($reg['course_code'] ?? '')));
            if ($code === '') continue;

            // Direct Entry Contact 1 exemption
            if ($is_de && $this->_is_contact_1_period($reg['semester_id'] ?? '', $reg['level'] ?? '')) {
                continue;
            }
            $registered_codes[$code] = $reg;
        }

        $all_unique_codes = array_unique(array_merge(array_keys($attempts_by_code), array_keys($registered_codes)));

        $outstanding = [];
        $pending     = [];
        $passed      = [];

        foreach ($all_unique_codes as $code) {
            $atts = $attempts_by_code[$code] ?? [];
            if (empty($atts)) {
                // Registered but no published attempt
                $pending[] = $code;
                continue;
            }

            // Check if student EVER achieved a passing grade in this course
            $has_passed = false;
            $has_failed = false;
            $has_unscored = false;

            foreach ($atts as $att) {
                $grade = strtoupper(trim((string)($att['grade'] ?? '')));
                $score = $att['total_score'];

                if ($grade === 'ABS' || $grade === 'F') {
                    $has_failed = true;
                } else if ($this->academic_policy->is_passing_grade($grade)) {
                    $has_passed = true;
                } else if ($grade === '' || $grade === 'NR' || ($score === null && $grade === '-')) {
                    $has_unscored = true;
                }
            }

            if ($has_passed) {
                $passed[] = $code;
            } else if ($has_failed) {
                // Failed and never subsequently passed!
                $outstanding[] = $code;
            } else if ($has_unscored) {
                $pending[] = $code;
            }
        }

        return [
            'outstanding' => $outstanding,
            'pending'     => $pending,
            'passed'      => $passed,
        ];
    }

    private function _calculate_career_metrics(array $attempts)
    {
        $res = $this->academic_calculator->calculate($attempts, [], 'reported');
        return [
            'registered_credits' => (int)$res['registered_credits'],
            'earned_credits'     => (int)$res['earned_credits'],
            'quality_points'     => (float)$res['quality_points'],
            'cgpa'               => (float)$res['cgpa'],
        ];
    }

    private function _resolve_degree_class($cgpa, $framework = 'CCMAS')
    {
        $cgpa_num = (float)$cgpa;
        if (strtoupper($framework) === 'BMAS') {
            if ($cgpa_num >= 4.50) return 'First Class Honours';
            if ($cgpa_num >= 3.50) return 'Second Class Honours (Upper Division)';
            if ($cgpa_num >= 2.40) return 'Second Class Honours (Lower Division)';
            if ($cgpa_num >= 1.50) return 'Third Class Honours';
            if ($cgpa_num >= 1.00) return 'Pass Degree';
            return 'Fail';
        }

        // CCMAS (Default & Standard)
        if ($cgpa_num >= 4.50) return 'First Class Honours';
        if ($cgpa_num >= 3.50) return 'Second Class Honours (Upper Division)';
        if ($cgpa_num >= 2.50) return 'Second Class Honours (Lower Division)';
        if ($cgpa_num >= 1.50) return 'Third Class Honours';
        return 'Ineligible';
    }

    private function _is_direct_entry($student)
    {
        $em = strtolower(trim((string)($student['entry_mode'] ?? '')));
        if (strpos($em, 'direct') !== false || $em === 'de') {
            return true;
        }
        $adm_mode = strtolower(trim((string)($student['admission_mode_of_entry'] ?? '')));
        if (strpos($adm_mode, 'direct') !== false || $adm_mode === 'de') {
            return true;
        }
        $adm_lvl = (string)($student['admission_level'] ?? '');
        if ($adm_lvl === '200' || $adm_lvl === 'Contact 2') {
            return true;
        }
        $matric = (string)($student['matric_number'] ?? '');
        // e.g. CEC/EDU/MEAP2/ or patterns indicating 2-year DE
        if (preg_match('/[A-Za-z]+2\/\d+\/\d+/', $matric) || preg_match('/\/DE\//i', $matric)) {
            return true;
        }
        return false;
    }

    private function _is_contact_1_period($sem_name, $level_name)
    {
        $blob = strtolower($sem_name . ' ' . $level_name);
        return strpos($blob, 'contact 1') !== false || strpos($blob, '100') !== false;
    }

    private function _check_terminal_contact_reached($student, array $all_attempts, $required_terminal)
    {
        $req = strtolower(trim($required_terminal));
        if ($req === 'all' || $req === '') return true;

        $st_lvl = strtolower(trim((string)($student['current_level'] ?? '')));
        if (strpos($st_lvl, $req) !== false) return true;

        // Check if student has taken attempts in the target contact
        foreach ($all_attempts as $att) {
            $sem = strtolower(trim((string)($att['semester_name'] ?? '')));
            $lvl = strtolower(trim((string)($att['level'] ?? '')));
            if (strpos($sem, $req) !== false || strpos($lvl, $req) !== false) {
                return true;
            }
        }
        return false;
    }

    private function _check_fee_clearance($student)
    {
        if (!$this->db->table_exists('invoices')) {
            return true;
        }
        // If invoices exist, verify no unpaid compulsory invoice
        $sid = $student['student_id'] ?? $student['id'];
        $unpaid = $this->db->where('student_id', $sid)
            ->where_in('status', ['unpaid', 'pending'])
            ->count_all_results('invoices');
        return $unpaid === 0;
    }

    private function _format_name_pdf($raw_name)
    {
        $name = str_replace(array("\xEF\xBF\xBD", "\u{FFFD}", "\xE2\x80\x99", "\xE2\x80\x98", '’', '‘', '`', '´'), "'", trim((string)$raw_name));
        if ($name === '') return '—';

        // Split glued uppercase + title transitions
        $name = preg_replace('/([A-Z\']{2,})([A-Z][a-z])/', '$1 $2', $name);

        if (strpos($name, ',') !== false) {
            $parts = explode(',', $name, 2);
            $surname = strtoupper(trim($parts[0]));
            $other_parts = preg_split('/\s+/', trim($parts[1]));
            $others = implode(' ', array_map(function($p) { return ucfirst(strtolower($p)); }, array_filter($other_parts)));
            return $surname . ($others !== '' ? (', ' . $others) : '');
        }

        $parts = preg_split('/\s+/', trim($name));
        $parts = array_values(array_filter($parts));
        if (empty($parts)) return $name;

        $surname = strtoupper(array_shift($parts));
        $others  = implode(' ', array_map(function($p) { return ucfirst(strtolower($p)); }, $parts));
        return $others !== '' ? ($surname . ', ' . $others) : $surname;
    }

    private function _format_dob_pdf($dob)
    {
        if (!$dob || $dob === '0000-00-00') return '—';
        $time = strtotime($dob);
        if (!$time) return (string)$dob;
        return date('d/m/Y', $time);
    }

    private function _format_gender_pdf($gender)
    {
        $g = strtolower(trim((string)$gender));
        if (strpos($g, 'f') === 0) return 'Female';
        if (strpos($g, 'm') === 0) return 'Male';
        return $gender ? ucfirst($gender) : '—';
    }

    private function _format_origin_pdf($state)
    {
        $s = trim((string)$state);
        if ($s === '') return '—';
        return ucwords(strtolower($s));
    }

    private function _resolve_jamb_number($student)
    {
        if (!empty($student['jamb_number'])) {
            return trim($student['jamb_number']);
        }
        if (!empty($student['admission_number']) && preg_match('/^\d{8}[A-Za-z]{2,3}$/', trim($student['admission_number']))) {
            return trim($student['admission_number']);
        }
        return '—';
    }

    private function _resolve_year_admitted($student)
    {
        // 1. Session Name: e.g. "2021/2022" -> "2021"
        $sess = $student['session_name'] ?? ($student['entry_session_id'] ?? '');
        if (preg_match('/^(\d{4})\/\d{4}/', $sess, $m)) {
            return $m[1];
        }
        if (preg_match('/(\d{4})/', $sess, $m)) {
            return $m[1];
        }
        // 2. Matric No: e.g. CEC/EDU/2020/0190 -> 2020 or /22/125 -> 2022
        $matric = $student['matric_number'] ?? '';
        if (preg_match('/\/(\d{4})\//', $matric, $m)) {
            return $m[1];
        }
        if (preg_match('/\/(\d{2})\//', $matric, $m)) {
            return '20' . $m[1];
        }
        // 3. Created At year
        if (!empty($student['created_at'])) {
            $yr = date('Y', strtotime($student['created_at']));
            if ($yr && (int)$yr > 2000) return $yr;
        }
        return '—';
    }

    private function _resolve_current_level($student, array $all_attempts)
    {
        $lvl = trim((string)($student['current_level'] ?? ''));
        if ($lvl !== '') return $lvl;

        // Fallback to highest level seen in attempts
        $max_lvl = '400';
        foreach ($all_attempts as $att) {
            $al = trim((string)($att['level'] ?? ''));
            if ($al !== '') $max_lvl = $al;
        }
        return $max_lvl;
    }

    private function _fetch_metadata($session_id, $programme_id)
    {
        $session = null;
        if ($session_id) {
            $session = $this->db->get_where('academic_sessions', ['id' => $session_id])->row_array();
            if (!$session) {
                $session = $this->db->get_where('academic_sessions', ['name' => $session_id])->row_array();
            }
        }
        $programme = null;
        if ($programme_id) {
            $programme = $this->db->get_where('programmes', ['id' => $programme_id])->row_array();
        }

        return [
            'session_name'   => $session['name'] ?? ($session_id ?: 'Active Session'),
            'programme_name' => $programme['name'] ?? 'Degree Programme',
            'programme_code' => $programme['code'] ?? '',
            'generated_at'   => date('d/m/Y H:i:s'),
        ];
    }

    private function _empty_summary_stats()
    {
        return [
            'total_audited'     => 0,
            'cleared_count'     => 0,
            'cleared_percent'   => 0,
            'ineligible_count'  => 0,
            'ineligible_percent'=> 0,
            'class_breakdown'   => [
                'First Class Honours'                      => 0,
                'Second Class Honours (Upper Division)'    => 0,
                'Second Class Honours (Lower Division)'    => 0,
                'Third Class Honours'                      => 0,
                'Pass Degree'                              => 0,
            ],
            'deficiency_breakdown' => [
                'outstanding' => 0,
                'pending'     => 0,
                'tce'         => 0,
                'cgpa'        => 0,
                'level'       => 0,
                'finance'     => 0,
            ],
        ];
    }

    private function _generate_uuid()
    {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }
}


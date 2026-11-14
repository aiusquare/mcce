<?php
defined('BASEPATH') OR exit('No direct script access allowed');

/**
 * Period_resolver
 * Canonical resolution of session, semester, contact number, and variants
 * across UUIDs, names, and contact/level strings.
 */
class Period_resolver {

    protected $CI;
    protected $_semester_name_map = null;
    protected $_contact_semester_ids = null;

    public function __construct()
    {
        $this->CI = &get_instance();
        if (!isset($this->CI->db) || !$this->CI->db) {
            $this->CI->load->database();
        }
    }

    private function _init_semester_map()
    {
        if ($this->_semester_name_map === null) {
            $this->_semester_name_map = [];
            $this->_contact_semester_ids = [];
            if ($this->CI->db->table_exists('semesters')) {
                $rows = $this->CI->db->select('id, name')->get('semesters')->result_array();
                foreach ($rows as $r) {
                    $this->_semester_name_map[$r['id']] = $r['name'];
                    $this->_semester_name_map[$r['name']] = $r['name'];
                    if (preg_match('/contact\s*(\d+)/i', (string)$r['name'], $m)) {
                        $c_num = (int)$m[1];
                        $this->_contact_semester_ids[$r['id']] = $c_num;
                        $this->_contact_semester_ids[$r['name']] = $c_num;
                    }
                }
            }
        }
    }

    /**
     * Resolves session, semester, level and builds comprehensive variant lists.
     *
     * @param string|null $session_input
     * @param string|null $semester_input
     * @param string|null $level
     * @return array
     */
    public function resolve($session_input, $semester_input, $level = null)
    {
        $session = null;
        if (!empty($session_input)) {
            $session = $this->CI->db->get_where('academic_sessions', ['id' => $session_input])->row_array();
            if (!$session) {
                $session = $this->CI->db->get_where('academic_sessions', ['name' => $session_input])->row_array();
            }
            if (!$session) {
                $session = ['id' => $session_input, 'name' => $session_input];
            }
        }

        $semester = null;
        if (!empty($semester_input)) {
            $semester = $this->CI->db->get_where('semesters', ['id' => $semester_input])->row_array();
            if (!$semester) {
                $semester = $this->CI->db->get_where('semesters', ['name' => $semester_input])->row_array();
            }
            if (!$semester) {
                $semester = ['id' => $semester_input, 'name' => $semester_input];
            }
        }

        $session_ids = array_values(array_filter(array_unique([
            $session_input,
            $session['id'] ?? null,
            $session['name'] ?? null
        ]), function($v) { return $v !== null && $v !== ''; }));

        $current_session_name = $session['name'] ?? ($session_input ?? '');
        $current_semester_name = $semester['name'] ?? ($semester_input ?? '');
        $contact_num = $this->extract_contact_number($current_semester_name);
        if ($contact_num === null && !empty($level)) {
            $contact_num = $this->extract_contact_number($level);
        }
        $is_c1 = $this->is_contact_1_period($current_semester_name, $level) || ($contact_num === 1);

        $sem_variants = [
            $semester_input,
            $semester['id'] ?? null,
            $semester['name'] ?? null,
            $level
        ];
        if ($contact_num !== null) {
            $sem_variants[] = 'Contact ' . $contact_num;
            $sem_variants[] = 'Contact' . $contact_num;
            $sem_variants[] = (string)($contact_num * 100);
            $sem_variants[] = (string)$contact_num;
        }
        $semester_ids = array_values(array_filter(array_unique($sem_variants), function($v) { return $v !== null && $v !== ''; }));

        $canonical_label = $current_semester_name;
        if ($contact_num !== null) {
            $canonical_label = 'Contact ' . $contact_num;
        }

        $this->_init_semester_map();
        $other_contact_sem_ids = [];
        if ($contact_num !== null && !empty($this->_contact_semester_ids)) {
            foreach ($this->_contact_semester_ids as $sem_key => $c_num) {
                if ($c_num !== $contact_num) {
                    $other_contact_sem_ids[] = $sem_key;
                }
            }
            $other_contact_sem_ids = array_values(array_unique($other_contact_sem_ids));
        }

        return [
            'session'                    => $session,
            'semester'                   => $semester,
            'session_id'                 => $session['id'] ?? $session_input,
            'semester_id'                => $semester['id'] ?? $semester_input,
            'session_name'               => $current_session_name,
            'semester_name'              => $current_semester_name,
            'session_ids'                => $session_ids,
            'semester_ids'               => $semester_ids,
            'other_contact_semester_ids' => $other_contact_sem_ids,
            'contact_number'             => $contact_num,
            'is_contact_1'               => $is_c1,
            'label'                      => $canonical_label,
            'level'                      => $level,
        ];
    }

    public function extract_contact_number($label, $course_code = null)
    {
        $this->_init_semester_map();
        $str = trim((string)$label);
        if ($str !== '' && isset($this->_semester_name_map[$str])) {
            $str = $this->_semester_name_map[$str];
        }
        if ($str !== '') {
            if (preg_match('/contact\s*(\d+)/i', $str, $m)) {
                return (int)$m[1];
            }
            if (preg_match('/(?:sem-c|contact[-_]?)\s*(\d+)/i', $str, $m)) {
                return (int)$m[1];
            }
            if (preg_match('/^(\d)00$/', $str, $m)) {
                return (int)$m[1];
            }
            if (preg_match('/^(\d)$/', $str, $m)) {
                return (int)$m[1];
            }
        }
        return null;
    }

    /**
     * Resolves the contact number (1..6) of a DB row where semester_id/semester_name
     * may be a specific Contact UUID/name OR a generic semester ('First Semester')
     * with the actual contact stored in the `level` column.
     */
    public function resolve_row_contact_number($semester_label, $level_label = null, $semester_id = null)
    {
        if ($semester_id !== null && $semester_id !== '') {
            $c = $this->extract_contact_number($semester_id);
            if ($c !== null) {
                return $c;
            }
        }
        $c = $this->extract_contact_number($semester_label);
        if ($c !== null) {
            return $c;
        }
        if ($level_label !== null && $level_label !== '') {
            $c = $this->extract_contact_number($level_label);
            if ($c !== null) {
                return $c;
            }
        }
        return null;
    }

    /**
     * Builds a safe SQL condition for matching semester_id or level without
     * allowing polluted `level = 'Contact 6'` rows to match when `semester_id`
     * explicitly belongs to a different Contact (e.g. Contact 1..5).
     */
    public function build_semester_level_match_sql($sem_col, $level_col, array $target_semester_ids, array $other_contact_sem_ids = [])
    {
        if (empty($target_semester_ids)) {
            return ['sql' => '1=0', 'params' => []];
        }
        $sem_ph = implode(',', array_fill(0, count($target_semester_ids), '?'));
        if (!empty($other_contact_sem_ids)) {
            $other_ph = implode(',', array_fill(0, count($other_contact_sem_ids), '?'));
            return [
                'sql'    => "({$sem_col} IN ({$sem_ph}) OR (({$sem_col} IS NULL OR {$sem_col} NOT IN ({$other_ph})) AND {$level_col} IN ({$sem_ph})))",
                'params' => array_merge($target_semester_ids, $other_contact_sem_ids, $target_semester_ids)
            ];
        }
        return [
            'sql'    => "({$sem_col} IN ({$sem_ph}) OR {$level_col} IN ({$sem_ph}))",
            'params' => array_merge($target_semester_ids, $target_semester_ids)
        ];
    }

    public function is_contact_1_period($sem_name, $level = null)
    {
        $this->_init_semester_map();
        $s = strtolower(trim((string)$sem_name));
        if ($s !== '' && isset($this->_semester_name_map[$sem_name])) {
            $s = strtolower(trim((string)$this->_semester_name_map[$sem_name]));
        }
        $l = strtolower(trim((string)$level));
        return strpos($s, 'contact 1') !== false
            || strpos($l, 'contact 1') !== false
            || $l === '100'
            || $s === '100'
            || $l === '1'
            || $s === '1';
    }

    public function is_period_before($sess_a, $sem_a, $sess_b, $sem_b, $course_code_a = null)
    {
        // 1. Try comparing academic session start years if available (e.g. '2021/2022' vs '2022/2023')
        $y_a = preg_match('/(\d{4})/', (string)$sess_a, $ma) ? (int)$ma[1] : null;
        $y_b = preg_match('/(\d{4})/', (string)$sess_b, $mb) ? (int)$mb[1] : null;
        if ($y_a !== null && $y_b !== null && $y_a !== $y_b) {
            return $y_a < $y_b;
        }

        // 2. If same session or unparseable, compare contact numbers
        $c_a = $this->extract_contact_number($sem_a, $course_code_a);
        $c_b = $this->extract_contact_number($sem_b);
        if ($c_a !== null && $c_b !== null) {
            return $c_a < $c_b;
        }

        if (!$this->CI->load->is_loaded('Outstanding_course_model')) {
            $this->CI->load->model('Outstanding_course_model');
        }
        return $this->CI->Outstanding_course_model->is_before($sess_a, $sem_a, $sess_b, $sem_b);
    }

    /**
     * Builds dual-read teaching-session SQL for safe production envelope transition.
     *
     * An academic session is the period in which a registration/result was taught.
     * It must never be widened with a student's entry/cohort session: a 2021/2022
     * broadsheet is not a request for every student admitted in 2021/2022.  When
     * the canonical column exists it is authoritative; session_id is only a
     * fallback for legacy rows that have not yet been populated.
     *
     * @param string $tbl Table alias (e.g. 'cr' or 'rb')
     * @param array $session_ids Target session IDs / names
     * @param string|null $student_alias Retained for backwards-compatible calls;
     *                                   it is intentionally not used for matching.
     * @return array ['sql' => string, 'params' => array]
     */
    public function build_dual_session_match_sql($tbl, array $session_ids, $student_alias = null)
    {
        if (empty($session_ids)) {
            return ['sql' => '1=0', 'params' => []];
        }
        $ph = implode(',', array_fill(0, count($session_ids), '?'));
        
        $real_table = ($tbl === 'cr') ? 'course_registrations' : (($tbl === 'rb') ? 'result_batches' : $tbl);
        $has_acad_col = $this->CI->db->field_exists('academic_session_id', $real_table);
        if ($has_acad_col) {
            return [
                'sql' => "({$tbl}.academic_session_id IN ({$ph}) OR "
                    . "(({$tbl}.academic_session_id IS NULL OR {$tbl}.academic_session_id = '') "
                    . "AND {$tbl}.session_id IN ({$ph})))",
                'params' => array_merge($session_ids, $session_ids)
            ];
        }

        return ['sql' => "{$tbl}.session_id IN ({$ph})", 'params' => $session_ids];
    }

    /**
     * Resolves the only valid entry route for a contact in an academic session.
     * The first configured academic-session year is Contact 1 for fresh entrants
     * and Contact 2 for Direct Entry; each later session advances both by one.
     */
    public function resolve_contact_entry_eligibility($session_input, $semester_input, $level = null)
    {
        $period = $this->resolve($session_input, $semester_input, $level);
        $contact = $period['contact_number'];
        if ($contact === null) {
            return ['applies' => false, 'is_valid' => true, 'entry_mode' => null];
        }

        $session_name = (string)($period['session_name'] ?? '');
        if (!preg_match('/(\d{4})/', $session_name, $target_match)) {
            return ['applies' => false, 'is_valid' => true, 'entry_mode' => null];
        }

        $first_year = null;
        if ($this->CI->db->table_exists('academic_sessions')) {
            foreach ($this->CI->db->select('name')->get('academic_sessions')->result_array() as $row) {
                if (preg_match('/(\d{4})/', (string)($row['name'] ?? ''), $match)) {
                    $year = (int)$match[1];
                    $first_year = ($first_year === null || $year < $first_year) ? $year : $first_year;
                }
            }
        }
        if ($first_year === null) {
            return ['applies' => false, 'is_valid' => true, 'entry_mode' => null];
        }

        $fresh_contact = ((int)$target_match[1] - $first_year) + 1;
        $direct_contact = $fresh_contact + 1;
        $entry_mode = null;
        if ((int)$contact === $fresh_contact) {
            $entry_mode = 'fresh';
        } elseif ((int)$contact === $direct_contact) {
            $entry_mode = 'direct_entry';
        }

        return [
            'applies' => true,
            'is_valid' => $entry_mode !== null,
            'entry_mode' => $entry_mode,
            'contact_number' => (int)$contact,
            'fresh_contact' => $fresh_contact,
            'direct_entry_contact' => $direct_contact,
            'foundation_year' => $first_year,
        ];
    }

    /**
     * Resolves envelope with optional target student cohort.
     */
    public function resolve_envelope($academic_session_input, $semester_input, $level = null, $cohort_input = null)
    {
        $base = $this->resolve($academic_session_input, $semester_input, $level);
        
        $cohort = null;
        if (!empty($cohort_input) && strtolower((string)$cohort_input) !== 'all') {
            $cohort = $this->CI->db->get_where('academic_sessions', ['id' => $cohort_input])->row_array();
            if (!$cohort) {
                $cohort = $this->CI->db->get_where('academic_sessions', ['name' => $cohort_input])->row_array();
            }
        }
        
        $base['cohort_session'] = $cohort;
        $base['cohort_session_id'] = $cohort['id'] ?? null;
        $base['cohort_session_name'] = $cohort['name'] ?? null;
        return $base;
    }

    /**
     * Builds SQL IN clause with parameters for query builder / manual queries.
     */
    public function sql_in_clause($column, $values)
    {
        $values = array_values(array_filter(array_unique((array)$values)));
        if (empty($values)) {
            return ['clause' => '1=0', 'params' => []];
        }
        $placeholders = implode(',', array_fill(0, count($values), '?'));
        return [
            'clause' => "{$column} IN ({$placeholders})",
            'params' => $values
        ];
    }
}

<?php
defined('BASEPATH') OR exit('No direct script access allowed');

/**
 * Academic_policy
 * Centralized governance of grading scale, academic standing thresholds,
 * graduation classifications, ABS policy, and CGPA denominator modes.
 */
class Academic_policy {

    protected $CI;
    protected $_settings_cache = null;
    protected $_grading_scheme_cache = null;

    protected $defaults = [
        'broadsheet_official_basis' => 'published',
        'cgpa_denominator'          => 'reported', // 'reported' or 'registered'
        'abs_policy'                => 'fail',     // 'fail' (0 pt, in TCR) or 'exclude'
        'withdrawal_below_cgpa'     => '1.00',
        'probation_min_cgpa'        => '1.00',
        'probation_upper_cgpa'      => '1.50',
        'institution_name'          => 'Maslaha Community College of Education',
        'final_contact_number'      => '6',
        'approval_chain'            => '["Course Coordinator", "Head of Department", "Dean / Director"]',
        'classification_bands'      => '[
            {"label": "Distinction", "min": 4.50, "max": 5.00},
            {"label": "Credit", "min": 3.50, "max": 4.49},
            {"label": "Merit", "min": 2.50, "max": 3.49},
            {"label": "Pass", "min": 1.50, "max": 2.49},
            {"label": "Fail", "min": 0.00, "max": 1.49}
        ]',
    ];

    public function __construct()
    {
        $this->CI = &get_instance();
        if (!isset($this->CI->db) || !$this->CI->db) {
            $this->CI->load->database();
        }
    }

    public function get_setting($key, $default = null)
    {
        $this->_load_settings();
        if (isset($this->_settings_cache[$key])) {
            return $this->_settings_cache[$key];
        }
        return $default !== null ? $default : ($this->defaults[$key] ?? null);
    }

    public function get_all_settings()
    {
        $this->_load_settings();
        $merged = $this->defaults;
        foreach ($this->_settings_cache as $k => $v) {
            $merged[$k] = $v;
        }
        return $merged;
    }

    public function set_settings(array $settings, $user_id = null)
    {
        if (!$this->CI->db->table_exists('academic_settings')) {
            return false;
        }

        $now = date('Y-m-d H:i:s');
        foreach ($settings as $key => $val) {
            if (is_array($val) || is_object($val)) {
                $val = json_encode($val);
            }
            $existing = $this->CI->db->get_where('academic_settings', ['setting_key' => $key])->row_array();
            if ($existing) {
                $this->CI->db->where('id', $existing['id'])->update('academic_settings', [
                    'setting_value' => (string)$val,
                    'updated_at'    => $now,
                    'updated_by'    => $user_id,
                ]);
            } else {
                $this->CI->db->insert('academic_settings', [
                    'id'            => $this->_generate_uuid(),
                    'setting_key'   => $key,
                    'setting_value' => (string)$val,
                    'updated_at'    => $now,
                    'updated_by'    => $user_id,
                ]);
            }
            $this->_settings_cache[$key] = (string)$val;
        }
        return true;
    }

    private function _load_settings()
    {
        if ($this->_settings_cache === null) {
            $this->_settings_cache = [];
            if ($this->CI->db->table_exists('academic_settings')) {
                $rows = $this->CI->db->get('academic_settings')->result_array();
                foreach ($rows as $r) {
                    $this->_settings_cache[$r['setting_key']] = $r['setting_value'];
                }
            }
        }
    }

    public function standing($cgpa, $ccr, $is_complete = true)
    {
        if (!$is_complete) {
            return 'INCOMPLETE';
        }
        $cgpa_num = (float)$cgpa;
        $ccr_num = (int)$ccr;
        if ($ccr_num <= 0) {
            return 'NONE';
        }

        $with_below = (float)$this->get_setting('withdrawal_below_cgpa', '1.00');
        $prob_upper = (float)$this->get_setting('probation_upper_cgpa', '1.50');

        if ($cgpa_num < $with_below) {
            return 'WITHDRAWAL';
        }
        if ($cgpa_num < $prob_upper) {
            return 'PROBATION';
        }
        return 'GOOD_STANDING';
    }

    public function classification($cgpa, $is_final = false)
    {
        if (!$is_final) {
            return null;
        }
        $cgpa_num = (float)$cgpa;
        $bands = $this->get_classification_bands();

        foreach ($bands as $band) {
            $min = (float)($band['min'] ?? 0);
            $max = (float)($band['max'] ?? 5.0);
            if ($cgpa_num >= $min && $cgpa_num <= $max) {
                return $band['label'];
            }
        }
        return null;
    }

    public function classify($cgpa)
    {
        return $this->classification($cgpa, true);
    }

    public function get_classification_bands()
    {
        $raw = $this->get_setting('classification_bands');
        $bands = json_decode($raw, true);
        if (is_array($bands) && !empty($bands)) {
            return $bands;
        }
        return [
            ['label' => 'Distinction', 'min' => 4.50, 'max' => 5.00],
            ['label' => 'Credit',      'min' => 3.50, 'max' => 4.49],
            ['label' => 'Merit',       'min' => 2.50, 'max' => 3.49],
            ['label' => 'Pass',        'min' => 1.50, 'max' => 2.49],
            ['label' => 'Fail',        'min' => 0.00, 'max' => 1.49],
        ];
    }

    public function grade_scale()
    {
        if ($this->_grading_scheme_cache === null) {
            $this->_grading_scheme_cache = [];
            if ($this->CI->db->table_exists('grading_schemes') && $this->CI->db->table_exists('grading_ranges')) {
                $scheme = $this->CI->db->get_where('grading_schemes', ['is_active' => 1])->row_array();
                if ($scheme) {
                    $ranges = $this->CI->db->where('scheme_id', $scheme['id'])
                        ->order_by('min_score', 'DESC')
                        ->get('grading_ranges')->result_array();
                    $this->_grading_scheme_cache = [
                        'scheme' => $scheme,
                        'ranges' => $ranges
                    ];
                }
            }
        }
        return $this->_grading_scheme_cache;
    }

    public function score_to_grade($score)
    {
        if ($score === null || $score === '') {
            return null;
        }
        $sc = (float)$score;
        $scale = $this->grade_scale();
        if (!empty($scale['ranges'])) {
            foreach ($scale['ranges'] as $r) {
                $min = (float)($r['min_score'] ?? 0);
                $max = (float)($r['max_score'] ?? 100);
                if ($sc >= $min && $sc <= $max) {
                    return $r['letter_grade'];
                }
            }
        }
        if ($sc >= 70.0) return 'A';
        if ($sc >= 60.0) return 'B';
        if ($sc >= 50.0) return 'C';
        if ($sc >= 45.0) return 'D';
        if ($sc >= 40.0) return 'E';
        return 'F';
    }

    public function is_passing_grade($grade)
    {
        $g = strtoupper(trim((string)$grade));
        // Strip leading score digits if concatenated e.g. "26F" -> "F"
        $g = preg_replace('/^[0-9]+(?:\.[0-9]+)?\s*/', '', $g);
        if ($g === '' || in_array($g, ['F', 'ABS', 'NR', '-', '—', 'WITHHELD'], true)) {
            return false;
        }
        $scale = $this->grade_scale();
        if (!empty($scale['ranges'])) {
            foreach ($scale['ranges'] as $r) {
                if (strcasecmp($r['letter_grade'], $g) === 0) {
                    return !empty($r['is_pass']);
                }
            }
        }
        return in_array($g, ['A', 'B', 'C', 'D', 'E'], true);
    }

    public function grade_point($grade)
    {
        $g = strtoupper(trim((string)$grade));
        // Strip leading score digits if concatenated e.g. "74A" -> "A"
        $g = preg_replace('/^[0-9]+(?:\.[0-9]+)?\s*/', '', $g);
        if ($g === '' || in_array($g, ['ABS', 'NR', '-', '—', 'WITHHELD'], true)) {
            return 0.0;
        }
        $scale = $this->grade_scale();
        if (!empty($scale['ranges'])) {
            foreach ($scale['ranges'] as $r) {
                if (strcasecmp($r['letter_grade'], $g) === 0) {
                    return (float)($r['grade_point'] ?? 0);
                }
            }
        }
        $map = [
            'A' => 5.0,
            'B' => 4.0,
            'C' => 3.0,
            'D' => 2.0,
            'E' => 1.0,
            'F' => 0.0
        ];
        return (float)($map[$g] ?? 0.0);
    }

    public function abs_counts_in_tcr()
    {
        return strtolower($this->get_setting('abs_policy', 'fail')) === 'fail';
    }

    public function cgpa_denominator_mode()
    {
        return strtolower($this->get_setting('cgpa_denominator', 'reported'));
    }

    public function is_direct_entry($student)
    {
        $em = strtolower(trim((string)($student['entry_mode'] ?? '')));
        if (strpos($em, 'direct') !== false || $em === 'de') {
            return true;
        }
        $matric = (string)($student['matric_number'] ?? '');
        if ($matric !== '' && preg_match('/[A-Za-z]+2\/\d+\/\d+/', $matric)) {
            return true;
        }
        return false;
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

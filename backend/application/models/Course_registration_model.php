<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Course_registration_model extends CI_Model
{
    public function __construct()
    {
        parent::__construct();
        $this->ensure_registration_columns();
    }

    public function ensure_registration_columns()
    {
        if ($this->db->table_exists('course_registration_items')) {
            @$this->db->query("ALTER TABLE `course_registration_items` ROW_FORMAT=DYNAMIC");
            if (!$this->db->field_exists('dropped_at', 'course_registration_items')) {
                @$this->db->query("ALTER TABLE `course_registration_items` ADD COLUMN `dropped_at` DATETIME NULL AFTER `status`");
            }
            if (!$this->db->field_exists('dropped_by', 'course_registration_items')) {
                @$this->db->query("ALTER TABLE `course_registration_items` ADD COLUMN `dropped_by` VARCHAR(36) NULL AFTER `dropped_at`");
            }
            if (!$this->db->field_exists('drop_reason', 'course_registration_items')) {
                @$this->db->query("ALTER TABLE `course_registration_items` ADD COLUMN `drop_reason` TEXT NULL AFTER `dropped_by`");
            }
        }

        if ($this->db->table_exists('course_registrations')) {
            @$this->db->query("ALTER TABLE `course_registrations` ROW_FORMAT=DYNAMIC");
            if (!$this->db->field_exists('source', 'course_registrations')) {
                @$this->db->query("ALTER TABLE `course_registrations` ADD COLUMN `source` VARCHAR(20) NOT NULL DEFAULT 'student' AFTER `status`");
            }
        }

        if (!$this->db->table_exists('credit_load_rules')) {
            @$this->db->query("CREATE TABLE IF NOT EXISTS `credit_load_rules` (
              `id` CHAR(36) NOT NULL,
              `programme_id` CHAR(36) NOT NULL,
              `level` VARCHAR(30) NOT NULL,
              `semester_id` CHAR(36) NULL,
              `min_credits` INT NOT NULL DEFAULT 15,
              `max_credits` INT NOT NULL DEFAULT 24,
              `created_at` DATETIME NOT NULL,
              `updated_at` DATETIME NULL,
              PRIMARY KEY (`id`),
              UNIQUE KEY `idx_prog_level_sem` (`programme_id`, `level`, `semester_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        }
    }

    public function get_registration_settings($session_id, $semester_id)
    {
        $this->db->where('session_id', $session_id);
        $this->db->where('semester_id', $semester_id);
        return $this->db->get('course_registration_settings')->row_array();
    }

    public function save_registration_settings($data)
    {
        $settings = $this->get_registration_settings($data['session_id'], $data['semester_id']);
        $data['updated_at'] = date('Y-m-d H:i:s');
        
        if ($settings) {
            $this->db->where('id', $settings['id']);
            $this->db->update('course_registration_settings', $data);
            return $settings['id'];
        } else {
            $data['id'] = $this->generate_uuid();
            $data['created_at'] = date('Y-m-d H:i:s');
            $this->db->insert('course_registration_settings', $data);
            return $data['id'];
        }
    }

    public function extract_level_step($level)
    {
        $raw = strtolower(trim((string)$level));
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

    public function get_level_aliases($level)
    {
        $raw = trim((string)$level);
        if ($raw === '' || strtoupper($raw) === 'ALL') {
            return array('ALL', 'all');
        }
        $aliases = array($raw, strtolower($raw), strtoupper($raw));
        $step = $this->extract_level_step($raw);
        if ($step !== null) {
            $word_names = array(
                1 => 'one', 2 => 'two', 3 => 'three',
                4 => 'four', 5 => 'five', 6 => 'six'
            );
            $aliases[] = 'Contact ' . $step;
            $aliases[] = 'contact ' . $step;
            $aliases[] = 'Contact' . $step;
            $aliases[] = (string)$step;
            $aliases[] = ($step * 100) . ' Level';
            $aliases[] = (string)($step * 100);
            if (isset($word_names[$step])) {
                $aliases[] = 'contact-' . $word_names[$step];
                $aliases[] = 'contact ' . $word_names[$step];
            }
        }
        return array_values(array_unique(array_filter($aliases)));
    }

    public function get_credit_rules($programme_id, $level, $semester_id = null)
    {
        $default_fallback = array(
            'id'           => null,
            'programme_id' => $programme_id ?: 'GLOBAL',
            'level'        => $level ?: 'ALL',
            'semester_id'  => $semester_id,
            'min_credits'  => 15,
            'max_credits'  => 24,
            'is_default'   => true,
            'rule_scope'   => 'system_default',
        );

        if (!$this->db->table_exists('credit_load_rules')) {
            return $default_fallback;
        }

        $prog_candidates = array('GLOBAL', 'ALL', '*');
        if (!empty($programme_id)) {
            array_unshift($prog_candidates, trim((string)$programme_id));
        }
        $prog_candidates = array_values(array_unique($prog_candidates));

        $level_aliases = $this->get_level_aliases($level);
        $level_aliases_lower = array_map('strtolower', $level_aliases);
        $target_step = $this->extract_level_step($level);

        $this->db->where_in('programme_id', $prog_candidates);
        $rows = $this->db->get('credit_load_rules')->result_array();
        if (empty($rows)) {
            return $default_fallback;
        }

        $best_row = null;
        $best_score = -1;

        foreach ($rows as $r) {
            $r_prog  = trim((string)($r['programme_id'] ?? ''));
            $r_level = trim((string)($r['level'] ?? ''));
            $r_sem   = !empty($r['semester_id']) ? trim((string)$r['semester_id']) : null;

            // Check semester match if rule specifies a semester_id
            if ($r_sem !== null && $semester_id !== null && $r_sem !== trim((string)$semester_id)) {
                continue;
            }

            $is_exact_prog  = (!empty($programme_id) && $r_prog === trim((string)$programme_id));
            $is_global_prog = in_array(strtoupper($r_prog), array('GLOBAL', 'ALL', '*'), true);
            if (!$is_exact_prog && !$is_global_prog) {
                continue;
            }

            $r_level_lower = strtolower($r_level);
            $r_step = $this->extract_level_step($r_level);
            $is_all_level = in_array(strtoupper($r_level), array('ALL', 'GLOBAL', '*'), true);
            $is_matching_level = in_array($r_level_lower, $level_aliases_lower, true)
                || ($target_step !== null && $r_step !== null && $target_step === $r_step);

            if (!$is_matching_level && !$is_all_level) {
                continue;
            }

            // Priority scoring:
            // 100: Exact Programme + Matching Level
            //  80: Exact Programme + ALL Levels
            //  60: GLOBAL Programme + Matching Level
            //  40: GLOBAL Programme + ALL Levels (Configurable Default Fallback)
            $score = 0;
            if ($is_exact_prog && $is_matching_level) {
                $score = 100;
                $scope = 'programme_level';
            } elseif ($is_exact_prog && $is_all_level) {
                $score = 80;
                $scope = 'programme_default';
            } elseif ($is_global_prog && $is_matching_level) {
                $score = 60;
                $scope = 'global_level';
            } else {
                $score = 40;
                $scope = 'global_default';
            }

            if ($semester_id !== null && $r_sem !== null && $r_sem === trim((string)$semester_id)) {
                $score += 5;
            }

            if ($score > $best_score) {
                $best_score = $score;
                $r['min_credits'] = isset($r['min_credits']) ? (int)$r['min_credits'] : 15;
                $r['max_credits'] = isset($r['max_credits']) ? (int)$r['max_credits'] : 24;
                $r['is_default']  = ($score <= 40);
                $r['rule_scope']  = $scope;
                $best_row = $r;
            }
        }

        return $best_row ? $best_row : $default_fallback;
    }

    public function get_student_registration($student_id, $session_id, $semester_id, $level = null)
    {
        $this->db->where('student_id', $student_id);
        $this->db->where('session_id', $session_id);
        $this->db->where('semester_id', $semester_id);
        if ($level !== null) {
            $this->db->where('level', $level);
        }
        return $this->db->get('course_registrations')->row_array();
    }

    public function get_registration_items($registration_id)
    {
        $has_units = $this->db->field_exists('credit_units', 'courses');
        $credit_col = $has_units ? 'c.credit_units' : ($this->db->field_exists('credit_unit', 'courses') ? 'c.credit_unit' : '0');
        $this->db->select('i.*, c.code, c.title, ' . $credit_col . ' as credit_units, c.type as course_type, c.level as course_level');
        $this->db->from('course_registration_items i');
        $this->db->join('courses c', 'c.id = i.course_id');
        $this->db->where('i.registration_id', $registration_id);
        $this->db->group_start();
        $this->db->where('i.status', 'active');
        $this->db->or_where('i.status IS NULL', null, false);
        $this->db->group_end();
        return $this->db->get()->result_array();
    }

    public function generate_uuid()
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

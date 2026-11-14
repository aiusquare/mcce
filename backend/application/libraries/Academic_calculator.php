<?php
defined('BASEPATH') OR exit('No direct script access allowed');

/**
 * Academic_calculator
 * Unified calculation of TCR, TCE, TQP, GPA, CGPA across Broadsheet,
 * Student Statement, CGPA List, and Student Portal.
 */
class Academic_calculator {

    protected $CI;

    public function __construct()
    {
        $this->CI = &get_instance();
        if (!$this->CI->load->is_loaded('academic_policy')) {
            $this->CI->load->library('academic_policy');
        }
    }

    /**
     * Calculates TCR, TCE, TQP, GPA, CGPA from a set of attempts and registered courses.
     *
     * @param array $attempts Array of attempt rows (each with course_id, credit_units, total_score, grade, quality_point)
     * @param array $registered_courses [course_id => ['credit_units' => int, 'course_code' => string]]
     * @param string $denominator_mode 'reported' or 'registered' (defaults to policy setting)
     * @return array
     */
    public function calculate(array $attempts, array $registered_courses = [], $denominator_mode = null)
    {
        if ($denominator_mode === null) {
            $denominator_mode = $this->CI->academic_policy->cgpa_denominator_mode();
        }

        // Deduplicate attempts by normalized course_code (or fallback to course_id / unique id)
        // Attempts taken in different academic periods (e.g. retakes across semesters) are preserved as distinct attempts.
        // Prefer attempts that have an actual numeric total_score over empty/ABS placeholders
        $latest_attempts = [];
        $code_to_cid = [];
        foreach ($attempts as $idx => $att) {
            $norm_code = strtoupper(trim((string)($att['course_code'] ?? '')));
            $raw_cid = $att['course_id'] ?? ($norm_code ?: ($att['id'] ?? "att_{$idx}"));
            $eff_c = $att['_effective_contact'] ?? null;
            if ($eff_c !== null && $eff_c !== '') {
                $period = 'C' . (int)$eff_c;
            } else {
                $sess = $att['session_id'] ?? ($att['session_name'] ?? '');
                $sem  = $att['semester_id'] ?? ($att['semester_name'] ?? '');
                $lvl  = $att['batch_level'] ?? ($att['level'] ?? '');
                $period = trim($sess . '_' . $sem . '_' . $lvl, '_');
            }
            $key = ($norm_code !== '') ? ($norm_code . ($period !== '' ? '_' . $period : '')) : ($raw_cid . ($period !== '' ? '_' . $period : ''));
            if ($norm_code !== '' && !empty($att['course_id'])) {
                $code_to_cid[$norm_code] = $att['course_id'];
            }
            if (isset($latest_attempts[$key])) {
                $prev = $latest_attempts[$key];
                $prev_has_num = ($prev['total_score'] !== null && $prev['total_score'] !== '');
                $curr_has_num = ($att['total_score'] !== null && $att['total_score'] !== '');
                if ($prev_has_num && !$curr_has_num && empty($att['_from_carryover_correction'])) {
                    continue;
                }
            }
            $latest_attempts[$key] = $att;
        }

        $reported_credits = 0;
        $earned_credits = 0;
        $quality_points = 0.0;
        $unscored_courses_count = 0;
        $earned_course_keys = [];

        foreach ($latest_attempts as $cid => $att) {
            $grade = strtoupper(trim((string)($att['grade'] ?? '')));
            $has_score = ($att['total_score'] !== null && $att['total_score'] !== '');
            $has_valid_entry = $has_score || ($grade !== '' && $grade !== '-' && $grade !== '—');

            if (!$has_valid_entry) {
                continue;
            }

            $cu = (int)($att['credit_units_snapshot'] ?? ($att['credit_units'] ?? 0));
            $is_abs = ($grade === 'ABS');

            if ($is_abs && !$this->CI->academic_policy->abs_counts_in_tcr()) {
                // If policy excludes ABS from TCR, do not count
                continue;
            }

            $reported_credits += $cu;
            $qp = isset($att['quality_point']) && $att['quality_point'] !== null
                ? (float)$att['quality_point']
                : ((float)($att['grade_point'] ?? 0) * $cu);
            $quality_points += $qp;

            if ($this->CI->academic_policy->is_passing_grade($grade)) {
                $earn_key = strtoupper(trim((string)($att['course_code'] ?? ''))) ?: ($att['course_id'] ?? $cid);
                if (!isset($earned_course_keys[$earn_key])) {
                    $earned_course_keys[$earn_key] = true;
                    $earned_credits += $cu;
                }
            }
        }

        // Calculate registered credits total (deduplicated by course_code)
        $registered_credits_sum = 0;
        $seen_reg_keys = [];
        foreach ($registered_courses as $cid => $cinfo) {
            $norm_code = strtoupper(trim((string)($cinfo['course_code'] ?? '')));
            $key = ($norm_code !== '') ? $norm_code : $cid;
            if (isset($seen_reg_keys[$key])) {
                continue;
            }
            $seen_reg_keys[$key] = true;
            $registered_credits_sum += (int)($cinfo['credit_units'] ?? 0);
            $att = $latest_attempts[$key] ?? ($latest_attempts[$cid] ?? null);
            if (!$att) {
                $unscored_courses_count++;
            } else {
                $grd = strtoupper(trim((string)($att['grade'] ?? '')));
                if (($att['total_score'] === null || $att['total_score'] === '') && ($grd === '' || $grd === '-')) {
                    $unscored_courses_count++;
                }
            }
        }

        // Denominator resolution
        if ($denominator_mode === 'registered') {
            // Old legacy broadsheet rule: max(registered, reported)
            $tcr = max($registered_credits_sum, $reported_credits);
        } else {
            // Standard NUC/BMAS: only reported attempts determine current TCR/GPA denominator
            $tcr = $reported_credits;
        }

        $gpa = ($tcr > 0) ? round($quality_points / $tcr, 2) : 0.00;
        $pending_credits = max(0, $registered_credits_sum - $reported_credits);
        $is_complete = ($pending_credits === 0 && $unscored_courses_count === 0);

        return [
            'registered_credits' => $tcr,
            'earned_credits'     => $earned_credits,
            'quality_points'     => $quality_points,
            'gpa'                => number_format($gpa, 2, '.', ''),
            'cgpa'               => number_format($gpa, 2, '.', ''),
            'reported_credits'   => $reported_credits,
            'registered_credits_total' => $registered_credits_sum,
            'pending_credits'    => $pending_credits,
            'is_complete'        => $is_complete,
        ];
    }

    /**
     * Formats numeric score and letter grade into a clean standard string (e.g. "80A", "ABS", "NR", "-")
     */
    public function format_score_grade($score, $grade)
    {
        $grade_upper = strtoupper(trim((string)$grade));
        if ($grade_upper === 'ABS') {
            return 'ABS';
        }
        if ($grade_upper === 'NR') {
            return 'NR';
        }
        if ($score === null || $score === '') {
            return $grade ?: '-';
        }
        $val = (float)$score;
        $score_str = ((float)(int)$val === $val) ? (string)(int)$val : number_format($val, 1);
        return $score_str . ($grade ?: '');
    }

    /**
     * Converts a carryover_corrections DB row into an attempt-compatible array.
     */
    public function correction_to_attempt(array $correction)
    {
        $cu = (int)($correction['credit_units'] ?? 0);
        $gp = (float)($correction['grade_point'] ?? 0);
        $qp = isset($correction['quality_point']) && $correction['quality_point'] !== null
            ? (float)$correction['quality_point']
            : ($cu * $gp);

        return [
            'id'                          => $correction['result_attempt_id'] ?? $correction['id'],
            'student_id'                  => $correction['student_id'],
            'course_id'                   => $correction['course_id'],
            'course_code'                 => $correction['course_code'] ?? '',
            'course_title'                => $correction['course_title'] ?? '',
            'credit_units'                => $cu,
            'credit_units_snapshot'       => $cu,
            'ca_score'                    => $correction['ca_score'] ?? null,
            'exam_score'                  => $correction['exam_score'] ?? null,
            'total_score'                 => $correction['total_score'],
            'grade'                       => $correction['grade'],
            'grade_point'                 => $gp,
            'quality_point'               => $qp,
            'session_id'                  => $correction['session_id'],
            'semester_id'                 => $correction['semester_id'],
            'session_name'                => $correction['session_name'] ?? '',
            'semester_name'               => $correction['semester_name'] ?? '',
            'level'                       => $correction['level'] ?? ($correction['semester_name'] ?? ''),
            'batch_level'                 => $correction['batch_level'] ?? ($correction['level'] ?? ($correction['semester_name'] ?? '')),
            'created_at'                  => $correction['created_at'] ?? '',
            'updated_at'                  => $correction['updated_at'] ?? '',
            '_effective_contact'          => $correction['_effective_contact'] ?? null,
            '_from_carryover_correction'  => true
        ];
    }
}

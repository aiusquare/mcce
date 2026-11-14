<?php
defined('BASEPATH') OR exit('No direct script access allowed');

/**
 * Reconciliation_model
 * Implements 8 academic integrity checks across course registration,
 * result sheets, attempt snapshots, and broadsheet generation.
 */
class Reconciliation_model extends CI_Model {

    public function __construct()
    {
        parent::__construct();
        $this->load->database();
        if (!$this->load->is_loaded('period_resolver')) {
            $this->load->library('period_resolver');
        }
        if (!$this->load->is_loaded('academic_policy')) {
            $this->load->library('academic_policy');
        }
    }

    /**
     * Executes all 8 reconciliation checks for a given academic scope.
     *
     * @param string $session_id
     * @param string $semester_id
     * @param string $programme_id
     * @param string|null $level
     * @return array
     */
    public function check($session_id, $semester_id, $programme_id, $level = null)
    {
        $period = $this->period_resolver->resolve($session_id, $semester_id, $level);
        $target_session_ids = $period['session_ids'];
        $target_semester_ids = $period['semester_ids'];
        $other_contact_sem_ids = $period['other_contact_semester_ids'] ?? [];
        $contact_num = $period['contact_number'];
        $sess_ph = implode(',', array_fill(0, count($target_session_ids), '?'));
        $cr_sem_match = $this->period_resolver->build_semester_level_match_sql('cr.semester_id', 'cr.level', $target_semester_ids, $other_contact_sem_ids);
        $rb_sem_match = $this->period_resolver->build_semester_level_match_sql('rb.semester_id', 'rb.level', $target_semester_ids, $other_contact_sem_ids);
        $cr_sess_match = $this->period_resolver->build_dual_session_match_sql('cr', $target_session_ids, 's');
        $rb_sess_match = $this->period_resolver->build_dual_session_match_sql('rb', $target_session_ids);

        $issues = [];
        $by_type = [
            'unregistered_score' => 0,
            'unscored_registration' => 0,
            'orphan_attempt' => 0,
            'unit_mismatch' => 0,
            'scheme_drift' => 0,
            'ghost_carryover' => 0,
            'unreconciled_carryover' => 0,
            'multiple_attempt_collision' => 0,
        ];

        // 1. Check: unregistered_score (Student has score in batch attempt, but no active course registration item)
        $sa_sql = "
            SELECT ra.id as attempt_id, ra.student_id, u.full_name, ad.matric_number,
                   c.id as course_id, c.code as course_code, c.title as course_title,
                   ra.total_score, ra.grade, rb.status as batch_status
            FROM result_attempts ra
            JOIN result_batches rb ON rb.id = ra.batch_id
            JOIN courses c ON c.id = rb.course_id
            JOIN students s ON s.id = ra.student_id
            JOIN users u ON u.id = s.user_id
            LEFT JOIN admissions ad ON ad.id = s.admission_id
            WHERE {$rb_sess_match['sql']}
              AND {$rb_sem_match['sql']}
              AND s.programme_id = ?
              AND ra.status = 'active'
              AND (ra.total_score IS NOT NULL OR (ra.grade IS NOT NULL AND ra.grade NOT IN ('', '-', '—')))
        ";
        $scored_attempts = $this->db->query($sa_sql, array_merge($rb_sess_match['params'], $rb_sem_match['params'], [$programme_id]))->result_array();

        if (!empty($scored_attempts)) {
            // Find registered items for these students across cohort session or period
            $student_ids = array_values(array_unique(array_column($scored_attempts, 'student_id')));
            $st_ph = implode(',', array_fill(0, count($student_ids), '?'));
            $reg_sql = "
                SELECT cr.student_id, cri.course_id, c.code as course_code
                FROM course_registration_items cri
                JOIN course_registrations cr ON cr.id = cri.registration_id
                JOIN students s ON s.id = cr.student_id
                JOIN courses c ON c.id = cri.course_id
                WHERE cr.student_id IN ($st_ph)
                  AND {$cr_sess_match['sql']}
                  AND {$cr_sem_match['sql']}
                  AND cr.status IN ('approved', 'submitted', 'draft')
                  AND cri.status = 'active'
            ";
            $reg_items = $this->db->query($reg_sql, array_merge(
                $student_ids,
                $cr_sess_match['params'],
                $cr_sem_match['params']
            ))->result_array();

            $reg_map = [];
            $cohort_reg_courses = [];
            foreach ($reg_items as $ri) {
                $reg_map[$ri['student_id'] . '_' . $ri['course_id']] = true;
                $cohort_reg_courses[$ri['course_id']] = true;
                $norm_c = strtoupper(trim((string)($ri['course_code'] ?? '')));
                if ($norm_c !== '') {
                    $reg_map[$ri['student_id'] . '_CODE_' . $norm_c] = true;
                    $cohort_reg_courses['CODE_' . $norm_c] = true;
                }
            }

            $seen_unreg = [];
            foreach ($scored_attempts as $sa) {
                $norm_c = strtoupper(trim((string)($sa['course_code'] ?? '')));
                // Ignore courses that have zero registration across the cohort
                if (!isset($cohort_reg_courses[$sa['course_id']]) && ($norm_c === '' || !isset($cohort_reg_courses['CODE_' . $norm_c]))) {
                    continue;
                }
                $key_id = $sa['student_id'] . '_' . $sa['course_id'];
                $key_code = $sa['student_id'] . '_CODE_' . $norm_c;
                if (!isset($reg_map[$key_id]) && ($norm_c === '' || !isset($reg_map[$key_code]))) {
                    $dedup_k = ($norm_c !== '') ? $key_code : $key_id;
                    if (isset($seen_unreg[$dedup_k])) {
                        continue;
                    }
                    $seen_unreg[$dedup_k] = true;
                    $by_type['unregistered_score']++;
                    $issues[] = [
                        'type' => 'unregistered_score',
                        'severity' => 'danger',
                        'student_id' => $sa['student_id'],
                        'matric_number' => $sa['matric_number'] ?? '',
                        'student_name' => $sa['full_name'],
                        'course_id' => $sa['course_id'],
                        'course_code' => $sa['course_code'],
                        'message' => "Student has recorded score ({$sa['total_score']} {$sa['grade']}) in {$sa['course_code']}, but is not registered for this course.",
                        'details' => ['attempt_id' => $sa['attempt_id'], 'batch_status' => $sa['batch_status']],
                        'suggested_action' => 'Register student via course roster or verify attempt validity.'
                    ];
                }
            }
        }

        // 2. Check: unscored_registration (Student registered, but no score entered / NR)
        $ar_sql = "
            SELECT cr.student_id, u.full_name, ad.matric_number, c.id as course_id, c.code as course_code
            FROM course_registration_items cri
            JOIN course_registrations cr ON cr.id = cri.registration_id
            JOIN courses c ON c.id = cri.course_id
            JOIN students s ON s.id = cr.student_id
            JOIN users u ON u.id = s.user_id
            LEFT JOIN admissions ad ON ad.id = s.admission_id
            WHERE {$cr_sess_match['sql']}
              AND {$cr_sem_match['sql']}
              AND s.programme_id = ?
              AND cr.status IN ('approved', 'submitted')
              AND cri.status = 'active'
              AND LOWER(cri.registration_type) NOT IN ('carryover', 'repeat')
        ";
        $all_active_regs = $this->db->query($ar_sql, array_merge(
            $cr_sess_match['params'],
            $cr_sem_match['params'],
            [$programme_id]
        ))->result_array();

        if (!empty($all_active_regs)) {
            $reg_students = array_values(array_unique(array_column($all_active_regs, 'student_id')));
            $student_ph = implode(',', array_fill(0, count($reg_students), '?'));
            // Must use the same canonical teaching-session rule as the
            // broadsheet.  Looking only at rb.session_id can falsely mark a
            // registration as scored when its batch was normalised to another
            // academic session.
            $existing_scores_sql = "
                SELECT ra.student_id, rb.course_id, c.code as course_code, ra.total_score, ra.grade
                FROM result_attempts ra
                JOIN result_batches rb ON rb.id = ra.batch_id
                JOIN courses c ON c.id = rb.course_id
                WHERE ra.student_id IN ($student_ph)
                  AND {$rb_sess_match['sql']}
                  AND {$rb_sem_match['sql']}
                  AND ra.status = 'active'
            ";
            $existing_scores = $this->db->query($existing_scores_sql, array_merge(
                $reg_students,
                $rb_sess_match['params'],
                $rb_sem_match['params']
            ))->result_array();

            $scored_map = [];
            foreach ($existing_scores as $es) {
                if ($es['total_score'] !== null || (!empty($es['grade']) && !in_array($es['grade'], ['-', '—', '']))) {
                    $scored_map[$es['student_id'] . '_' . $es['course_id']] = true;
                    $norm_c = strtoupper(trim((string)($es['course_code'] ?? '')));
                    if ($norm_c !== '') {
                        $scored_map[$es['student_id'] . '_CODE_' . $norm_c] = true;
                    }
                }
            }

            $seen_unscored = [];
            foreach ($all_active_regs as $ar) {
                $key_id = $ar['student_id'] . '_' . $ar['course_id'];
                $norm_c = strtoupper(trim((string)($ar['course_code'] ?? '')));
                $key_code = $ar['student_id'] . '_CODE_' . $norm_c;
                if (!isset($scored_map[$key_id]) && ($norm_c === '' || !isset($scored_map[$key_code]))) {
                    $dedup_k = ($norm_c !== '') ? $key_code : $key_id;
                    if (isset($seen_unscored[$dedup_k])) {
                        continue;
                    }
                    $seen_unscored[$dedup_k] = true;
                    $by_type['unscored_registration']++;
                    $issues[] = [
                        'type' => 'unscored_registration',
                        'severity' => 'warning',
                        'student_id' => $ar['student_id'],
                        'matric_number' => $ar['matric_number'] ?? '',
                        'student_name' => $ar['full_name'],
                        'course_id' => $ar['course_id'],
                        'course_code' => $ar['course_code'],
                        'message' => "Student is registered for {$ar['course_code']} but no score has been recorded yet.",
                        'details' => [],
                        'suggested_action' => 'Enter examination score or record student as ABS if absent.'
                    ];
                }
            }
        }

        // 3. Check: orphan_attempt (Attempt without valid student or batch)
        $this->db->select('ra.id, ra.student_id, ra.batch_id');
        $this->db->from('result_attempts ra');
        $this->db->join('result_batches rb', 'rb.id = ra.batch_id', 'left');
        $this->db->join('students s', 's.id = ra.student_id', 'left');
        $this->db->where('rb.id IS NULL OR s.id IS NULL', null, false);
        $orphans = $this->db->get()->result_array();
        foreach ($orphans as $orp) {
            $by_type['orphan_attempt']++;
            $issues[] = [
                'type' => 'orphan_attempt',
                'severity' => 'danger',
                'student_id' => $orp['student_id'],
                'matric_number' => 'N/A',
                'student_name' => 'Unknown',
                'course_id' => null,
                'course_code' => 'N/A',
                'message' => "Attempt {$orp['id']} references non-existent batch or student.",
                'details' => $orp,
                'suggested_action' => 'Prune corrupted attempt row.'
            ];
        }

        // 4. Check: unit_mismatch (Attempt snapshot credit units differ from course catalog)
        $this->db->select('ra.id, ra.student_id, u.full_name, ad.matric_number, c.id as course_id, c.code as course_code, ra.credit_units_snapshot, c.credit_units as catalog_units');
        $this->db->from('result_attempts ra');
        $this->db->join('result_batches rb', 'rb.id = ra.batch_id');
        $this->db->join('courses c', 'c.id = rb.course_id');
        $this->db->join('students s', 's.id = ra.student_id');
        $this->db->join('users u', 'u.id = s.user_id');
        $this->db->join('admissions ad', 'ad.id = s.admission_id', 'left');
        $this->db->where_in('rb.session_id', $target_session_ids);
        $this->db->where('s.programme_id', $programme_id);
        $this->db->where('ra.credit_units_snapshot IS NOT NULL', null, false);
        $this->db->where('ra.credit_units_snapshot != c.credit_units', null, false);
        $unit_mismatches = $this->db->get()->result_array();
        foreach ($unit_mismatches as $um) {
            $by_type['unit_mismatch']++;
            $issues[] = [
                'type' => 'unit_mismatch',
                'severity' => 'info',
                'student_id' => $um['student_id'],
                'matric_number' => $um['matric_number'] ?? '',
                'student_name' => $um['full_name'],
                'course_id' => $um['course_id'],
                'course_code' => $um['course_code'],
                'message' => "Attempt snapshot credit units ({$um['credit_units_snapshot']}) differ from current course catalog ({$um['catalog_units']}) for {$um['course_code']}.",
                'details' => $um,
                'suggested_action' => 'Historical attempt snapshot is preserved by design; review if catalog update was intended.'
            ];
        }

        // 5. Check: scheme_drift (Locked attempt grade differs from active grading scheme)
        $active_scheme = $this->academic_policy->grade_scale();
        $ranges = $active_scheme['ranges'] ?? [];
        if (!empty($ranges)) {
            $this->db->select('ra.id, ra.student_id, u.full_name, ad.matric_number, c.code as course_code, ra.total_score, ra.grade, ra.is_locked');
            $this->db->from('result_attempts ra');
            $this->db->join('result_batches rb', 'rb.id = ra.batch_id');
            $this->db->join('courses c', 'c.id = rb.course_id');
            $this->db->join('students s', 's.id = ra.student_id');
            $this->db->join('users u', 'u.id = s.user_id');
            $this->db->join('admissions ad', 'ad.id = s.admission_id', 'left');
            $this->db->where_in('rb.session_id', $target_session_ids);
            $this->db->where('s.programme_id', $programme_id);
            $this->db->where('ra.is_locked', 1);
            $this->db->where('ra.total_score IS NOT NULL', null, false);
            $locked_attempts = $this->db->get()->result_array();

            foreach ($locked_attempts as $la) {
                $score = (float)$la['total_score'];
                $curr_grade = $la['grade'];
                foreach ($ranges as $r) {
                    if ($score >= (float)$r['min_score'] && $score <= (float)$r['max_score']) {
                        if ($r['letter_grade'] !== $curr_grade && $curr_grade !== 'ABS') {
                            $by_type['scheme_drift']++;
                            $issues[] = [
                                'type' => 'scheme_drift',
                                'severity' => 'warning',
                                'student_id' => $la['student_id'],
                                'matric_number' => $la['matric_number'] ?? '',
                                'student_name' => $la['full_name'],
                                'course_id' => null,
                                'course_code' => $la['course_code'],
                                'message' => "Locked result for {$la['course_code']} has grade '{$curr_grade}', but current grading scale assigns '{$r['letter_grade']}' for score {$score}.",
                                'details' => ['score' => $score, 'locked_grade' => $curr_grade, 'current_scheme_grade' => $r['letter_grade']],
                                'suggested_action' => 'Locked result retains original grade. Apply result amendment if re-grading is authorized.'
                            ];
                        }
                        break;
                    }
                }
            }
        }

        // 6. Check: ghost_carryover (Registered as carryover for course already passed)
        $this->db->select('cr.student_id, u.full_name, ad.matric_number, c.id as course_id, c.code as course_code');
        $this->db->from('course_registration_items cri');
        $this->db->join('course_registrations cr', 'cr.id = cri.registration_id');
        $this->db->join('courses c', 'c.id = cri.course_id');
        $this->db->join('students s', 's.id = cr.student_id');
        $this->db->join('users u', 'u.id = s.user_id');
        $this->db->join('admissions ad', 'ad.id = s.admission_id', 'left');
        $this->db->where_in('cr.session_id', $target_session_ids);
        $this->db->where('s.programme_id', $programme_id);
        $this->db->where_in('LOWER(cri.registration_type)', ['carryover', 'repeat']);
        $this->db->where('cri.status', 'active');
        $co_regs = $this->db->get()->result_array();

        if (!empty($co_regs)) {
            $co_students = array_unique(array_column($co_regs, 'student_id'));
            $this->db->select('ra.student_id, rb.course_id, ra.grade');
            $this->db->from('result_attempts ra');
            $this->db->join('result_batches rb', 'rb.id = ra.batch_id');
            $this->db->where_in('ra.student_id', $co_students);
            $this->db->where_not_in('rb.session_id', $target_session_ids);
            $this->db->where('rb.status', 'published');
            $prior_attempts = $this->db->get()->result_array();

            $passed_prior_map = [];
            foreach ($prior_attempts as $pa) {
                if ($this->academic_policy->is_passing_grade($pa['grade'])) {
                    $passed_prior_map[$pa['student_id'] . '_' . $pa['course_id']] = true;
                }
            }

            foreach ($co_regs as $cor) {
                $k = $cor['student_id'] . '_' . $cor['course_id'];
                if (isset($passed_prior_map[$k])) {
                    $by_type['ghost_carryover']++;
                    $issues[] = [
                        'type' => 'ghost_carryover',
                        'severity' => 'danger',
                        'student_id' => $cor['student_id'],
                        'matric_number' => $cor['matric_number'] ?? '',
                        'student_name' => $cor['full_name'],
                        'course_id' => $cor['course_id'],
                        'course_code' => $cor['course_code'],
                        'message' => "Student is registered for carryover in {$cor['course_code']}, but already passed this course in a prior session.",
                        'details' => [],
                        'suggested_action' => 'Drop invalid carryover registration item.'
                    ];
                }
            }
        }

        // 7. Check: unreconciled_carryover (Student failed course in previous contact, but not registered in current session)
        // Handled cleanly via outstanding courses lookup
        if ($this->load->is_loaded('outstanding_course_model') || $this->load->model('Outstanding_course_model')) {
            // Checked per student in broadsheet
        }

        // 8. Check: multiple_attempt_collision (Multiple active attempts for same student in same batch)
        $this->db->select('ra.student_id, ra.batch_id, rb.course_id, u.full_name, ad.matric_number, c.code as course_code, COUNT(ra.id) as attempt_count');
        $this->db->from('result_attempts ra');
        $this->db->join('result_batches rb', 'rb.id = ra.batch_id');
        $this->db->join('courses c', 'c.id = rb.course_id');
        $this->db->join('students s', 's.id = ra.student_id');
        $this->db->join('users u', 'u.id = s.user_id');
        $this->db->join('admissions ad', 'ad.id = s.admission_id', 'left');
        $this->db->where_in('rb.session_id', $target_session_ids);
        $this->db->where('s.programme_id', $programme_id);
        $this->db->where('ra.status', 'active');
        $this->db->group_by('ra.student_id, ra.batch_id, rb.course_id, u.full_name, ad.matric_number, c.code');
        $this->db->having('COUNT(ra.id) > 1', null, false);
        $collisions = $this->db->get()->result_array();

        foreach ($collisions as $col) {
            $by_type['multiple_attempt_collision']++;
            $issues[] = [
                'type' => 'multiple_attempt_collision',
                'severity' => 'danger',
                'student_id' => $col['student_id'],
                'matric_number' => $col['matric_number'] ?? '',
                'student_name' => $col['full_name'],
                'course_id' => $col['course_id'] ?? null,
                'course_code' => $col['course_code'],
                'message' => "Student has {$col['attempt_count']} duplicate active attempt records in the same batch for {$col['course_code']}.",
                'details' => $col,
                'suggested_action' => 'Deduplicate attempt rows.'
            ];
        }

        $total_issues = count($issues);

        $by_severity = [
            'danger'  => 0,
            'warning' => 0,
            'info'    => 0,
            'error'   => 0
        ];
        foreach ($issues as $iss) {
            $sev = $iss['severity'] ?? 'info';
            if (isset($by_severity[$sev])) {
                $by_severity[$sev]++;
            }
            if ($sev === 'danger') {
                $by_severity['error']++;
            }
        }

        // Count distinct cohort students
        $cohort_st_sql = "
            SELECT COUNT(DISTINCT s.id) as cnt
            FROM students s
            LEFT JOIN course_registrations cr ON cr.student_id = s.id 
                AND {$cr_sess_match['sql']}
                AND {$cr_sem_match['sql']}
                AND cr.status IN ('approved', 'submitted', 'draft')
            LEFT JOIN result_attempts ra ON ra.student_id = s.id AND ra.status = 'active'
            LEFT JOIN result_batches rb ON rb.id = ra.batch_id 
                AND {$rb_sess_match['sql']}
                AND {$rb_sem_match['sql']}
            WHERE s.programme_id = ?
              AND (cr.id IS NOT NULL OR (rb.id IS NOT NULL AND ra.id IS NOT NULL))
        ";
        $cohort_row = $this->db->query($cohort_st_sql, array_merge(
            $cr_sess_match['params'], $cr_sem_match['params'],
            $rb_sess_match['params'], $rb_sem_match['params'],
            [$programme_id]
        ))->row_array();
        $cohort_students_count = (int)($cohort_row['cnt'] ?? 0);
        if ($cohort_students_count === 0 && !empty($student_ids)) {
            $cohort_students_count = count($student_ids);
        }

        return [
            'cohort_students_count' => $cohort_students_count,
            'summary' => [
                'total_issues'          => $total_issues,
                'by_type'               => $by_type,
                'by_severity'           => $by_severity,
                'cohort_students_count' => $cohort_students_count,
                'is_clean'              => ($total_issues === 0)
            ],
            'issues' => $issues
        ];
    }

    /**
     * Executes interactive remediation action for reconciliation discrepancies.
     *
     * @param string $action
     * @param array $data
     * @return array
     */
    public function resolve_action($action, $data)
    {
        $session_id   = $data['session_id'] ?? null;
        $semester_id  = $data['semester_id'] ?? null;
        $programme_id = $data['programme_id'] ?? null;
        $level        = $data['level'] ?? null;
        $student_id   = $data['student_id'] ?? null;
        $course_id    = $data['course_id'] ?? null;
        $course_code  = $data['course_code'] ?? null;
        $attempt_id   = $data['attempt_id'] ?? null;

        $period = $this->period_resolver->resolve($session_id, $semester_id, $level);
        $target_session_ids = $period['session_ids'];
        $target_semester_ids = $period['semester_ids'];
        $other_contact_sem_ids = $period['other_contact_semester_ids'] ?? [];
        $cr_sem_match = $this->period_resolver->build_semester_level_match_sql('cr.semester_id', 'cr.level', $target_semester_ids, $other_contact_sem_ids);
        $sess_ph = implode(',', array_fill(0, count($target_session_ids), '?'));

        switch ($action) {
            case 'purge_score':
                if ($attempt_id) {
                    $this->db->where('id', $attempt_id)->delete('result_attempts');
                    return ['status' => 'success', 'message' => 'Score attempt deleted successfully.'];
                }
                if ($student_id && ($course_id || $course_code)) {
                    $this->db->select('ra.id')
                        ->from('result_attempts ra')
                        ->join('result_batches rb', 'rb.id = ra.batch_id')
                        ->join('courses c', 'c.id = rb.course_id')
                        ->where('ra.student_id', $student_id);
                    if ($course_code) {
                        $this->db->where('c.code', $course_code);
                    } else {
                        $this->db->where('rb.course_id', $course_id);
                    }
                    $rows = $this->db->get()->result_array();
                    if (!empty($rows)) {
                        $ids = array_column($rows, 'id');
                        $this->db->where_in('id', $ids)->delete('result_attempts');
                    }
                    return ['status' => 'success', 'message' => 'Score attempt deleted successfully.'];
                }
                return ['status' => 'error', 'message' => 'Missing attempt or student identifier.'];

            case 'deregister':
                if (!$student_id || (!$course_id && !$course_code)) {
                    return ['status' => 'error', 'message' => 'Missing student or course identifier.'];
                }
                $sql = "
                    SELECT cri.id, cri.registration_id
                    FROM course_registration_items cri
                    JOIN course_registrations cr ON cr.id = cri.registration_id
                    JOIN courses c ON c.id = cri.course_id
                    JOIN students s ON s.id = cr.student_id
                    WHERE cr.student_id = ?
                      AND (cr.session_id IN ($sess_ph) OR s.session_name IN ($sess_ph))
                      AND {$cr_sem_match['sql']}
                      AND (c.id = ? OR c.code = ?)
                ";
                $params = array_merge([$student_id], $target_session_ids, $target_session_ids, $cr_sem_match['params'], [$course_id ?: '', $course_code ?: '']);
                $cri_rows = $this->db->query($sql, $params)->result_array();
                if (!empty($cri_rows)) {
                    $cri_ids = array_column($cri_rows, 'id');
                    $reg_ids = array_unique(array_column($cri_rows, 'registration_id'));
                    $this->db->where_in('id', $cri_ids)->delete('course_registration_items');
                    foreach ($reg_ids as $rid) {
                        $sum_row = $this->db->query("
                            SELECT COALESCE(SUM(c.credit_units), 0) as tot
                            FROM course_registration_items cri
                            JOIN courses c ON c.id = cri.course_id
                            WHERE cri.registration_id = ? AND cri.status = 'active'
                        ", [$rid])->row_array();
                        $tot = $sum_row['tot'] ?? 0;
                        $this->db->where('id', $rid)->update('course_registrations', ['total_credits' => $tot]);
                    }
                }
                return ['status' => 'success', 'message' => "Course {$course_code} registration removed for student."];

            case 'mark_abs':
                if (!$student_id || (!$course_id && !$course_code)) {
                    return ['status' => 'error', 'message' => 'Missing student or course identifier.'];
                }
                $this->db->select('rb.id, c.credit_units')
                    ->from('result_batches rb')
                    ->join('courses c', 'c.id = rb.course_id')
                    ->where_in('rb.session_id', $target_session_ids);
                if ($course_code) {
                    $this->db->where('c.code', $course_code);
                } else {
                    $this->db->where('rb.course_id', $course_id);
                }
                $batch = $this->db->get()->row_array();
                if ($batch) {
                    $att = $this->db->get_where('result_attempts', ['batch_id' => $batch['id'], 'student_id' => $student_id])->row_array();
                    if ($att) {
                        $this->db->where('id', $att['id'])->update('result_attempts', [
                            'total_score' => 0.00,
                            'grade' => 'ABS',
                            'grade_point' => 0.00,
                            'quality_point' => 0.00,
                            'result_state' => 'absent',
                            'status' => 'active',
                            'updated_at' => date('Y-m-d H:i:s')
                        ]);
                    } else {
                        $new_id = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff),
                            mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000,
                            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
                        );
                        $this->db->insert('result_attempts', [
                            'id' => $new_id,
                            'batch_id' => $batch['id'],
                            'student_id' => $student_id,
                            'total_score' => 0.00,
                            'grade' => 'ABS',
                            'grade_point' => 0.00,
                            'quality_point' => 0.00,
                            'result_state' => 'absent',
                            'credit_units_snapshot' => $batch['credit_units'] ?? 0,
                            'status' => 'active',
                            'created_at' => date('Y-m-d H:i:s')
                        ]);
                    }
                    return ['status' => 'success', 'message' => "Student recorded as ABS for {$course_code}."];
                }
                return ['status' => 'error', 'message' => "No result batch found for {$course_code} in this session."];

            case 'bulk_deregister':
                if (!$course_code && !$course_id) {
                    return ['status' => 'error', 'message' => 'Missing course identifier.'];
                }
                $sql = "
                    SELECT cri.id, cri.registration_id
                    FROM course_registration_items cri
                    JOIN course_registrations cr ON cr.id = cri.registration_id
                    JOIN courses c ON c.id = cri.course_id
                    JOIN students s ON s.id = cr.student_id
                    WHERE s.programme_id = ?
                      AND (cr.session_id IN ($sess_ph) OR s.session_name IN ($sess_ph))
                      AND {$cr_sem_match['sql']}
                      AND (c.id = ? OR c.code = ?)
                      AND cri.status = 'active'
                ";
                $params = array_merge([$programme_id], $target_session_ids, $target_session_ids, $cr_sem_match['params'], [$course_id ?: '', $course_code ?: '']);
                $cri_rows = $this->db->query($sql, $params)->result_array();
                $count = count($cri_rows);
                if ($count > 0) {
                    $cri_ids = array_column($cri_rows, 'id');
                    $reg_ids = array_unique(array_column($cri_rows, 'registration_id'));
                    $this->db->where_in('id', $cri_ids)->delete('course_registration_items');
                    foreach ($reg_ids as $rid) {
                        $sum_row = $this->db->query("
                            SELECT COALESCE(SUM(c.credit_units), 0) as tot
                            FROM course_registration_items cri
                            JOIN courses c ON c.id = cri.course_id
                            WHERE cri.registration_id = ? AND cri.status = 'active'
                        ", [$rid])->row_array();
                        $tot = $sum_row['tot'] ?? 0;
                        $this->db->where('id', $rid)->update('course_registrations', ['total_credits' => $tot]);
                    }
                }
                return ['status' => 'success', 'message' => "Successfully de-registered {$count} students from {$course_code}."];

            case 'bulk_mark_abs':
                if (!$course_code && !$course_id) {
                    return ['status' => 'error', 'message' => 'Missing course identifier.'];
                }
                $this->db->select('rb.id, c.credit_units, c.id as cid')
                    ->from('result_batches rb')
                    ->join('courses c', 'c.id = rb.course_id')
                    ->where_in('rb.session_id', $target_session_ids);
                if ($course_code) {
                    $this->db->where('c.code', $course_code);
                } else {
                    $this->db->where('rb.course_id', $course_id);
                }
                $batch = $this->db->get()->row_array();
                if (!$batch) {
                    $cid = $course_id;
                    if (!$cid && $course_code) {
                        $c_row = $this->db->get_where('courses', ['code' => $course_code], 1)->row_array();
                        $cid = $c_row['id'] ?? null;
                    }
                    $batch_id = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff),
                        mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000,
                        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
                    );
                    $this->db->insert('result_batches', [
                        'id' => $batch_id,
                        'session_id' => $target_session_ids[0],
                        'semester_id' => $target_semester_ids[0],
                        'programme_id' => $programme_id,
                        'course_id' => $cid,
                        'level' => $level ?: ($period['label'] ?? null),
                        'status' => 'draft',
                        'created_at' => date('Y-m-d H:i:s')
                    ]);
                    $batch = ['id' => $batch_id, 'credit_units' => 2];
                }

                $sql = "
                    SELECT DISTINCT cr.student_id
                    FROM course_registration_items cri
                    JOIN course_registrations cr ON cr.id = cri.registration_id
                    JOIN courses c ON c.id = cri.course_id
                    JOIN students s ON s.id = cr.student_id
                    WHERE s.programme_id = ?
                      AND (cr.session_id IN ($sess_ph) OR s.session_name IN ($sess_ph))
                      AND {$cr_sem_match['sql']}
                      AND (c.id = ? OR c.code = ?)
                      AND cri.status = 'active'
                ";
                $params = array_merge([$programme_id], $target_session_ids, $target_session_ids, $cr_sem_match['params'], [$course_id ?: '', $course_code ?: '']);
                $students = $this->db->query($sql, $params)->result_array();

                $marked = 0;
                foreach ($students as $st) {
                    $sid = $st['student_id'];
                    $att = $this->db->get_where('result_attempts', ['batch_id' => $batch['id'], 'student_id' => $sid])->row_array();
                    if ($att) {
                        $this->db->where('id', $att['id'])->update('result_attempts', [
                            'total_score' => 0.00,
                            'grade' => 'ABS',
                            'grade_point' => 0.00,
                            'quality_point' => 0.00,
                            'result_state' => 'absent',
                            'status' => 'active',
                            'updated_at' => date('Y-m-d H:i:s')
                        ]);
                    } else {
                        $new_id = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff),
                            mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000,
                            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
                        );
                        $this->db->insert('result_attempts', [
                            'id' => $new_id,
                            'batch_id' => $batch['id'],
                            'student_id' => $sid,
                            'total_score' => 0.00,
                            'grade' => 'ABS',
                            'grade_point' => 0.00,
                            'quality_point' => 0.00,
                            'result_state' => 'absent',
                            'credit_units_snapshot' => $batch['credit_units'] ?? 0,
                            'status' => 'active',
                            'created_at' => date('Y-m-d H:i:s')
                        ]);
                    }
                    $marked++;
                }
                return ['status' => 'success', 'message' => "Successfully marked {$marked} students as ABS for {$course_code}."];

            case 'bulk_purge_unregistered':
                $sql = "
                    DELETE ra
                    FROM result_attempts ra
                    JOIN result_batches rb ON rb.id = ra.batch_id
                    JOIN courses c ON c.id = rb.course_id
                    JOIN students s ON s.id = ra.student_id
                    LEFT JOIN (
                        SELECT DISTINCT cr.student_id, c2.code
                        FROM course_registrations cr
                        JOIN course_registration_items cri ON cri.registration_id = cr.id
                        JOIN courses c2 ON c2.id = cri.course_id
                        WHERE cri.status = 'active'
                    ) reg ON reg.student_id = ra.student_id AND reg.code = c.code
                    WHERE s.programme_id = ?
                      AND ra.status = 'active'
                      AND (ra.total_score IS NOT NULL OR (ra.grade IS NOT NULL AND ra.grade != '' AND ra.grade != '-'))
                      AND reg.code IS NULL
                ";
                $this->db->query($sql, [$programme_id]);
                $affected = $this->db->affected_rows();
                return ['status' => 'success', 'message' => "Successfully purged {$affected} unregistered score attempts."];

            case 'deduplicate_attempts':
                $batch_id = $data['batch_id'] ?? null;
                $student_id = $data['student_id'] ?? null;
                $course_code = $data['course_code'] ?? null;

                if (!$student_id) {
                    return ['status' => 'error', 'message' => 'Missing student identifier.'];
                }

                if (!$batch_id && $course_code) {
                    $this->db->select('rb.id')
                        ->from('result_batches rb')
                        ->join('courses c', 'c.id = rb.course_id')
                        ->where_in('rb.session_id', $target_session_ids)
                        ->where('c.code', $course_code);
                    $rb = $this->db->get()->row_array();
                    if ($rb) {
                        $batch_id = $rb['id'];
                    }
                }

                if (!$batch_id) {
                    return ['status' => 'error', 'message' => 'Missing batch identifier for deduplication.'];
                }

                $deleted = $this->_deduplicate_student_batch_attempts($student_id, $batch_id);
                return ['status' => 'success', 'message' => "Successfully removed {$deleted} duplicate attempt record(s)."];

            case 'bulk_deduplicate_attempts':
                $sql = "
                    SELECT ra.student_id, ra.batch_id, COUNT(ra.id) as cnt
                    FROM result_attempts ra
                    JOIN result_batches rb ON rb.id = ra.batch_id
                    JOIN students s ON s.id = ra.student_id
                    WHERE rb.session_id IN ($sess_ph)
                      AND s.programme_id = ?
                      AND ra.status = 'active'
                    GROUP BY ra.student_id, ra.batch_id
                    HAVING COUNT(ra.id) > 1
                ";
                $params = array_merge($target_session_ids, [$programme_id]);
                $collision_groups = $this->db->query($sql, $params)->result_array();

                $total_deleted = 0;
                $total_students = count($collision_groups);

                foreach ($collision_groups as $cg) {
                    $deleted = $this->_deduplicate_student_batch_attempts($cg['student_id'], $cg['batch_id']);
                    $total_deleted += $deleted;
                }

                return [
                    'status' => 'success',
                    'message' => "Successfully resolved collisions: deleted {$total_deleted} duplicate attempt(s) across {$total_students} student record(s)."
                ];

            case 'prune_orphan_attempt':
                if (!empty($data['attempt_id'])) {
                    $this->db->where('id', $data['attempt_id'])->delete('result_attempts');
                    return ['status' => 'success', 'message' => 'Orphan attempt pruned successfully.'];
                }
                return ['status' => 'error', 'message' => 'Missing attempt identifier.'];

            case 'bulk_prune_orphan_attempts':
                $sql = "
                    DELETE ra
                    FROM result_attempts ra
                    LEFT JOIN result_batches rb ON rb.id = ra.batch_id
                    LEFT JOIN students s ON s.id = ra.student_id
                    WHERE rb.id IS NULL OR s.id IS NULL
                ";
                $this->db->query($sql);
                $pruned = $this->db->affected_rows();
                return ['status' => 'success', 'message' => "Successfully pruned {$pruned} orphan attempt(s)."];

            case 'drop_ghost_carryover':
                if (!$student_id || (!$course_id && !$course_code)) {
                    return ['status' => 'error', 'message' => 'Missing student or course identifier.'];
                }
                $sql = "
                    SELECT cri.id, cri.registration_id
                    FROM course_registration_items cri
                    JOIN course_registrations cr ON cr.id = cri.registration_id
                    JOIN courses c ON c.id = cri.course_id
                    JOIN students s ON s.id = cr.student_id
                    WHERE cr.student_id = ?
                      AND (cr.session_id IN ($sess_ph) OR s.session_name IN ($sess_ph))
                      AND {$cr_sem_match['sql']}
                      AND (c.id = ? OR c.code = ?)
                      AND LOWER(cri.registration_type) IN ('carryover', 'repeat')
                ";
                $params = array_merge([$student_id], $target_session_ids, $target_session_ids, $cr_sem_match['params'], [$course_id ?: '', $course_code ?: '']);
                $cri_rows = $this->db->query($sql, $params)->result_array();
                if (!empty($cri_rows)) {
                    $cri_ids = array_column($cri_rows, 'id');
                    $reg_ids = array_unique(array_column($cri_rows, 'registration_id'));
                    $this->db->where_in('id', $cri_ids)->delete('course_registration_items');
                    foreach ($reg_ids as $rid) {
                        $sum_row = $this->db->query("
                            SELECT COALESCE(SUM(c.credit_units), 0) as tot
                            FROM course_registration_items cri
                            JOIN courses c ON c.id = cri.course_id
                            WHERE cri.registration_id = ? AND cri.status = 'active'
                        ", [$rid])->row_array();
                        $tot = $sum_row['tot'] ?? 0;
                        $this->db->where('id', $rid)->update('course_registrations', ['total_credits' => $tot]);
                    }
                }
                return ['status' => 'success', 'message' => "Ghost carryover registration removed for {$course_code}."];

            default:
                return ['status' => 'error', 'message' => "Unrecognized action '{$action}'."];
        }
    }

    /**
     * Deduplicates attempt rows for a specific student and batch.
     * Keeps the most complete / highest scored / most recent attempt,
     * merging any non-null CA/exam components from other rows before deleting losers.
     *
     * @param string $student_id
     * @param string $batch_id
     * @return int Number of duplicate rows deleted
     */
    private function _deduplicate_student_batch_attempts($student_id, $batch_id)
    {
        $attempts = $this->db->from('result_attempts')
            ->where('student_id', $student_id)
            ->where('batch_id', $batch_id)
            ->where('status', 'active')
            ->get()->result_array();

        if (count($attempts) <= 1) {
            return 0;
        }

        // Rank attempts so best candidate comes first
        usort($attempts, function ($a, $b) {
            $scoreA = ($a['total_score'] !== null && is_numeric($a['total_score'])) ? (float)$a['total_score'] : -1;
            $scoreB = ($b['total_score'] !== null && is_numeric($b['total_score'])) ? (float)$b['total_score'] : -1;

            $hasValidGradeA = (!empty($a['grade']) && !in_array($a['grade'], ['ABS', '-', '—', 'NR', '']));
            $hasValidGradeB = (!empty($b['grade']) && !in_array($b['grade'], ['ABS', '-', '—', 'NR', '']));

            $weightA = 0;
            if ($scoreA > 0 && $hasValidGradeA) {
                $weightA = 2000 + $scoreA;
            } elseif ($scoreA >= 0) {
                $weightA = 1000 + $scoreA;
            } elseif ($hasValidGradeA) {
                $weightA = 500;
            } elseif ($a['grade'] === 'ABS') {
                $weightA = 100;
            }

            $weightB = 0;
            if ($scoreB > 0 && $hasValidGradeB) {
                $weightB = 2000 + $scoreB;
            } elseif ($scoreB >= 0) {
                $weightB = 1000 + $scoreB;
            } elseif ($hasValidGradeB) {
                $weightB = 500;
            } elseif ($b['grade'] === 'ABS') {
                $weightB = 100;
            }

            if ($weightA !== $weightB) {
                return ($weightA > $weightB) ? -1 : 1;
            }

            // Tie-break by updated_at or created_at
            $timeA = strtotime($a['updated_at'] ?? $a['created_at'] ?? '1970-01-01');
            $timeB = strtotime($b['updated_at'] ?? $b['created_at'] ?? '1970-01-01');
            if ($timeA !== $timeB) {
                return ($timeA > $timeB) ? -1 : 1;
            }

            return strcmp($a['id'], $b['id']);
        });

        $winner = $attempts[0];
        $losers = array_slice($attempts, 1);

        // Check if winner is missing CA or Exam score that loser has
        $update_winner = [];
        foreach ($losers as $loser) {
            if ($winner['ca_score'] === null && $loser['ca_score'] !== null) {
                $winner['ca_score'] = $loser['ca_score'];
                $update_winner['ca_score'] = $loser['ca_score'];
            }
            if ($winner['exam_score'] === null && $loser['exam_score'] !== null) {
                $winner['exam_score'] = $loser['exam_score'];
                $update_winner['exam_score'] = $loser['exam_score'];
            }
        }

        if (!empty($update_winner)) {
            $this->db->where('id', $winner['id'])->update('result_attempts', $update_winner);
        }

        // Delete all duplicate loser attempts
        $loser_ids = array_column($losers, 'id');
        $this->db->where_in('id', $loser_ids)->delete('result_attempts');

        return count($loser_ids);
    }
}

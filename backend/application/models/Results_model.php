<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Results_model extends CI_Model
{
    public function __construct()
    {
        parent::__construct();
        $this->load->database();
        $this->ensure_results_columns();
    }

    public function ensure_results_columns()
    {
        if ($this->db->table_exists('result_batches')) {
            @$this->db->query("ALTER TABLE `result_batches` ROW_FORMAT=DYNAMIC");
        }
    }

    private function generate_uuid()
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }

    // =========================================================================
    // GRADING & CALCULATIONS
    // =========================================================================

    public function get_active_grading_scheme()
    {
        $this->db->where('is_active', 1);
        $scheme = $this->db->get('grading_schemes')->row_array();
        if (!$scheme) return null;

        $this->db->where('scheme_id', $scheme['id']);
        $this->db->order_by('min_score', 'DESC');
        $ranges = $this->db->get('grading_ranges')->result_array();
        
        $scheme['ranges'] = $ranges;
        return $scheme;
    }

    public function save_grading_scheme($name, $ranges, $user_id) {
        $this->db->trans_start();
        $this->db->update('grading_schemes', ['is_active' => 0]);
        $scheme_id = $this->generate_uuid();
        $this->db->insert('grading_schemes', [
            'id' => $scheme_id,
            'name' => $name,
            'is_active' => 1,
            'created_at' => date('Y-m-d H:i:s'),
            'created_by' => $user_id
        ]);
        foreach ($ranges as $range) {
            $this->db->insert('grading_ranges', [
                'id' => $this->generate_uuid(),
                'scheme_id' => $scheme_id,
                'min_score' => $range['min_score'],
                'max_score' => $range['max_score'],
                'letter_grade' => $range['letter_grade'],
                'grade_point' => $range['grade_point'],
                'remark' => $range['remark'] ?? ''
            ]);
        }
        $this->db->trans_complete();

        if ($this->db->trans_status() === FALSE) {
            return false;
        }

        // Auto-recalculate all existing attempts across the whole system
        // using the newly activated grading scheme.
        $this->recalculate_all_grades($user_id);

        return true;
    }

    public function recalculate_all_grades($user_id = null) {
        $scheme = $this->get_active_grading_scheme();
        $ranges = $scheme ? $scheme['ranges'] : [];
        $scheme_id = $scheme ? ($scheme['id'] ?? null) : null;

        // Fetch all attempts
        $attempts = $this->db->get('result_attempts')->result_array();
        
        $this->db->trans_start();
        foreach ($attempts as $attempt) {
            $att_grade = strtoupper(trim((string)($attempt['grade'] ?? '')));
            if ($att_grade === 'ABS') {
                continue;
            }
            if ($attempt['total_score'] === null && $attempt['ca_score'] === null && $attempt['exam_score'] === null) {
                continue;
            }

            $total = (float)($attempt['total_score'] ?? 0);
            if ($total == 0) {
                // fallback if total wasn't stored properly but ca+exam exist
                $total = (float)($attempt['ca_score'] ?? 0) + (float)($attempt['exam_score'] ?? 0);
            }
            $grade_info = $this->determine_grade($total, $ranges);
            
            // If attempt is locked, do not alter its score/grade silently; record drift amendment
            if (!empty($attempt['is_locked'])) {
                if ($grade_info && $attempt['grade'] !== null && $grade_info['grade'] !== $attempt['grade']) {
                    if ($this->db->table_exists('result_amendments')) {
                        $this->db->insert('result_amendments', [
                            'id' => $this->generate_uuid(),
                            'attempt_id' => $attempt['id'],
                            'batch_id' => $attempt['batch_id'],
                            'student_id' => $attempt['student_id'],
                            'field' => 'scheme_drift',
                            'old_value' => $attempt['grade'],
                            'new_value' => $grade_info['grade'],
                            'reason' => 'Active grading scheme updated; locked attempt retains original grade.',
                            'actor_id' => $user_id,
                            'created_at' => date('Y-m-d H:i:s')
                        ]);
                    }
                }
                continue;
            }

            // Get batch and course credit units
            $credit_units = (int)($attempt['credit_units_snapshot'] ?? 0);
            if ($credit_units === 0) {
                $batch = $this->get_batch_by_id($attempt['batch_id']);
                if ($batch) {
                    $this->db->where('id', $batch['course_id']);
                    $course = $this->db->get('courses')->row_array();
                    $credit_units = (int) ($course['credit_units'] ?? 0);
                }
            }
            
            $update_data = [
                'total_score' => $total,
                'grade' => $grade_info['grade'],
                'grade_point' => $grade_info['grade_point'],
                'quality_point' => $grade_info['grade_point'] * $credit_units,
                'result_state' => 'entered'
            ];
            if ($credit_units > 0) {
                $update_data['credit_units_snapshot'] = $credit_units;
            }
            if ($scheme_id) {
                $update_data['grading_scheme_id'] = $scheme_id;
            }

            $this->db->where('id', $attempt['id']);
            $this->db->update('result_attempts', $update_data);
        }
        $this->db->trans_complete();
    }

    public function determine_grade($total_score, $grading_ranges)
    {
        if ($total_score === null || $total_score === '') return null;
        
        $score = (float) $total_score;
        foreach ($grading_ranges as $range) {
            if ($score >= (float) $range['min_score'] && $score <= (float) $range['max_score']) {
                return array(
                    'grade' => $range['letter_grade'],
                    'grade_point' => $range['grade_point']
                );
            }
        }
        return array('grade' => empty($grading_ranges) ? 'EMP' : 'MIS', 'grade_point' => 0.0); // Fallback
    }

    public function get_assessment_structure()
    {
        $this->db->where('setting_key', 'assessment_structure');
        $setting = $this->db->get('academic_settings')->row_array();
        
        if ($setting && $setting['setting_value']) {
            $decoded = json_decode($setting['setting_value'], true);
            if (is_array($decoded)) {
                return array(
                    'max_ca' => isset($decoded['max_ca']) ? (float)$decoded['max_ca'] : 30,
                    'max_exam' => isset($decoded['max_exam']) ? (float)$decoded['max_exam'] : 70,
                    'max_total' => isset($decoded['max_total']) ? (float)$decoded['max_total'] : 100
                );
            }
        }
        
        return array(
            'max_ca' => 30,
            'max_exam' => 70,
            'max_total' => 100
        );
    }

    public function save_assessment_structure($data, $user_id = null)
    {
        $max_ca = isset($data['max_ca']) ? (float)$data['max_ca'] : 30;
        $max_exam = isset($data['max_exam']) ? (float)$data['max_exam'] : 70;
        $max_total = isset($data['max_total']) ? (float)$data['max_total'] : ($max_ca + $max_exam);

        $payload = json_encode(array(
            'max_ca' => $max_ca,
            'max_exam' => $max_exam,
            'max_total' => $max_total
        ));

        $now = date('Y-m-d H:i:s');
        $this->db->where('setting_key', 'assessment_structure');
        $existing = $this->db->get('academic_settings')->row_array();

        if ($existing) {
            return $this->db->where('setting_key', 'assessment_structure')->update('academic_settings', array(
                'setting_value' => $payload,
                'updated_at' => $now,
                'updated_by' => $user_id
            ));
        } else {
            return $this->db->insert('academic_settings', array(
                'id' => $this->generate_uuid(),
                'setting_key' => 'assessment_structure',
                'setting_value' => $payload,
                'updated_at' => $now,
                'updated_by' => $user_id
            ));
        }
    }

    // =========================================================================
    // RESULT BATCHES
    // =========================================================================

    public function get_batches($filters = array(), $limit = null, $offset = null)
    {
        $student_cohort_sub = '(SELECT COALESCE(cs_sess.name, s.session_name, s.entry_session_id)
                               FROM result_attempts ra
                               JOIN students s ON s.id = ra.student_id
                               LEFT JOIN academic_sessions cs_sess ON (cs_sess.id = s.entry_session_id OR cs_sess.name = s.entry_session_id)
                               WHERE ra.batch_id = b.id AND (s.session_name IS NOT NULL OR s.entry_session_id IS NOT NULL)
                               LIMIT 1)';

        $this->db->select('b.*, 
                           COALESCE(teaching_session.name, legacy_session.name, b.academic_session_id, b.session_id) as session_name,
                           COALESCE(teaching_session.name, b.academic_session_id) as academic_session_name,
                           COALESCE(cohort_session.name, ' . $student_cohort_sub . ', "2021/2022") as cohort_session_name,
                           sem.name as semester_name, 
                           c.code as course_code, 
                           c.title as course_title,
                           d.name as department_name,
                           p.name as programme_name');
        $this->db->from('result_batches b');
        $this->db->join('academic_sessions teaching_session', '(teaching_session.id = b.academic_session_id OR teaching_session.name = b.academic_session_id)', 'left');
        $this->db->join('academic_sessions cohort_session', '(cohort_session.id = b.cohort_session_id OR cohort_session.name = b.cohort_session_id)', 'left');
        $this->db->join('academic_sessions legacy_session', '(legacy_session.id = b.session_id OR legacy_session.name = b.session_id)', 'left');
        $this->db->join('semesters sem', 'sem.id = b.semester_id', 'left');
        $this->db->join('courses c', 'c.id = b.course_id', 'left');
        $this->db->join('departments d', 'd.id = b.department_id', 'left');
        $this->db->join('programmes p', 'p.id = b.programme_id', 'left');

        if (!empty($filters['session_id'])) {
            $this->db->group_start();
            $this->db->where('b.academic_session_id', $filters['session_id']);
            $this->db->or_group_start();
            $this->db->group_start();
            $this->db->where('b.academic_session_id IS NULL', null, false);
            $this->db->or_where('b.academic_session_id', '');
            $this->db->group_end();
            $this->db->where('b.session_id', $filters['session_id']);
            $this->db->group_end();
            $this->db->group_end();
        }
        if (!empty($filters['semester_id'])) {
            $this->db->where('b.semester_id', $filters['semester_id']);
        }
        if (!empty($filters['programme_id'])) {
            $this->db->where('b.programme_id', $filters['programme_id']);
        }
        if (!empty($filters['level'])) {
            $this->db->where('b.level', $filters['level']);
        }
        if (!empty($filters['status'])) {
            $this->db->where('b.status', $filters['status']);
        }

        $this->db->order_by('b.created_at', 'DESC');
        
        if ($limit !== null) {
            $this->db->limit($limit, $offset);
        }

        return $this->db->get()->result_array();
    }

    public function get_batch_by_id($batch_id)
    {
        $this->db->select('*');
        $this->db->where('id', $batch_id);
        return $this->db->get('result_batches')->row_array();
    }

    public function get_registered_students_for_batch($batch)
    {
        if (empty($batch['session_id']) || empty($batch['semester_id']) || empty($batch['course_id'])) {
            return array();
        }

        $this->load->library('Period_resolver');
        $teaching_session_id = !empty($batch['academic_session_id'])
            ? $batch['academic_session_id']
            : $batch['session_id'];
        $period = $this->period_resolver->resolve($teaching_session_id, $batch['semester_id'], $batch['level'] ?? null);
        $target_session_ids = !empty($period['session_ids']) ? $period['session_ids'] : array($teaching_session_id);
        $target_semester_ids = !empty($period['semester_ids']) ? $period['semester_ids'] : array($batch['semester_id']);
        $contact_num = $batch['contact_number'] ?? $period['contact_number'];
        $target_level = $batch['level'] ?? $period['label'];

        $this->db->distinct();
        $this->db->select('r.student_id, i.registration_type, r.id as registration_id');
        $this->db->from('course_registration_items i');
        $this->db->join('course_registrations r', 'r.id = i.registration_id');
        $this->db->join('students s', 's.id = r.student_id');
        $this->db->join('courses c', 'c.id = i.course_id', 'left');
        $this->db->join('programmes p', 'p.id = COALESCE(s.programme_id, c.programme_id)', 'left');
        $this->db->where('i.course_id', $batch['course_id']);

        // Scope by teaching session only. A student's entry cohort is separate
        // evidence and must never widen a result-batch population query.
        $this->db->group_start();
        if ($this->db->field_exists('academic_session_id', 'course_registrations')) {
            $this->db->where_in('r.academic_session_id', $target_session_ids);
            $this->db->or_group_start();
            $this->db->group_start();
            $this->db->where('r.academic_session_id IS NULL', null, false);
            $this->db->or_where('r.academic_session_id', '');
            $this->db->group_end();
            $this->db->where_in('r.session_id', $target_session_ids);
            $this->db->group_end();
        } else {
            $this->db->where_in('r.session_id', $target_session_ids);
        }
        $this->db->group_end();

        // Status filter: approved, submitted, or draft
        $this->db->where_in('r.status', array('approved', 'submitted', 'draft'));

        if ($this->db->field_exists('status', 'course_registration_items')) {
            $this->db->group_start();
            $this->db->where('i.status', 'active');
            $this->db->or_where('i.status IS NULL', null, false);
            $this->db->group_end();
        }

        // Target level / contact matching:
        // - CARRYOVER / REPEAT: registered as carryover for this course in this session
        // - REGULAR (CORE / ELECTIVE): registered for this course at the targeted semester/contact/level
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
            if ($target_level) {
                $this->db->or_where('r.level', $target_level);
                $this->db->or_where('LOWER(r.level)', strtolower($target_level));
                if ($contact_num !== null) {
                    $this->db->or_where('r.level', (string)$contact_num);
                    $this->db->or_where('r.level', 'Contact ' . $contact_num);
                    $this->db->or_where('r.level', 'Contact' . $contact_num);
                }
            }
            if ($contact_num !== null) {
                if ($this->db->field_exists('contact_number', 'courses')) {
                    $this->db->or_where('c.contact_number', $contact_num);
                    $this->db->or_where('c.contact_number', (string)$contact_num);
                }
                $this->db->or_where_in('c.level', $target_semester_ids);
            }
            $this->db->group_end();
        $this->db->group_end();
        $this->db->group_end();

        // Programme / Department filter (if batch has programme_id or department_id)
        if (!empty($batch['programme_id']) && $batch['programme_id'] !== 'all') {
            $this->db->group_start();
            $this->db->where('s.programme_id', $batch['programme_id']);
            $this->db->or_where('c.programme_id', $batch['programme_id']);
            $this->db->or_where('p.id', $batch['programme_id']);
            if ($this->db->field_exists('programme_id', 'course_registrations')) {
                $this->db->or_where('r.programme_id', $batch['programme_id']);
            }
            $this->db->group_end();
        }
        if (!empty($batch['department_id']) && $batch['department_id'] !== 'all') {
            $this->db->group_start();
            $this->db->where('s.department_id', $batch['department_id']);
            $this->db->or_where('p.department_id', $batch['department_id']);
            $this->db->group_end();
        }

        $approved_students = $this->db->get()->result_array();
        if (!empty($approved_students)) {
            return $approved_students;
        }

        // --- CARRYOVER BATCH FALLBACK ---
        // If no registration items exist for this course in this session (e.g. students took it in an earlier contact
        // like Contact 5 in 2024/2025, and need to correct it in 2025/2026), resolve the eligible carryover candidates:
        $prog_id = $batch['programme_id'] ?? null;
        $cid = $batch['course_id'];

        // 1. Students in this programme who have an outstanding failed / uncorrected attempt in this course
        $sql = "
            SELECT DISTINCT ra.student_id, 'carryover' as registration_type, NULL as registration_id, ra.id as origin_result_attempt_id
            FROM result_attempts ra
            JOIN result_batches rb ON rb.id = ra.batch_id
            JOIN students s ON s.id = ra.student_id
            WHERE rb.course_id = ?
              AND (UPPER(COALESCE(ra.grade, '')) IN ('F', 'ABS', '', 'PENDING') OR ra.total_score IS NULL OR ra.total_score < 40)
        ";
        $sql_params = array($cid);
        if (!empty($prog_id) && $prog_id !== 'all') {
            $sql .= " AND s.programme_id = ?";
            $sql_params[] = $prog_id;
        }
        $historical_failures = $this->db->query($sql, $sql_params)->result_array();
        if (!empty($historical_failures)) {
            return $historical_failures;
        }

        // 2. Cohort enrolled students in this programme in this session
        $this->db->distinct();
        $this->db->select('r.student_id, "carryover" as registration_type, r.id as registration_id, NULL as origin_result_attempt_id');
        $this->db->from('course_registrations r');
        $this->db->join('students s', 's.id = r.student_id');
        if ($this->db->field_exists('academic_session_id', 'course_registrations')) {
            $this->db->where_in('r.academic_session_id', $target_session_ids);
            $this->db->or_where_in('r.session_id', $target_session_ids);
        } else {
            $this->db->where_in('r.session_id', $target_session_ids);
        }
        if (!empty($prog_id) && $prog_id !== 'all') {
            $this->db->where('s.programme_id', $prog_id);
        }
        $this->db->where_in('r.status', array('approved', 'submitted', 'draft'));
        $cohort_students = $this->db->get()->result_array();
        return is_array($cohort_students) ? $cohort_students : array();
    }

    public function count_registered_students_for_batch($batch)
    {
        $students = $this->get_registered_students_for_batch($batch);
        return count($students);
    }

    public function populate_batch_attempts($batch)
    {
        if (empty($batch['session_id']) || empty($batch['semester_id']) || empty($batch['course_id'])) {
            return;
        }

        $batch_id = $batch['id'];
        $this->load->library('Period_resolver');
        $teaching_session_id = !empty($batch['academic_session_id'])
            ? $batch['academic_session_id']
            : $batch['session_id'];
        $period = $this->period_resolver->resolve($teaching_session_id, $batch['semester_id'], $batch['level'] ?? null);
        $target_session_ids = !empty($period['session_ids']) ? $period['session_ids'] : array($teaching_session_id);
        $contact_num = $batch['contact_number'] ?? $period['contact_number'];

        if (empty($batch['contact_number']) && $contact_num !== null) {
            $this->db->where('id', $batch_id)->update('result_batches', array('contact_number' => $contact_num));
        }

        $approved_students = $this->get_registered_students_for_batch($batch);
        $valid_student_ids = array_fill_keys(array_column($approved_students, 'student_id'), true);

        // Fetch existing attempts for this batch
        $this->db->select('id, student_id, ca_score, exam_score, total_score, grade');
        $this->db->where('batch_id', $batch_id);
        $existing_attempts = $this->db->get('result_attempts')->result_array();
        $existing_ids = array();
        $ghost_ids = array();

        foreach ($existing_attempts as $att) {
            $existing_ids[$att['student_id']] = true;
            // Prune unscored placeholders of students who are NOT registered in this session
            $is_unscored = ($att['ca_score'] === null || $att['ca_score'] === '') &&
                           ($att['exam_score'] === null || $att['exam_score'] === '') &&
                           ($att['total_score'] === null || $att['total_score'] === '') &&
                           ($att['grade'] === null || $att['grade'] === '');
            if ($is_unscored && !isset($valid_student_ids[$att['student_id']])) {
                $ghost_ids[] = $att['id'];
            }
        }

        // Prune empty ghost placeholders (only in editable batches)
        if (!empty($ghost_ids) && in_array($batch['status'] ?? 'draft', ['draft', 'submitted'])) {
            $this->db->where_in('id', $ghost_ids);
            $this->db->delete('result_attempts');
        }

        // Fetch course credit units & active grading scheme
        $course = $this->db->select('credit_units, contact_number, level')->get_where('courses', array('id' => $batch['course_id']))->row_array();
        $credit_units = (int)($course['credit_units'] ?? 0);
        $active_scheme = $this->get_active_grading_scheme();
        $active_scheme_id = $active_scheme ? ($active_scheme['id'] ?? null) : null;

        // Resolve carryover sources for this course to accurately flag carryovers
        $this->load->model('Outstanding_course_model');
        $carryover_sources = $this->Outstanding_course_model->get_outstanding_students_for_course_before(
            $batch['course_id'],
            $teaching_session_id,
            $batch['semester_id']
        );
        if (!is_array($carryover_sources)) {
            $carryover_sources = array();
        }

        // Direct query for prior uncorrected/failed attempts for approved students in this course
        $approved_student_ids = array_filter(array_column($approved_students, 'student_id'));
        if (!empty($approved_student_ids)) {
            $this->db->select('ra.id, ra.student_id, ra.total_score, ra.grade, ra.batch_id');
            $this->db->from('result_attempts ra');
            $this->db->join('result_batches rb', 'rb.id = ra.batch_id');
            $this->db->where('rb.course_id', $batch['course_id']);
            $this->db->where('ra.batch_id !=', $batch_id);
            $this->db->where_in('ra.student_id', $approved_student_ids);
            $this->db->group_start();
            $this->db->where_in('UPPER(COALESCE(ra.grade, ""))', array('F', 'ABS', 'PENDING', ''));
            $this->db->or_where('ra.total_score IS NULL', null, false);
            $this->db->or_where('ra.total_score <', 40);
            $this->db->group_end();
            $prior_fails = $this->db->get()->result_array();
            foreach ($prior_fails as $pf) {
                if (!isset($carryover_sources[$pf['student_id']])) {
                    $carryover_sources[$pf['student_id']] = $pf;
                }
            }
        }

        // Insert placeholder attempts for registered students who don't have one yet
        $attempts_data = array();
        foreach ($approved_students as $st) {
            $sid = $st['student_id'];
            $reg_id = $st['registration_id'] ?? null;
            $is_student_carryover = isset($carryover_sources[$sid])
                || in_array(strtolower((string)($st['registration_type'] ?? '')), array('carryover', 'repeat'))
                || !empty($st['origin_result_attempt_id']);
            $resolved_reg_type = $is_student_carryover ? 'carryover' : (strtolower((string)($st['registration_type'] ?? '')) ?: 'core');
            $origin_attempt_id = $st['origin_result_attempt_id'] ?? ($carryover_sources[$sid]['id'] ?? null);

            // Ensure active carryover item exists in course_registration_items for this session
            if ($this->db->table_exists('course_registration_items') && $this->db->table_exists('course_registrations')) {
                $this->db->where('student_id', $sid);
                if (!empty($target_session_ids)) {
                    $this->db->group_start();
                    if ($this->db->field_exists('academic_session_id', 'course_registrations')) {
                        $this->db->where_in('academic_session_id', $target_session_ids);
                        $this->db->or_where_in('session_id', $target_session_ids);
                    } else {
                        $this->db->where_in('session_id', $target_session_ids);
                    }
                    $this->db->group_end();
                }
                $env = $this->db->get('course_registrations')->row_array();

                if ($env) {
                    $reg_id = $env['id'];
                    $item_exists = $this->db->get_where('course_registration_items', array(
                        'registration_id' => $env['id'],
                        'course_id' => $batch['course_id']
                    ))->row_array();

                    if (!$item_exists) {
                        $new_item = array(
                            'id' => $this->generate_uuid(),
                            'registration_id' => $env['id'],
                            'course_id' => $batch['course_id'],
                            'registration_type' => $resolved_reg_type,
                            'created_at' => date('Y-m-d H:i:s')
                        );
                        if ($this->db->field_exists('status', 'course_registration_items')) {
                            $new_item['status'] = 'active';
                        }
                        if (!empty($origin_attempt_id) && $this->db->field_exists('origin_result_attempt_id', 'course_registration_items')) {
                            $new_item['origin_result_attempt_id'] = $origin_attempt_id;
                        }
                        if ($is_student_carryover && $this->db->field_exists('source', 'course_registration_items')) {
                            $new_item['source'] = 'AUTO';
                        }
                        $this->db->insert('course_registration_items', $new_item);
                    } elseif ($is_student_carryover && strtolower((string)$item_exists['registration_type']) !== 'carryover') {
                        $upd_co = array('registration_type' => 'carryover');
                        if (!empty($origin_attempt_id) && $this->db->field_exists('origin_result_attempt_id', 'course_registration_items') && empty($item_exists['origin_result_attempt_id'])) {
                            $upd_co['origin_result_attempt_id'] = $origin_attempt_id;
                        }
                        $this->db->where('id', $item_exists['id'])->update('course_registration_items', $upd_co);
                    }
                }
            }

            if (isset($existing_ids[$sid])) {
                // If attempt already exists, keep registration_type_snapshot synchronized if student is carryover
                if ($is_student_carryover) {
                    $this->db->where('batch_id', $batch_id)->where('student_id', $sid)->update('result_attempts', array(
                        'registration_type_snapshot' => 'carryover'
                    ));
                }
                continue;
            }
            $attempts_data[] = array(
                'id' => $this->generate_uuid(),
                'batch_id' => $batch_id,
                'student_id' => $sid,
                'course_registration_id' => $reg_id,
                'ca_score' => null,
                'exam_score' => null,
                'total_score' => null,
                'grade' => null,
                'grade_point' => null,
                'quality_point' => null,
                'status' => 'active',
                'result_state' => 'pending',
                'credit_units_snapshot' => $credit_units,
                'registration_type_snapshot' => $resolved_reg_type,
                'contact_number' => $contact_num,
                'grading_scheme_id' => $active_scheme_id,
                'created_at' => date('Y-m-d H:i:s')
            );
        }
        if (!empty($attempts_data)) {
            $this->db->insert_batch('result_attempts', $attempts_data);
        }
    }

    public function create_batch($data)
    {
        // Enforce rule: No course result batch can be created if it has 0 registered students
        $reg_count = $this->count_registered_students_for_batch($data);
        if ($reg_count <= 0) {
            log_message('error', 'Cannot create result batch: course ' . ($data['course_id'] ?? '') . ' has 0 registered students.');
            return false;
        }

        $batch_id = $this->generate_uuid();
        $data['id'] = $batch_id;
        $data['created_at'] = date('Y-m-d H:i:s');
        $data['status'] = 'draft';

        // Sanitize nullable columns and foreign keys to null if empty or 'all'
        foreach (array('department_id', 'programme_id', 'lecturer_id', 'level') as $col) {
            if (isset($data[$col]) && ($data[$col] === '' || $data[$col] === 'all')) {
                $data[$col] = null;
            }
        }

        // If department_id is missing, try to resolve from programme_id
        if (empty($data['department_id']) && !empty($data['programme_id'])) {
            $prog = $this->db->get_where('programmes', array('id' => $data['programme_id']))->row_array();
            if ($prog && !empty($prog['department_id'])) {
                $data['department_id'] = $prog['department_id'];
            }
        }

        // Validate foreign keys against their parent tables to guarantee no constraint violations
        if (!empty($data['department_id'])) {
            $dept_exists = $this->db->get_where('departments', array('id' => $data['department_id']))->row_array();
            if (!$dept_exists) {
                $data['department_id'] = null;
            }
        } else {
            $data['department_id'] = null;
        }

        if (!empty($data['programme_id'])) {
            $prog_exists = $this->db->get_where('programmes', array('id' => $data['programme_id']))->row_array();
            if (!$prog_exists) {
                $data['programme_id'] = null;
            }
        } else {
            $data['programme_id'] = null;
        }

        if (!empty($data['lecturer_id']) && $this->db->table_exists('users')) {
            $lect_exists = $this->db->get_where('users', array('id' => $data['lecturer_id']))->row_array();
            if (!$lect_exists) {
                $data['lecturer_id'] = null;
            }
        } else {
            $data['lecturer_id'] = null;
        }

        if ($this->db->field_exists('academic_session_id', 'result_batches')
            && empty($data['academic_session_id']) && !empty($data['session_id'])) {
            $data['academic_session_id'] = $data['session_id'];
        }

        if ($this->db->field_exists('cohort_session_id', 'result_batches') && empty($data['cohort_session_id']) && !empty($data['programme_id'])) {
            $entry_cohort_row = $this->db->query("
                SELECT COALESCE(s.entry_session_id, s.session_name) as entry_cohort
                FROM course_registrations r
                JOIN students s ON s.id = r.student_id
                WHERE s.programme_id = ? AND (s.entry_session_id IS NOT NULL OR s.session_name IS NOT NULL)
                LIMIT 1
            ", array($data['programme_id']))->row_array();
            if ($entry_cohort_row && !empty($entry_cohort_row['entry_cohort'])) {
                $sess_check = $this->db->get_where('academic_sessions', array('name' => $entry_cohort_row['entry_cohort']), 1)->row_array();
                $data['cohort_session_id'] = $sess_check ? $sess_check['id'] : $entry_cohort_row['entry_cohort'];
            }
        }
        
        $this->db->trans_start();
        $this->db->insert('result_batches', $data);
        
        $this->populate_batch_attempts($data);
        
        $this->db->trans_complete();
        return $batch_id;
    }

    public function delete_batch($batch_id) { $this->db->trans_start(); $this->db->where('batch_id', $batch_id); $this->db->delete('result_attempts'); $this->db->where('id', $batch_id); $this->db->delete('result_batches'); $this->db->trans_complete(); return $this->db->trans_status(); }

    public function update_batch_status($batch_id, $status, $user_id)
    {
        $this->db->trans_start();

        $data = array(
            'status' => $status,
            'updated_at' => date('Y-m-d H:i:s'),
            'updated_by' => $user_id
        );

        if ($status === 'submitted') $data['submitted_at'] = date('Y-m-d H:i:s');
        if ($status === 'approved') $data['approved_at'] = date('Y-m-d H:i:s');
        if ($status === 'published') $data['published_at'] = date('Y-m-d H:i:s');

        $this->db->where('id', $batch_id);
        $updated = $this->db->update('result_batches', $data);

        // Under NUC BMAS standards, when a batch is approved or published:
        // 1. Lock the attempts to prevent score alteration.
        // 2. Finalize snapshots (units, contact, scheme, state).
        // 3. Propagate confirmed carryovers (F and ABS) to the next academic session.
        if ($updated && in_array($status, ['approved', 'published'])) {
            $batch = $this->get_batch_by_id($batch_id);
            $this->db->where('id', $batch['course_id']);
            $course = $this->db->get('courses')->row_array();
            $credit_units = (int)($course['credit_units'] ?? 0);

            $this->load->library('Period_resolver');
            $teaching_session_id = !empty($batch['academic_session_id'])
                ? $batch['academic_session_id']
                : $batch['session_id'];
            $period = $this->period_resolver->resolve($teaching_session_id, $batch['semester_id'], $batch['level'] ?? null);
            $contact_num = $batch['contact_number'] ?? $period['contact_number'];

            $active_scheme = $this->get_active_grading_scheme();
            $scheme_id = $active_scheme ? ($active_scheme['id'] ?? null) : null;

            // Update attempts with is_locked = 1 and fill missing snapshots
            $this->db->where('batch_id', $batch_id);
            $this->db->set('is_locked', 1);
            $this->db->set('credit_units_snapshot', "COALESCE(credit_units_snapshot, {$credit_units})", false);
            if ($contact_num !== null) {
                $this->db->set('contact_number', "COALESCE(contact_number, {$contact_num})", false);
            }
            if ($scheme_id) {
                $this->db->set('grading_scheme_id', "COALESCE(grading_scheme_id, '{$scheme_id}')", false);
            }
            $this->db->update('result_attempts');

            // Update result_state for attempts in this batch
            $this->db->query("UPDATE `result_attempts` SET `result_state` = CASE
                WHEN `grade` = 'ABS' THEN 'absent'
                WHEN `total_score` IS NOT NULL OR (`grade` IS NOT NULL AND `grade` NOT IN ('', '-', '—')) THEN 'entered'
                ELSE 'pending'
            END WHERE `batch_id` = '{$batch_id}'");

            $this->load->model('Carryover_sync_model');
            $this->db->select('student_id, grade');
            $this->db->where('batch_id', $batch_id);
            $this->db->where_in('grade', ['F', 'ABS']);
            $failed_attempts = $this->db->get('result_attempts')->result_array();
            
            if (!empty($failed_attempts)) {
                $this->db->where('id', $batch['session_id']);
                $batch_sess = $this->db->get('academic_sessions')->row_array();

                if ($batch_sess && !empty($batch_sess['name'])) {
                    $this->db->where('name >', $batch_sess['name']);
                    $this->db->order_by('name', 'ASC');
                    $this->db->limit(1);
                    $next_sess = $this->db->get('academic_sessions')->row_array();
                    $target_sess_id = $next_sess ? $next_sess['id'] : null;

                    if ($target_sess_id && !empty($batch['semester_id'])) {
                        foreach ($failed_attempts as $fa) {
                            $this->Carryover_sync_model->commit_sync($fa['student_id'], $target_sess_id, $batch['semester_id']);
                        }
                    }
                }
            }
        }

        $this->db->trans_complete();
        $status_ok = $this->db->trans_status();

        if ($status_ok && !empty($batch)) {
            $this->load->model('Snapshot_model');
            $this->Snapshot_model->invalidate_for_result_change([
                'session_id'   => $batch['session_id'] ?? null,
                'semester_id'  => $batch['semester_id'] ?? null,
                'programme_id' => $batch['programme_id'] ?? null,
                'level'        => $batch['level'] ?? null,
            ], 'batch_status_changed', "Result batch status updated to {$status}");
        }

        return $status_ok;
    }

    // =========================================================================
    // RESULT ATTEMPTS (SCORES)
    // =========================================================================

    public function get_attempts_by_batch($batch_id)
    {
        $batch = $this->get_batch_by_id($batch_id);
        if (!$batch) {
            return array();
        }

        // 1. First synchronize and prune attempts for editable batches against course registrations
        if (in_array($batch['status'], ['draft', 'submitted'])) {
            $this->populate_batch_attempts($batch);
        }

        $registered_students = $this->get_registered_students_for_batch($batch);
        $valid_student_ids = array_fill_keys(array_column($registered_students, 'student_id'), true);

        // 2. Build and execute attempts query
        $has_st_entry = $this->db->table_exists('students') && $this->db->field_exists('entry_mode', 'students');
        $has_ad_entry = $this->db->table_exists('admissions') && $this->db->field_exists('mode_of_entry', 'admissions');

        $this->db->select('a.*, u.full_name, ad.admission_number, st.admission_id');
        // Matric numbers entered via the admin form live in admission_number; fall back to it.
        $this->db->select("COALESCE(NULLIF(ad.matric_number, ''), ad.admission_number) AS matric_number", false);
        if ($has_st_entry && $has_ad_entry) {
            $this->db->select("COALESCE(NULLIF(st.entry_mode, ''), NULLIF(ad.mode_of_entry, ''), 'Fresh') AS entry_mode", false);
        } elseif ($has_st_entry) {
            $this->db->select("COALESCE(NULLIF(st.entry_mode, ''), 'Fresh') AS entry_mode", false);
        } elseif ($has_ad_entry) {
            $this->db->select("COALESCE(NULLIF(ad.mode_of_entry, ''), 'Fresh') AS entry_mode", false);
        } else {
            $this->db->select("'Fresh' AS entry_mode", false);
        }

        $this->db->from('result_attempts a');
        $this->db->join('students st', 'st.id = a.student_id', 'left');
        $this->db->join('users u', 'u.id = st.user_id', 'left');
        $this->db->join('admissions ad', 'ad.id = st.admission_id', 'left');
        $this->db->where('a.batch_id', $batch_id);
        $this->db->order_by('u.full_name', 'ASC');
        $attempts = $this->db->get()->result_array();

        // 3. Strict Rule: No student shall be listed if he is not registered under the course
        $filtered = array();
        foreach ($attempts as $att) {
            if (isset($valid_student_ids[$att['student_id']])) {
                if (isset($att['full_name'])) {
                    $att['full_name'] = str_replace(array("\xEF\xBF\xBD", "\u{FFFD}", "\xE2\x80\x99", "\xE2\x80\x98", '’', '‘', '`', '´'), "'", $att['full_name']);
                }
                $filtered[] = $att;
            }
        }

        // 4. Resolve carryover metadata so carryover students are correctly labeled
        $this->load->model('Outstanding_course_model');
        $teaching_session_id = !empty($batch['academic_session_id'])
            ? $batch['academic_session_id']
            : $batch['session_id'];
        $carryover_sources = $this->Outstanding_course_model->get_outstanding_students_for_course_before(
            $batch['course_id'],
            $teaching_session_id,
            $batch['semester_id']
        );
        if (!is_array($carryover_sources)) {
            $carryover_sources = array();
        }

        $student_ids = array_filter(array_column($filtered, 'student_id'));

        // Direct query for any prior failed/uncorrected attempt for these students in this course
        if (!empty($student_ids)) {
            $this->db->select('ra.id, ra.student_id, ra.total_score, ra.grade, ra.batch_id');
            $this->db->from('result_attempts ra');
            $this->db->join('result_batches rb', 'rb.id = ra.batch_id');
            $this->db->where('rb.course_id', $batch['course_id']);
            $this->db->where('ra.batch_id !=', $batch_id);
            $this->db->where_in('ra.student_id', $student_ids);
            $this->db->group_start();
            $this->db->where_in('UPPER(COALESCE(ra.grade, ""))', array('F', 'ABS', 'PENDING', ''));
            $this->db->or_where('ra.total_score IS NULL', null, false);
            $this->db->or_where('ra.total_score <', 40);
            $this->db->group_end();
            $prior_fails = $this->db->get()->result_array();
            foreach ($prior_fails as $pf) {
                if (!isset($carryover_sources[$pf['student_id']])) {
                    $carryover_sources[$pf['student_id']] = $pf;
                }
            }
        }

        $reg_items = array();
        if (!empty($student_ids) && $this->db->table_exists('course_registration_items')) {
            $has_origin = $this->db->field_exists('origin_result_attempt_id', 'course_registration_items');
            $sel = 'r.student_id, i.registration_type';
            if ($has_origin) {
                $sel .= ', i.origin_result_attempt_id';
            }
            $this->db->select($sel);
            $this->db->from('course_registration_items i');
            $this->db->join('course_registrations r', 'r.id = i.registration_id');
            $this->db->where('i.course_id', $batch['course_id']);
            $this->db->where_in('r.student_id', $student_ids);
            $items_rows = $this->db->get()->result_array();
            foreach ($items_rows as $ir) {
                $reg_items[$ir['student_id']] = $ir;
            }
        }

        $this->load->library('Period_resolver');
        $course_row = $this->db->select('contact_number, level')->get_where('courses', array('id' => $batch['course_id']))->row_array();
        $course_contact = $course_row ? ($course_row['contact_number'] ?? $this->period_resolver->extract_contact_number($course_row['level'])) : null;

        foreach ($filtered as &$att) {
            $sid = $att['student_id'];
            $is_co = false;
            $prev_att = null;

            if (isset($carryover_sources[$sid])) {
                $is_co = true;
                $prev_att = $carryover_sources[$sid];
            } elseif (isset($reg_items[$sid])) {
                $r_type = strtolower((string)$reg_items[$sid]['registration_type']);
                if (in_array($r_type, array('carryover', 'repeat')) || !empty($reg_items[$sid]['origin_result_attempt_id'])) {
                    $is_co = true;
                }
            }

            if (!$is_co && !empty($att['registration_type_snapshot'])) {
                if (in_array(strtolower((string)$att['registration_type_snapshot']), array('carryover', 'repeat'))) {
                    $is_co = true;
                }
            }

            // Only mark as carryover on contact mismatch if the batch contact itself is higher than course contact AND student has a prior attempt
            if (!$is_co && $course_contact !== null && $prev_att !== null) {
                $batch_contact = $batch['contact_number'] ?? $this->period_resolver->extract_contact_number($batch['semester_id'] ?? ($batch['level'] ?? null));
                if ($batch_contact !== null && $batch_contact > $course_contact) {
                    $is_co = true;
                }
            }

            $att['is_carryover'] = $is_co ? 1 : 0;
            $att['registration_type'] = $is_co ? 'carryover' : (strtolower($att['registration_type_snapshot'] ?? '') ?: 'core');
            $att['registration_type_snapshot'] = $att['registration_type'];
            $att['previous_attempt'] = $prev_att;
            if ($prev_att && empty($att['source_result_attempt_id'])) {
                $att['source_result_attempt_id'] = $prev_att['id'];
            }

            // Self-heal snapshot in database if needed
            if ($is_co && (empty($att['registration_type_snapshot']) || strtolower((string)$att['registration_type_snapshot']) !== 'carryover')) {
                $this->db->where('id', $att['id'])->update('result_attempts', array('registration_type_snapshot' => 'carryover'));
            }
        }
        unset($att);

        return $filtered;
    }

    private function save_carryover_correction($correction)
    {
        $this->db->where('result_attempt_id', $correction['result_attempt_id']);
        $existing = $this->db->get('carryover_corrections')->row_array();
        $now = date('Y-m-d H:i:s');

        if ($existing) {
            unset($correction['id'], $correction['created_at']);
            $correction['updated_at'] = $now;
            $this->db->where('id', $existing['id']);
            return $this->db->update('carryover_corrections', $correction);
        }

        $correction['id'] = $this->generate_uuid();
        $correction['created_at'] = $now;
        return $this->db->insert('carryover_corrections', $correction);
    }

    private function remove_generated_carryover_history($source_result_attempt_id)
    {
        if (!$source_result_attempt_id) {
            return;
        }

        if ($this->db->table_exists('carryover_corrections')) {
            $this->db->where('source_result_attempt_id', $source_result_attempt_id);
            $this->db->delete('carryover_corrections');
        }

        if ($this->db->table_exists('course_registration_items')
            && $this->db->field_exists('origin_result_attempt_id', 'course_registration_items')) {
            $this->db->where('origin_result_attempt_id', $source_result_attempt_id);
            $this->db->where_in('LOWER(registration_type)', array('carryover', 'repeat'));
            if ($this->db->field_exists('status', 'course_registration_items')) {
                $this->db->update('course_registration_items', array('status' => 'obsolete'));
            } else {
                $this->db->delete('course_registration_items');
            }
        }
    }

    /**
     * Resolves the next academic session chronologically after the given session.
     */
    public function get_next_academic_session($session_id_or_name)
    {
        $sess = null;
        if (!empty($session_id_or_name)) {
            $sess = $this->db->get_where('academic_sessions', array('id' => $session_id_or_name))->row_array();
            if (!$sess) {
                $sess = $this->db->get_where('academic_sessions', array('name' => $session_id_or_name))->row_array();
            }
        }
        $sess_name = $sess ? $sess['name'] : $session_id_or_name;

        $cur_year = null;
        if (preg_match('/(\d{4})/', (string)$sess_name, $m)) {
            $cur_year = (int)$m[1];
        }

        $all_sessions = $this->db->order_by('name', 'ASC')->get('academic_sessions')->result_array();
        $candidates = array();
        foreach ($all_sessions as $s) {
            if ($cur_year !== null && preg_match('/(\d{4})/', (string)$s['name'], $sm)) {
                $sy = (int)$sm[1];
                if ($sy > $cur_year) {
                    $candidates[$sy] = $s;
                }
            } elseif (!empty($sess_name) && strcmp($s['name'], $sess_name) > 0) {
                $candidates[] = $s;
            }
        }

        if (!empty($candidates)) {
            ksort($candidates);
            return reset($candidates);
        }

        // If not found in DB, auto-create next session (e.g. 2024/2025 -> 2025/2026)
        if ($cur_year !== null) {
            $next_name = ($cur_year + 1) . '/' . ($cur_year + 2);
            $this->load->model('Courses_model');
            $new_id = $this->Courses_model->create_session($next_name, null, null, 0);
            if ($new_id) {
                return $this->db->get_where('academic_sessions', array('id' => $new_id))->row_array();
            }
        }

        return null;
    }

    /**
     * Resolves all academic sessions chronologically after the given session.
     */
    public function get_subsequent_academic_sessions($session_id_or_name)
    {
        $sess = null;
        if (!empty($session_id_or_name)) {
            $sess = $this->db->get_where('academic_sessions', array('id' => $session_id_or_name))->row_array();
            if (!$sess) {
                $sess = $this->db->get_where('academic_sessions', array('name' => $session_id_or_name))->row_array();
            }
        }
        $sess_name = $sess ? $sess['name'] : $session_id_or_name;

        $cur_year = null;
        if (preg_match('/(\d{4})/', (string)$sess_name, $m)) {
            $cur_year = (int)$m[1];
        }

        $all_sessions = $this->db->order_by('name', 'ASC')->get('academic_sessions')->result_array();
        $subsequent = array();
        foreach ($all_sessions as $s) {
            if ($cur_year !== null && preg_match('/(\d{4})/', (string)$s['name'], $sm)) {
                $sy = (int)$sm[1];
                if ($sy > $cur_year) {
                    $subsequent[] = $s;
                }
            } elseif (!empty($sess_name) && strcmp($s['name'], $sess_name) > 0) {
                $subsequent[] = $s;
            }
        }
        return $subsequent;
    }

    /**
     * Automatically registers a carryover item in the subsequent session envelope
     * when a student receives a failing score (F, ABS, or < 40).
     */
    public function auto_register_carryover_on_fail($student_id, $batch, $result_attempt_id, $score, $grade)
    {
        $teaching_session = !empty($batch['academic_session_id']) ? $batch['academic_session_id'] : $batch['session_id'];
        $next_sess = $this->get_next_academic_session($teaching_session);
        if (!$next_sess) {
            return false;
        }
        $target_session_id = $next_sess['id'];

        // 1. Find or create registration envelope for student in target session
        $this->db->where('student_id', $student_id);
        $this->db->group_start();
        $this->db->where('session_id', $target_session_id);
        if ($this->db->field_exists('academic_session_id', 'course_registrations')) {
            $this->db->or_where('academic_session_id', $target_session_id);
            if (!empty($next_sess['name'])) {
                $this->db->or_where('academic_session_id', $next_sess['name']);
            }
        }
        if (!empty($next_sess['name'])) {
            $this->db->or_where('session_id', $next_sess['name']);
        }
        $this->db->group_end();
        $envelope = $this->db->get('course_registrations')->row_array();

        $this->load->library('Period_resolver');
        $current_contact = $batch['contact_number'] ?? $this->period_resolver->extract_contact_number($batch['semester_id']);
        $next_contact = $current_contact !== null ? ($current_contact + 1) : null;

        $envelope_id = null;
        $target_semester_id = null;

        if ($envelope) {
            $envelope_id = $envelope['id'];
            $target_semester_id = $envelope['semester_id'];
        } else {
            $student = $this->db->get_where('students', array('id' => $student_id))->row_array();
            if ($next_contact !== null) {
                $sem_row = $this->db->like('name', 'Contact ' . $next_contact)->get('semesters')->row_array();
                if ($sem_row) {
                    $target_semester_id = $sem_row['id'];
                }
            }
            if (!$target_semester_id) {
                $target_semester_id = $batch['semester_id'];
            }

            $envelope_id = $this->generate_uuid();
            $env_data = array(
                'id' => $envelope_id,
                'student_id' => $student_id,
                'session_id' => $target_session_id,
                'semester_id' => $target_semester_id,
                'status' => 'approved',
                'created_at' => date('Y-m-d H:i:s')
            );
            if ($this->db->field_exists('academic_session_id', 'course_registrations')) {
                $env_data['academic_session_id'] = $target_session_id;
            }
            if ($this->db->field_exists('entry_session_id', 'course_registrations') && !empty($student['entry_session_id'])) {
                $env_data['entry_session_id'] = $student['entry_session_id'];
            }
            if ($this->db->field_exists('programme_id', 'course_registrations') && !empty($student['programme_id'])) {
                $env_data['programme_id'] = $student['programme_id'];
            }
            if ($this->db->field_exists('level', 'course_registrations')) {
                $env_data['level'] = $next_contact !== null ? ('Contact ' . $next_contact) : ($student['current_level'] ?? null);
            }
            $this->db->insert('course_registrations', $env_data);
        }

        // 2. Insert or reactivate item in course_registration_items
        $this->db->where('registration_id', $envelope_id);
        $this->db->where('course_id', $batch['course_id']);
        $existing_item = $this->db->get('course_registration_items')->row_array();

        $now = date('Y-m-d H:i:s');
        if ($existing_item) {
            $upd_item = array(
                'registration_type' => 'carryover'
            );
            if ($this->db->field_exists('status', 'course_registration_items')) {
                $upd_item['status'] = 'active';
            }
            if ($this->db->field_exists('origin_result_attempt_id', 'course_registration_items')) {
                $upd_item['origin_result_attempt_id'] = $result_attempt_id;
            }
            if ($this->db->field_exists('source', 'course_registration_items')) {
                $upd_item['source'] = 'AUTO';
            }
            if ($this->db->field_exists('updated_at', 'course_registration_items')) {
                $upd_item['updated_at'] = $now;
            }
            $this->db->where('id', $existing_item['id']);
            $this->db->update('course_registration_items', $upd_item);
        } else {
            $new_item = array(
                'id' => $this->generate_uuid(),
                'registration_id' => $envelope_id,
                'course_id' => $batch['course_id'],
                'registration_type' => 'carryover',
                'created_at' => $now
            );
            if ($this->db->field_exists('status', 'course_registration_items')) {
                $new_item['status'] = 'active';
            }
            if ($this->db->field_exists('origin_result_attempt_id', 'course_registration_items')) {
                $new_item['origin_result_attempt_id'] = $result_attempt_id;
            }
            if ($this->db->field_exists('source', 'course_registration_items')) {
                $new_item['source'] = 'AUTO';
            }
            $this->db->insert('course_registration_items', $new_item);
        }

        // 3. If a draft/submitted batch exists for this course in the target session, add student to its attempts
        $has_rb_acad = $this->db->field_exists('academic_session_id', 'result_batches');
        $this->db->where('course_id', $batch['course_id']);
        $this->db->group_start();
        $this->db->where('session_id', $target_session_id);
        if ($has_rb_acad) {
            $this->db->or_where('academic_session_id', $target_session_id);
        }
        if (!empty($next_sess['name'])) {
            $this->db->or_where('session_id', $next_sess['name']);
            if ($has_rb_acad) {
                $this->db->or_where('academic_session_id', $next_sess['name']);
            }
        }
        $this->db->group_end();
        $this->db->where_in('status', array('draft', 'submitted'));
        $target_batches = $this->db->get('result_batches')->result_array();

        foreach ($target_batches as $tb) {
            $this->db->where('batch_id', $tb['id']);
            $this->db->where('student_id', $student_id);
            $att_exists = $this->db->get('result_attempts')->row_array();
            if (!$att_exists) {
                $course = $this->db->select('credit_units')->get_where('courses', array('id' => $batch['course_id']))->row_array();
                $credit_units = (int)($course['credit_units'] ?? 0);
                $new_attempt = array(
                    'id' => $this->generate_uuid(),
                    'batch_id' => $tb['id'],
                    'student_id' => $student_id,
                    'course_registration_id' => $envelope_id,
                    'ca_score' => null,
                    'exam_score' => null,
                    'total_score' => null,
                    'grade' => null,
                    'grade_point' => null,
                    'quality_point' => null,
                    'status' => 'active',
                    'result_state' => 'pending',
                    'credit_units_snapshot' => $credit_units,
                    'registration_type_snapshot' => 'carryover',
                    'contact_number' => $tb['contact_number'] ?? null,
                    'created_at' => $now
                );
                $this->db->insert('result_attempts', $new_attempt);
            }
        }

        // 4. Also invoke Carryover_sync_model to ensure global consistency
        if ($this->load->model('Carryover_sync_model') || isset($this->Carryover_sync_model)) {
            try {
                $this->Carryover_sync_model->commit_sync($student_id, $target_session_id, $target_semester_id);
            } catch (Exception $e) {
                log_message('error', 'Carryover_sync_model commit_sync error: ' . $e->getMessage());
            }
        }

        return true;
    }

    /**
     * Automatically de-registers carryovers in all subsequent sessions when a student
     * is corrected to a passing score (>= 40), and prunes any pending draft batch attempts
     * to completely avoid ghost data.
     */
    public function deregister_carryover_on_pass($student_id, $batch, $result_attempt_id)
    {
        $teaching_session = !empty($batch['academic_session_id']) ? $batch['academic_session_id'] : $batch['session_id'];
        $subsequent_sessions = $this->get_subsequent_academic_sessions($teaching_session);
        if (empty($subsequent_sessions)) {
            return;
        }
        $sub_ids = array_column($subsequent_sessions, 'id');
        $sub_names = array_column($subsequent_sessions, 'name');
        $all_target_sessions = array_unique(array_filter(array_merge($sub_ids, $sub_names)));

        $now = date('Y-m-d H:i:s');
        $has_item_status = $this->db->field_exists('status', 'course_registration_items');
        $has_dropped_at  = $this->db->field_exists('dropped_at', 'course_registration_items');

        // 1. Find all registration envelopes for this student in subsequent sessions
        $this->db->select('id, session_id, semester_id');
        $this->db->where('student_id', $student_id);
        $this->db->group_start();
        $this->db->where_in('session_id', $all_target_sessions);
        if ($this->db->field_exists('academic_session_id', 'course_registrations')) {
            $this->db->or_where_in('academic_session_id', $all_target_sessions);
        }
        $this->db->group_end();
        $envelopes = $this->db->get('course_registrations')->result_array();

        if (!empty($envelopes)) {
            $envelope_ids = array_column($envelopes, 'id');

            // Find carryover items for this course in these envelopes
            $this->db->where_in('registration_id', $envelope_ids);
            $this->db->where('course_id', $batch['course_id']);
            $this->db->where_in('LOWER(registration_type)', array('carryover', 'repeat'));
            $items = $this->db->get('course_registration_items')->result_array();

            if (!empty($items)) {
                $item_ids = array_column($items, 'id');
                if ($has_item_status) {
                    $upd = array('status' => 'obsolete');
                    if ($has_dropped_at) {
                        $upd['dropped_at'] = $now;
                        $upd['drop_reason'] = 'Carryover cleared: Student passed in originating session';
                    }
                    $this->db->where_in('id', $item_ids);
                    $this->db->update('course_registration_items', $upd);
                } else {
                    $this->db->where_in('id', $item_ids);
                    $this->db->delete('course_registration_items');
                }
            }
        }

        // 2. Also check by origin_result_attempt_id if column exists
        if ($result_attempt_id && $this->db->field_exists('origin_result_attempt_id', 'course_registration_items')) {
            $this->db->where('origin_result_attempt_id', $result_attempt_id);
            $this->db->where_in('LOWER(registration_type)', array('carryover', 'repeat'));
            if ($has_item_status) {
                $upd = array('status' => 'obsolete');
                if ($has_dropped_at) {
                    $upd['dropped_at'] = $now;
                    $upd['drop_reason'] = 'Carryover cleared: Student passed in originating session';
                }
                $this->db->update('course_registration_items', $upd);
            } else {
                $this->db->delete('course_registration_items');
            }
        }

        // 3. Remove carryover_corrections records
        if ($this->db->table_exists('carryover_corrections')) {
            $this->db->group_start();
            if ($result_attempt_id) {
                $this->db->where('source_result_attempt_id', $result_attempt_id);
                $this->db->or_where('result_attempt_id', $result_attempt_id);
            }
            $this->db->or_group_start();
            $this->db->where('student_id', $student_id);
            $this->db->where('course_id', $batch['course_id']);
            $this->db->group_end();
            $this->db->group_end();
            $this->db->delete('carryover_corrections');
        }

        // 4. PREVENT GHOST DATA IN FUTURE RESULT BATCHES:
        // Find any subsequent batches for this course in draft/submitted status
        // and delete any unscored/pending attempt for this student!
        $has_rb_acad = $this->db->field_exists('academic_session_id', 'result_batches');
        $this->db->select('id');
        $this->db->where('course_id', $batch['course_id']);
        $this->db->group_start();
        $this->db->where_in('session_id', $all_target_sessions);
        if ($has_rb_acad) {
            $this->db->or_where_in('academic_session_id', $all_target_sessions);
        }
        $this->db->group_end();
        $this->db->where_in('status', array('draft', 'submitted'));
        $subsequent_batches = $this->db->get('result_batches')->result_array();

        if (!empty($subsequent_batches)) {
            $sub_batch_ids = array_column($subsequent_batches, 'id');
            $this->db->where_in('batch_id', $sub_batch_ids);
            $this->db->where('student_id', $student_id);
            // Only prune unentered / pending / null score attempts
            $this->db->group_start();
            $this->db->where('result_state', 'pending');
            $this->db->or_where('total_score IS NULL', null, false);
            $this->db->or_group_start();
            $this->db->where('ca_score IS NULL', null, false);
            $this->db->where('exam_score IS NULL', null, false);
            $this->db->group_end();
            $this->db->group_end();
            $this->db->delete('result_attempts');
        }

        // 5. Also sync Carryover_sync_model for affected envelopes to ensure consistency
        if (!empty($envelopes) && ($this->load->model('Carryover_sync_model') || isset($this->Carryover_sync_model))) {
            foreach ($envelopes as $env) {
                try {
                    $this->Carryover_sync_model->commit_sync($student_id, $env['session_id'], $env['semester_id']);
                } catch (Exception $e) {
                    log_message('error', 'Carryover_sync_model error: ' . $e->getMessage());
                }
            }
        }
    }

    private function find_valid_carryover_source($attempt_id, $student_id, $course_id, $target_session_id, $target_semester_id)
    {
        if (!$attempt_id) {
            return null;
        }

        $sql = "
            SELECT a.id, a.total_score, a.grade, b.session_id, b.semester_id,
                   sess.name as session_name, sem.name as semester_name
            FROM result_attempts a
            JOIN result_batches b ON b.id = a.batch_id
            JOIN academic_sessions sess ON (sess.id = COALESCE(NULLIF(b.academic_session_id, ''), b.session_id) OR sess.name = b.session_id)
            JOIN semesters sem ON (sem.id = b.semester_id OR sem.name = b.semester_id OR sem.name = b.level)
            WHERE a.id = ? AND a.student_id = ? AND b.course_id = ? AND (a.status = 'active' OR a.status IS NULL)
            LIMIT 1
        ";
        $source = $this->db->query($sql, [$attempt_id, $student_id, $course_id])->row_array();
        if (!$source || !in_array(strtoupper((string)($source['grade'] ?? '')), ['F', 'ABS'], true)) {
            return null;
        }

        $target_session = $this->db->get_where('academic_sessions', ['id' => $target_session_id])->row_array();
        if (!$target_session) {
            $target_session = $this->db->get_where('academic_sessions', ['name' => $target_session_id])->row_array();
        }
        $target_semester = $this->db->get_where('semesters', ['id' => $target_semester_id])->row_array();
        if (!$target_semester) {
            $target_semester = $this->db->get_where('semesters', ['name' => $target_semester_id])->row_array();
        }
        if (!$target_session || !$target_semester) {
            return null;
        }

        if (!$this->Outstanding_course_model->is_before(
            $source['session_name'],
            $source['semester_name'],
            $target_session['name'],
            $target_semester['name']
        )) {
            return null;
        }

        return $source;
    }

    public function save_attempts($batch_id, $attempts, $user_id)
    {
        $this->load->model('Carryover_sync_model');
        $this->db->trans_start();

        // Validate batch exists and is editable (cannot alter approved/published batches)
        $batch = $this->get_batch_by_id($batch_id);
        if (!$batch) {
            $this->db->trans_rollback();
            return false;
        }
        if (in_array($batch['status'], ['approved', 'published'])) {
            $this->db->trans_rollback();
            log_message('error', "Cannot save attempts for batch {$batch_id} with status '{$batch['status']}'. Batch is locked.");
            return false;
        }

        // Get course to know credit units for quality point calculation
        $this->db->where('id', $batch['course_id']);
        $course = $this->db->get('courses')->row_array();
        $credit_units = (int) ($course['credit_units'] ?? 0);

        // Get assessment structure (ceilings)
        $assessment_structure = $this->get_assessment_structure();
        $max_ca = (float)($assessment_structure['max_ca'] ?? 30);
        $max_exam = (float)($assessment_structure['max_exam'] ?? 70);

        // Get grading scheme
        $scheme = $this->get_active_grading_scheme();
        $ranges = $scheme ? $scheme['ranges'] : [];

        $this->load->model('Outstanding_course_model');
        $teaching_session_id = !empty($batch['academic_session_id']) ? $batch['academic_session_id'] : $batch['session_id'];
        $carryover_sources = $this->Outstanding_course_model->get_outstanding_students_for_course_before(
            $batch['course_id'],
            $teaching_session_id,
            $batch['semester_id']
        );
        if (!is_array($carryover_sources)) {
            $carryover_sources = array();
        }

        $save_student_ids = array_filter(array_column($attempts, 'student_id'));
        if (!empty($save_student_ids)) {
            $this->db->select('ra.id, ra.student_id, ra.total_score, ra.grade, ra.batch_id');
            $this->db->from('result_attempts ra');
            $this->db->join('result_batches rb', 'rb.id = ra.batch_id');
            $this->db->where('rb.course_id', $batch['course_id']);
            $this->db->where('ra.batch_id !=', $batch_id);
            $this->db->where_in('ra.student_id', $save_student_ids);
            $this->db->group_start();
            $this->db->where_in('UPPER(COALESCE(ra.grade, ""))', array('F', 'ABS', 'PENDING', ''));
            $this->db->or_where('ra.total_score IS NULL', null, false);
            $this->db->or_where('ra.total_score <', 40);
            $this->db->group_end();
            $prior_fails = $this->db->get()->result_array();
            foreach ($prior_fails as $pf) {
                if (!isset($carryover_sources[$pf['student_id']])) {
                    $carryover_sources[$pf['student_id']] = $pf;
                }
            }
        }
        $registered_carryovers = [];
        if ($this->db->table_exists('course_registrations') && $this->db->table_exists('course_registration_items')) {
            $this->db->select('r.student_id');
            if ($this->db->field_exists('origin_result_attempt_id', 'course_registration_items')) {
                $this->db->select('i.origin_result_attempt_id');
            }
            $this->db->from('course_registration_items i');
            $this->db->join('course_registrations r', 'r.id = i.registration_id');
            $this->db->where('r.session_id', $batch['session_id']);
            $this->db->where('r.semester_id', $batch['semester_id']);
            $this->db->where('r.status', 'approved');
            $this->db->where('i.course_id', $batch['course_id']);
            $this->db->group_start();
            $this->db->where('i.status', 'active');
            $this->db->or_where('i.status IS NULL', null, false);
            $this->db->group_end();
            $this->db->where_in('LOWER(i.registration_type)', ['carryover', 'repeat']);
            foreach ($this->db->get()->result_array() as $registration) {
                $registered_carryovers[$registration['student_id']] = [
                    'id' => $registration['origin_result_attempt_id'] ?? null
                ];
            }
        }
        $requested_carryovers = [];
        foreach ($attempts as $attempt) {
            if (!empty($attempt['is_carryover'])) {
                $requested_carryovers[$attempt['student_id']] = true;
            }
        }
        if ((!empty($carryover_sources) || !empty($registered_carryovers) || !empty($requested_carryovers))
            && !$this->db->table_exists('carryover_corrections')) {
            $this->db->trans_rollback();
            log_message('error', 'Carryover correction table is missing; apply migration 018_create_carryover_corrections.sql.');
            return false;
        }

        $students_to_resync = [];
        $sync_actions = [];

        $registered_students = $this->get_registered_students_for_batch($batch);
        $valid_student_ids = array_fill_keys(array_column($registered_students, 'student_id'), true);

        // Also allow saving for any student who already has an existing attempt in this batch
        $existing_attempts_for_batch = $this->db->select('student_id')->get_where('result_attempts', array('batch_id' => $batch_id))->result_array();
        foreach ($existing_attempts_for_batch as $ea) {
            $valid_student_ids[$ea['student_id']] = true;
        }

        foreach ($attempts as $attempt) {
            $sid = $attempt['student_id'] ?? null;
            if (!$sid || !isset($valid_student_ids[$sid])) {
                // Strict rule: do not save attempts for students not registered under this course
                continue;
            }

            $is_absent = !empty($attempt['is_absent'])
                || strtoupper((string)($attempt['grade'] ?? '')) === 'ABS';
            $is_empty = (!isset($attempt['ca_score']) || $attempt['ca_score'] === '' || $attempt['ca_score'] === null) &&
                        (!isset($attempt['exam_score']) || $attempt['exam_score'] === '' || $attempt['exam_score'] === null);

            $this->load->library('Period_resolver');
            $period = $this->period_resolver->resolve($batch['session_id'], $batch['semester_id'], $batch['level'] ?? null);
            $contact_num = $batch['contact_number'] ?? $period['contact_number'];
            $scheme_id = $scheme ? ($scheme['id'] ?? null) : null;

            if ($is_absent) {
                $data = array(
                    'ca_score' => null,
                    'exam_score' => null,
                    'total_score' => null,
                    'grade' => 'ABS',
                    'grade_point' => 0,
                    'quality_point' => 0,
                    'result_state' => 'absent',
                    'credit_units_snapshot' => $credit_units,
                    'contact_number' => $contact_num,
                    'grading_scheme_id' => $scheme_id,
                    'updated_at' => date('Y-m-d H:i:s'),
                    'updated_by' => $user_id
                );
            } elseif ($is_empty) {
                $data = array(
                    'ca_score' => null,
                    'exam_score' => null,
                    'total_score' => null,
                    'grade' => null,
                    'grade_point' => null,
                    'quality_point' => null,
                    'result_state' => 'pending',
                    'credit_units_snapshot' => $credit_units,
                    'contact_number' => $contact_num,
                    'grading_scheme_id' => $scheme_id,
                    'updated_at' => date('Y-m-d H:i:s'),
                    'updated_by' => $user_id
                );
            } else {
                $raw_ca = (isset($attempt['ca_score']) && $attempt['ca_score'] !== '' && $attempt['ca_score'] !== null)
                    ? (float)$attempt['ca_score'] : null;
                $raw_exam = (isset($attempt['exam_score']) && $attempt['exam_score'] !== '' && $attempt['exam_score'] !== null)
                    ? (float)$attempt['exam_score'] : null;

                // Ceiling clamping to institutional BMAS bounds
                if ($raw_ca !== null && $raw_ca > $max_ca) {
                    $raw_ca = $max_ca;
                }
                if ($raw_exam !== null && $raw_exam > $max_exam) {
                    $raw_exam = $max_exam;
                }

                $total = ($raw_ca !== null ? $raw_ca : 0) + ($raw_exam !== null ? $raw_exam : 0);
                if ($total > 100.0) {
                    $total = 100.0;
                }
                $grade_info = $this->determine_grade($total, $ranges);
                
                $data = array(
                    'ca_score' => $raw_ca !== null ? $raw_ca : null,
                    'exam_score' => $raw_exam !== null ? $raw_exam : null,
                    'total_score' => $total,
                    'grade' => $grade_info['grade'],
                    'grade_point' => $grade_info['grade_point'],
                    'quality_point' => $grade_info['grade_point'] * $credit_units,
                    'result_state' => 'entered',
                    'credit_units_snapshot' => $credit_units,
                    'contact_number' => $contact_num,
                    'grading_scheme_id' => $scheme_id,
                    'updated_at' => date('Y-m-d H:i:s'),
                    'updated_by' => $user_id
                );
            }

            // Check if attempt exists for this student in this batch
            $this->db->where('batch_id', $batch_id);
            $this->db->where('student_id', $attempt['student_id']);
            $existing = $this->db->get('result_attempts')->row_array();
            $result_attempt_id = null;

            if ($existing) {
                // Do not update if locked
                if (!$existing['is_locked']) {
                    $this->db->where('id', $existing['id']);
                    $this->db->update('result_attempts', $data);
                    $result_attempt_id = $existing['id'];

                    // Reconcile on every save so stale carryover metadata is also repaired.
                    $old_grade = strtoupper((string)($existing['grade'] ?? ''));
                    $new_grade = strtoupper((string)($data['grade'] ?? ''));
                    if ($new_grade !== '' && !in_array($new_grade, ['F', 'ABS'], true)) {
                        $this->remove_generated_carryover_history($existing['id']);
                    }
                    if (in_array($old_grade, ['F', 'ABS'], true) || in_array($new_grade, ['F', 'ABS'], true)) {
                        $students_to_resync[$attempt['student_id']] = true;
                    }
                }
            } else {
                $data['id'] = $this->generate_uuid();
                $data['batch_id'] = $batch_id;
                $data['student_id'] = $attempt['student_id'];
                $data['created_at'] = date('Y-m-d H:i:s');
                $data['created_by'] = $user_id;
                $this->db->insert('result_attempts', $data);
                $result_attempt_id = $data['id'];

                $new_grade = strtoupper((string)($data['grade'] ?? ''));
                if (in_array($new_grade, ['F', 'ABS'], true)) {
                    $students_to_resync[$attempt['student_id']] = true;
                }
            }

            if ($result_attempt_id) {
                $new_grade = strtoupper((string)($data['grade'] ?? ''));
                $new_score = $data['total_score'];
                $is_fail = in_array($new_grade, array('F', 'ABS'), true) || ($new_score !== null && $new_score < 40);
                $is_pass = (!$is_absent && $new_score !== null && $new_score >= 40 && !in_array($new_grade, array('F', 'ABS', 'PENDING', ''), true));
                $is_cleared = ($is_empty || ($new_score === null && $new_grade === ''));

                $sync_actions[$attempt['student_id']] = array(
                    'student_id' => $attempt['student_id'],
                    'result_attempt_id' => $result_attempt_id,
                    'total_score' => $new_score,
                    'grade' => $new_grade,
                    'is_fail' => $is_fail,
                    'is_pass' => $is_pass,
                    'is_cleared' => $is_cleared
                );
            }

            $is_carryover = !empty($attempt['is_carryover'])
                || isset($carryover_sources[$attempt['student_id']])
                || isset($registered_carryovers[$attempt['student_id']]);
            $source_attempt = null;
            if ($is_carryover) {
                $requested_source_id = $attempt['source_result_attempt_id']
                    ?? ($registered_carryovers[$attempt['student_id']]['id'] ?? null);
                $source_attempt = $this->find_valid_carryover_source(
                    $requested_source_id,
                    $attempt['student_id'],
                    $batch['course_id'],
                    $batch['session_id'],
                    $batch['semester_id']
                );
                $source_attempt = $source_attempt
                    ?? ($carryover_sources[$attempt['student_id']] ?? null);

                if (!$source_attempt && !empty($attempt['source_result_attempt_id'])) {
                    $source_attempt = $this->db->get_where('result_attempts', array('id' => $attempt['source_result_attempt_id']))->row_array();
                }

                if ($result_attempt_id) {
                    $this->db->where('id', $result_attempt_id)->update('result_attempts', array(
                        'registration_type_snapshot' => 'carryover'
                    ));
                }
            }

            $has_valid_source = (!empty($source_attempt) && !empty($source_attempt['id']) && $source_attempt['id'] !== $result_attempt_id);
            if ($is_carryover && $result_attempt_id && ($has_valid_source || isset($registered_carryovers[$attempt['student_id']]))) {
                $effective_session_id = !empty($batch['academic_session_id']) ? $batch['academic_session_id'] : $batch['session_id'];
                $correction = [
                    'result_attempt_id' => $result_attempt_id,
                    'source_result_attempt_id' => $has_valid_source ? $source_attempt['id'] : null,
                    'student_id' => $attempt['student_id'],
                    'course_id' => $batch['course_id'],
                    'session_id' => $effective_session_id,
                    'semester_id' => $batch['semester_id'],
                    'ca_score' => $data['ca_score'],
                    'exam_score' => $data['exam_score'],
                    'total_score' => $data['total_score'],
                    'grade' => $data['grade'],
                    'grade_point' => $data['grade_point'],
                    'quality_point' => $data['quality_point'],
                    'corrected_by' => $user_id
                ];
                if (!$this->save_carryover_correction($correction)) {
                    $this->db->trans_rollback();
                    return false;
                }
            }
        }

        $this->db->trans_complete();
        $status = $this->db->trans_status();

        // Run automatic carryover sync and de-registration directly onSave
        // 1. If student fails (F, ABS, or < 40): automatically register carryover into subsequent session
        // 2. If student passes (>= 40): automatically de-register carryover in subsequent sessions & remove ghost attempts
        if ($status && !empty($sync_actions)) {
            foreach ($sync_actions as $sid => $action) {
                if ($action['is_fail']) {
                    $this->auto_register_carryover_on_fail(
                        $sid,
                        $batch,
                        $action['result_attempt_id'],
                        $action['total_score'],
                        $action['grade']
                    );
                } elseif ($action['is_pass'] || $action['is_cleared']) {
                    $this->deregister_carryover_on_pass(
                        $sid,
                        $batch,
                        $action['result_attempt_id']
                    );
                }
            }
        }

        if ($status && !empty($batch)) {
            $this->load->model('Snapshot_model');
            $this->Snapshot_model->invalidate_for_result_change([
                'session_id'   => $batch['session_id'] ?? null,
                'semester_id'  => $batch['semester_id'] ?? null,
                'programme_id' => $batch['programme_id'] ?? null,
                'level'        => $batch['level'] ?? null,
            ], 'result_score_changed', "Result attempts updated for course batch {$batch_id}");
        }

        return $status;
    }

    // =========================================================================
    // ACADEMIC PERFORMANCE (GPA/CGPA)
    // =========================================================================

    /**
     * Calculates GPA for a specific semester/session.
     */
    public function calculate_gpa($student_or_attempts, $session_id = null, $semester_id = null)
    {
        $this->load->library('academic_calculator');
        if (is_array($student_or_attempts)) {
            $metrics = $this->academic_calculator->calculate($student_or_attempts, [], 'reported');
            return (float)$metrics['gpa'];
        }
        $student_id = $student_or_attempts;
        $this->db->select('a.*, c.credit_units');
        $this->db->from('result_attempts a');
        $this->db->join('result_batches b', 'b.id = a.batch_id');
        $this->db->join('courses c', 'c.id = b.course_id');
        $this->db->where('a.student_id', $student_id);
        if ($session_id) $this->db->where('b.session_id', $session_id);
        if ($semester_id) $this->db->where('b.semester_id', $semester_id);
        $this->db->where('b.status', 'published');
        $this->db->where('a.status', 'active');
        
        $attempts = $this->db->get()->result_array();
        if (empty($attempts)) return 0.00;

        $metrics = $this->academic_calculator->calculate($attempts, [], 'reported');
        return (float)$metrics['gpa'];
    }

    /**
     * Calculates CGPA considering all published results.
     * Supports either a student ID string or an array of preloaded attempts.
     */
    public function calculate_cgpa($student_or_attempts)
    {
        $this->load->library('academic_calculator');
        if (is_array($student_or_attempts)) {
            $metrics = $this->academic_calculator->calculate($student_or_attempts, [], 'reported');
            return (float)$metrics['cgpa'];
        }
        $student_id = $student_or_attempts;
        $this->db->select('a.*, b.course_id, c.code as course_code, c.title as course_title, c.credit_units, b.session_id, b.semester_id, b.level as batch_level');
        $this->db->from('result_attempts a');
        $this->db->join('result_batches b', 'b.id = a.batch_id');
        $this->db->join('courses c', 'c.id = b.course_id');
        $this->db->where('a.student_id', $student_id);
        $this->db->where('b.status', 'published');
        $this->db->where('a.status', 'active');
        $this->db->order_by('a.created_at', 'ASC');
        
        $attempts = $this->db->get()->result_array();
        if (empty($attempts)) return 0.00;

        // Apply carryover corrections if any exist
        if ($this->db->table_exists('carryover_corrections')) {
            $this->db->select('cc.*, c.code as course_code, c.title as course_title, c.credit_units, sess.name as session_name, sem.name as semester_name, COALESCE(cur_batch.level, sem.name) as level, COALESCE(cur_batch.level, sem.name) as batch_level');
            $this->db->from('carryover_corrections cc');
            $this->db->join('courses c', 'c.id = cc.course_id');
            $this->db->join('academic_sessions sess', 'sess.id = cc.session_id', 'left');
            $this->db->join('semesters sem', 'sem.id = cc.semester_id', 'left');
            $this->db->join('result_attempts cur_attempt', 'cur_attempt.id = cc.result_attempt_id', 'left');
            $this->db->join('result_batches cur_batch', 'cur_batch.id = cur_attempt.batch_id', 'left');
            $this->db->where('cc.student_id', $student_id);
            $corrections = $this->db->get()->result_array();
            if (!empty($corrections)) {
                $existing_att_ids = array_fill_keys(array_column($attempts, 'id'), true);
                foreach ($corrections as $corr) {
                    $res_att_id = $corr['result_attempt_id'] ?? null;
                    if (!$res_att_id || empty($existing_att_ids[$res_att_id])) {
                        $attempts[] = $this->academic_calculator->correction_to_attempt($corr);
                    }
                }
            }
        }

        $metrics = $this->academic_calculator->calculate($attempts, [], 'reported');
        return (float)$metrics['cgpa'];
    }

            public function generate_broadsheet($session_id, $semester_id, $programme_id, $level = null)
    {
        // 1. Get all students in this programme (and level if specified) who have published results in this session/semester
        $this->db->select('DISTINCT(st.id) as student_id, u.full_name, ad.matric_number, ad.admission_number, st.admission_id');
        $this->db->from('result_attempts a');
        $this->db->join('result_batches b', 'b.id = a.batch_id');
        $this->db->join('students st', 'st.id = a.student_id');
        $this->db->join('users u', 'u.id = st.user_id', 'left');
        $this->db->join('admissions ad', 'ad.id = st.admission_id', 'left');
        $this->db->where('b.session_id', $session_id);
        $this->db->where('b.semester_id', $semester_id);
        $this->db->where('st.programme_id', $programme_id);
        if ($level) {
            $this->db->where('b.level', $level);
        }
        $this->db->where('b.status', 'published');
        $students = $this->db->get()->result_array();

        if (empty($students)) {
            return array('students' => [], 'courses' => []);
        }

        $student_ids = array_column($students, 'student_id');

        // 2. Get all courses that these students attempted in this session/semester
        $this->db->select('c.id, c.code, c.title, c.credit_units');
        $this->db->from('result_attempts a');
        $this->db->join('result_batches b', 'b.id = a.batch_id');
        $this->db->join('courses c', 'c.id = b.course_id');
        $this->db->where_in('a.student_id', $student_ids);
        $this->db->where('b.session_id', $session_id);
        $this->db->where('b.semester_id', $semester_id);
        $this->db->where('b.status', 'published');
        $this->db->group_by('c.id');
        $this->db->order_by('c.code', 'ASC');
        $courses = $this->db->get()->result_array();

        // 3. Get the actual attempts
        $this->db->select('a.student_id, b.course_id, a.total_score, a.grade, a.grade_point, a.credit_units, a.quality_point');
        $this->db->from('result_attempts a');
        $this->db->join('result_batches b', 'b.id = a.batch_id');
        $this->db->where('b.session_id', $session_id);
        $this->db->where('b.semester_id', $semester_id);
        if ($level) {
            $this->db->where('b.level', $level);
        }
        $this->db->where('b.status', 'published');
        $attempts = $this->db->get()->result_array();

        // Organize attempts by student_id and course_id
        $attempts_map = [];
        foreach ($attempts as $att) {
            $attempts_map[$att['student_id']][$att['course_id']] = $att;
        }

        // Calculate GPA for each student
        foreach ($students as &$st) {
            $st['results'] = $attempts_map[$st['student_id']] ?? [];
            
            // Current Semester GPA
            $st['gpa'] = $this->calculate_gpa($st['results']);
            
            // Cumulative CGPA
            // To get accurate CGPA, we need ALL published attempts up to this session
            // For simplicity in this demo, we'll calculate CGPA across all their history
            $this->db->select('a.*, c.credit_units');
            $this->db->from('result_attempts a');
            $this->db->join('result_batches b', 'b.id = a.batch_id');
            $this->db->join('courses c', 'c.id = b.course_id');
            $this->db->where('a.student_id', $st['student_id']);
            $this->db->where('b.status', 'published');
            $all_history = $this->db->get()->result_array();
            
            $st['cgpa'] = $this->calculate_cgpa($all_history);
        }

        return array(
            'courses' => $courses,
            'students' => $students
        );
    }

    public function get_student_history($student_id)
    {
        $this->db->select('a.*, b.course_id, c.code as course_code, c.title as course_title, c.credit_units, b.session_id, sess.name as session_name, sem.name as semester_name, b.level');
        $this->db->from('result_attempts a');
        $this->db->join('result_batches b', 'b.id = a.batch_id');
        $this->db->join('courses c', 'c.id = b.course_id');
        $this->db->join('academic_sessions sess', 'sess.id = b.session_id', 'left');
        $this->db->join('semesters sem', 'sem.id = b.semester_id', 'left');
        $this->db->where('a.student_id', $student_id);
        $this->db->where('b.status', 'published');
        $this->db->order_by('sess.name', 'ASC');
        $history = $this->db->get()->result_array();

        if (!empty($history) && $this->db->table_exists('carryover_corrections')) {
            $this->db->select('cc.*, c.code as course_code, c.title as course_title, c.credit_units, sess.name as session_name, sem.name as semester_name, COALESCE(cur_batch.level, sem.name) as level, COALESCE(cur_batch.level, sem.name) as batch_level');
            $this->db->from('carryover_corrections cc');
            $this->db->join('courses c', 'c.id = cc.course_id');
            $this->db->join('academic_sessions sess', 'sess.id = cc.session_id', 'left');
            $this->db->join('semesters sem', 'sem.id = cc.semester_id', 'left');
            $this->db->join('result_attempts cur_attempt', 'cur_attempt.id = cc.result_attempt_id', 'left');
            $this->db->join('result_batches cur_batch', 'cur_batch.id = cur_attempt.batch_id', 'left');
            $this->db->where('cc.student_id', $student_id);
            $corrections = $this->db->get()->result_array();
            if (!empty($corrections)) {
                $existing_att_ids = array_fill_keys(array_column($history, 'id'), true);
                $this->load->library('academic_calculator');
                foreach ($corrections as $corr) {
                    $res_att_id = $corr['result_attempt_id'] ?? null;
                    if (!$res_att_id || empty($existing_att_ids[$res_att_id])) {
                        $history[] = $this->academic_calculator->correction_to_attempt($corr);
                    }
                }
            }
        }

        if (empty($history)) {
            return array(
                'results' => array(),
                'cgpa' => 0.0,
                'total_credits' => 0,
                'total_points' => 0,
                'grouped' => array()
            );
        }

        $cgpa = $this->calculate_cgpa($history);
        
        // Group by session and semester
        $grouped = [];
        foreach ($history as $h) {
            $key = $h['session_name'] . ' - ' . $h['semester_name'];
            if (!isset($grouped[$key])) {
                $grouped[$key] = array(
                    'session' => $h['session_name'],
                    'semester' => $h['semester_name'],
                    'level' => $h['level'] ?? ($h['semester_name'] ?? ''),
                    'results' => []
                );
            }
            $grouped[$key]['results'][] = $h;
        }

        foreach ($grouped as &$group) {
            $group['gpa'] = $this->calculate_gpa($group['results']);
        }

        return array(
            'cgpa' => $cgpa,
            'sessions' => array_values($grouped)
        );
    }

    public function get_cgpa_list($programme_id = null)
    {
        $this->db->select('st.id as student_id, st.matric_number, st.first_name, st.last_name, st.middle_name, p.name as programme_name');
        $this->db->from('students st');
        $this->db->join('programmes p', 'p.id = st.programme_id', 'left');
        if ($programme_id) {
            $this->db->where('st.programme_id', $programme_id);
        }
        $students = $this->db->get()->result_array();

        foreach ($students as &$st) {
            $this->db->select('a.*');
            $this->db->from('result_attempts a');
            $this->db->join('result_batches b', 'b.id = a.batch_id');
            $this->db->where('a.student_id', $st['student_id']);
            $this->db->where('b.status', 'published');
            $history = $this->db->get()->result_array();
            
            $st['cgpa'] = $this->calculate_cgpa($history);
            $st['total_credits'] = array_sum(array_column($history, 'credit_units'));
        }

        return $students;
    }
}

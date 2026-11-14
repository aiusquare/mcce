<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Statement_model extends CI_Model
{
    public function __construct()
    {
        parent::__construct();
        $this->load->database();
        $this->load->model('Results_model');
    }

    public function get_statement($student_id, $scope = 'full', $session_id = null, $semester_id = null, $viewer_context = 'admin')
    {
        // 1. Get Student Profile
        $this->db->select('s.*, u.full_name as student_name, p.name as programme_name, d.name as department_name, adm.matric_number, adm.admission_number');
        $this->db->from('students s');
        $this->db->join('users u', 'u.id = s.user_id', 'left');
        $this->db->join('programmes p', 'p.id = s.programme_id', 'left');
        $this->db->join('departments d', 'd.id = s.department_id', 'left');
        if ($this->db->table_exists('admissions')) {
            $this->db->join('admissions adm', 'adm.id = s.admission_id', 'left');
        }
        $this->db->where('s.id', $student_id);
        $student = $this->db->get()->row_array();

        if (!$student) {
            return null;
        }

        // 2. Status Policy
        $allowed_statuses = ($viewer_context === 'admin') ? array('approved', 'published') : array('published');

        // 3. Fetch All Attempts (for accurate CGPA progression)
        $this->db->select('a.*, b.course_id, c.code as course_code, c.title as course_title, c.credit_units, b.session_id, sess.name as session_name, b.semester_id as contact_id, sem.name as contact_name, b.level, b.status as batch_status, sess.start_date');
        $this->db->from('result_attempts a');
        $this->db->join('result_batches b', 'b.id = a.batch_id');
        $this->db->join('courses c', 'c.id = b.course_id');
        $this->db->join('academic_sessions sess', 'sess.id = b.session_id', 'left');
        $this->db->join('semesters sem', 'sem.id = b.semester_id', 'left');
        $this->db->where('a.student_id', $student_id);
        $this->db->where_in('b.status', $allowed_statuses);
        // Order by session start_date, then semester to ensure strict chronological order
        $this->db->order_by('sess.start_date', 'ASC');
        $this->db->order_by('sess.name', 'ASC');
        $this->db->order_by('sem.id', 'ASC'); // assuming sem.id or something maintains semester order
        $this->db->order_by('a.created_at', 'ASC');
        
        $all_history = $this->db->get()->result_array();

        // Apply carryover corrections if any exist
        if ($this->db->table_exists('carryover_corrections')) {
            $this->db->select('cc.*, c.code as course_code, c.title as course_title, c.credit_units, sess.name as session_name, sem.name as contact_name, sem.name as semester_name, COALESCE(cur_batch.level, sem.name) as level, COALESCE(cur_batch.status, "published") as batch_status, sess.start_date');
            $this->db->from('carryover_corrections cc');
            $this->db->join('courses c', 'c.id = cc.course_id');
            $this->db->join('academic_sessions sess', 'sess.id = cc.session_id', 'left');
            $this->db->join('semesters sem', 'sem.id = cc.semester_id', 'left');
            $this->db->join('result_attempts cur_attempt', 'cur_attempt.id = cc.result_attempt_id', 'left');
            $this->db->join('result_batches cur_batch', 'cur_batch.id = cur_attempt.batch_id', 'left');
            $this->db->where('cc.student_id', $student_id);
            $corrections = $this->db->get()->result_array();

            if (!empty($corrections)) {
                $existing_att_ids = array_fill_keys(array_column($all_history, 'id'), true);
                $this->load->library('academic_calculator');
                foreach ($corrections as $corr) {
                    $res_att_id = $corr['result_attempt_id'] ?? null;
                    if (!$res_att_id || empty($existing_att_ids[$res_att_id])) {
                        $att = $this->academic_calculator->correction_to_attempt($corr);
                        $att['contact_id'] = $corr['semester_id'];
                        $att['contact_name'] = $corr['contact_name'] ?? $corr['semester_name'];
                        $att['level'] = $corr['level'];
                        $att['batch_status'] = $corr['batch_status'] ?? 'published';
                        $att['start_date'] = $corr['start_date'] ?? null;
                        $att['status'] = 'active';
                        $all_history[] = $att;
                    }
                }
            }
        }

        // Sort chronologically across historical attempts and carryover corrections
        usort($all_history, function($a, $b) {
            $sd_a = $a['start_date'] ?? '';
            $sd_b = $b['start_date'] ?? '';
            if ($sd_a !== $sd_b) {
                return strcmp($sd_a, $sd_b);
            }
            $sess_a = $a['session_name'] ?? '';
            $sess_b = $b['session_name'] ?? '';
            if ($sess_a !== $sess_b) {
                return strcmp($sess_a, $sess_b);
            }
            $cid_a = $a['contact_id'] ?? '';
            $cid_b = $b['contact_id'] ?? '';
            if ($cid_a !== $cid_b) {
                return strcmp($cid_a, $cid_b);
            }
            $ca_a = $a['created_at'] ?? '';
            $ca_b = $b['created_at'] ?? '';
            return strcmp($ca_a, $ca_b);
        });

        // Group by period (session + contact)
        $periods = array();
        foreach ($all_history as $h) {
            $period_key = $h['session_id'] . '_' . $h['contact_id'];
            if (!isset($periods[$period_key])) {
                $periods[$period_key] = array(
                    'session' => $h['session_name'],
                    'session_id' => $h['session_id'],
                    'contact' => $h['contact_name'],
                    'contact_id' => $h['contact_id'],
                    'level' => $h['level'],
                    'courses' => array(),
                    'raw_attempts' => array(),
                    'batch_status' => $h['batch_status']
                );
            }
            $periods[$period_key]['raw_attempts'][] = $h;
        }

        // We process chronologically to calculate previous and current CGPAs
        $accumulated_attempts = array();
        $processed_periods = array();
        $global_outstanding = array();

        foreach ($periods as $period_key => $p) {
            // Calculate Previous Metrics before adding current period's attempts
            $prev_metrics = $this->_calculate_metrics($accumulated_attempts);

            // Now add current period attempts
            $current_attempts = $p['raw_attempts'];
            $accumulated_attempts = array_merge($accumulated_attempts, $current_attempts);

            // Calculate Current Metrics (just this period)
            $curr_metrics = $this->_calculate_metrics($current_attempts, true);

            // Calculate Cumulative Metrics (everything up to now)
            $cum_metrics = $this->_calculate_metrics($accumulated_attempts);

            // Courses for this period
            $courses = array();
            foreach ($current_attempts as $att) {
                // Determine if repeat/carryover (for visual flagging)
                $is_repeat = false; // Add logic if needed
                
                // Track outstanding globally
                if ($att['grade'] === 'F' || $att['status'] === 'missing') {
                    $global_outstanding[$att['course_code']] = $att['course_code'] . ' - ' . $att['course_title'];
                } else {
                    unset($global_outstanding[$att['course_code']]);
                }

                $courses[] = array(
                    'course_id' => $att['course_id'],
                    'course_code' => $att['course_code'],
                    'course_title' => $att['course_title'],
                    'credit_unit' => $att['credit_units'],
                    'score' => $att['total_score'],
                    'grade' => $att['grade'],
                    'grade_point' => $att['grade_point'],
                    'quality_point' => $att['quality_point'],
                    'status' => $att['status'],
                    'batch_status' => $att['batch_status']
                );
            }

            $processed_periods[] = array(
                'session' => $p['session'],
                'session_id' => $p['session_id'],
                'contact' => $p['contact'],
                'contact_id' => $p['contact_id'],
                'level' => $p['level'],
                'batch_status' => $p['batch_status'],
                'courses' => $courses,
                
                'registered_credits' => $curr_metrics['tcr'],
                'earned_credits' => $curr_metrics['tce'],
                'quality_points' => $curr_metrics['tqp'],
                'gpa' => $curr_metrics['gpa'],
                
                'previous_cgpa' => $prev_metrics['gpa'], // CGPA up to last period
                'current_cgpa' => $cum_metrics['gpa'],   // CGPA up to this period
                
                'academic_standing' => empty($global_outstanding) ? 'Good Standing' : 'Carryover',
                'outstanding_courses' => array_values($global_outstanding)
            );
        }

        // Apply Scope Filter
        $final_periods = array();
        if ($scope === 'session' && $session_id) {
            foreach ($processed_periods as $p) {
                if ($p['session_id'] == $session_id) $final_periods[] = $p;
            }
        } else if ($scope === 'contact' && $session_id && $semester_id) {
            foreach ($processed_periods as $p) {
                if ($p['session_id'] == $session_id && $p['contact_id'] == $semester_id) $final_periods[] = $p;
            }
        } else {
            $final_periods = $processed_periods; // Full history
        }

        return array(
            'student' => array(
                'student_name' => $student['student_name'],
                'matric_number' => isset($student['matric_number']) ? $student['matric_number'] : null,
                'admission_number' => isset($student['admission_number']) ? $student['admission_number'] : null,
                'programme' => $student['programme_name'],
                'department' => $student['department_name'],
                'current_level' => $student['current_level'],
                'student_status' => $student['status'],
                'academic_standing' => empty($global_outstanding) ? 'Good Standing' : 'Carryover'
            ),
            'scope' => $scope,
            'current_cgpa' => empty($processed_periods) ? 0.0 : end($processed_periods)['current_cgpa'],
            'academic_periods' => array_values($final_periods),
            'global_outstanding' => array_values($global_outstanding),
            'generated_at' => date('Y-m-d H:i:s')
        );
    }

    private function _calculate_metrics($attempts, $raw_sum = false)
    {
        if (!$this->load->is_loaded('academic_calculator')) {
            $this->load->library('academic_calculator');
        }
        $res = $this->academic_calculator->calculate($attempts, [], 'reported');
        return array(
            'tcr' => (int)$res['registered_credits'],
            'tce' => (int)$res['earned_credits'],
            'tqp' => (float)$res['quality_points'],
            'gpa' => (float)$res['gpa']
        );
    }
}

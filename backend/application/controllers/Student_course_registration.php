<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Student_course_registration extends CI_Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->load->model('Auth_model');
        $this->load->model('Course_registration_model');
        $this->load->model('Courses_model');
        $this->load->model('Student_model');
        if (!class_exists('Registration_service', false)) {
            if (file_exists(APPPATH . 'libraries/Registration_service.php')) {
                require_once APPPATH . 'libraries/Registration_service.php';
            } elseif (file_exists(APPPATH . 'libraries/registration_service.php')) {
                require_once APPPATH . 'libraries/registration_service.php';
            }
        }
        $this->load->library('Registration_service');
    }

    private function require_login()
    {
        $headers = $this->input->request_headers();
        $auth_header = isset($headers['Authorization']) ? $headers['Authorization'] : (isset($headers['authorization']) ? $headers['authorization'] : '');
        if (empty($auth_header)) {
            $this->json_response(401, array('status' => 'error', 'message' => 'Unauthorized'));
        }
        $token = str_replace('Bearer ', '', $auth_header);
        $user = $this->Auth_model->validate_student_token($token);
        if (!$user) {
            $this->json_response(401, array('status' => 'error', 'message' => 'Invalid or expired token'));
        }
        return $user;
    }

    private function json_response($code, $data)
    {
        $this->output
            ->set_status_header($code)
            ->set_content_type('application/json')
            ->set_output(json_encode($data))
            ->_display();
        exit;
    }

    public function get_context()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();

        $session_id = $this->input->get('session_id', true);
        $semester_id = $this->input->get('semester_id', true);

        $active_session = $this->Courses_model->get_active_session();
        if (!$active_session || empty($active_session['id'])) {
            return $this->json_response(409, array('status' => 'error', 'message' => 'Course registration is unavailable because no active academic session is configured.'));
        }
        if ($session_id && $session_id !== $active_session['id']) {
            return $this->json_response(409, array('status' => 'error', 'message' => 'Course registration is only available for the active academic session.'));
        }
        $session_id = $active_session['id'];

        if (!$semester_id && $this->db->table_exists('semesters')) {
            $semester = $this->db->order_by('sort_order', 'asc')->get('semesters', 1)->row_array();
            $semester_id = $semester && isset($semester['id']) ? $semester['id'] : null;
        }
        if (!$semester_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'A registration semester must be configured.'));
        }

        // Get student details
        $this->Student_model->ensure_student_levels_synced();
        $this->db->where('user_id', $user['id']);
        $student = $this->db->get('students')->row_array();
        if (!$student) {
            return $this->json_response(404, array('status' => 'error', 'message' => 'Student record not found'));
        }
        $student['current_level'] = $this->resolve_canonical_student_level($student, $active_session);

        // 1. Get registration settings to see if it's open
        $settings = $this->Course_registration_model->get_registration_settings($session_id, $semester_id);
        
        // 2. Get credit rules
        $rules = $this->Course_registration_model->get_credit_rules($student['programme_id'], $student['current_level'], $semester_id);

        // 3. Get all courses for this programme and level (Curriculum)
        $this->db->where('programme_id', $student['programme_id']);
        $this->db->where('level', $student['current_level']);
        $courses = $this->db->get('courses')->result_array();

        // Separate core and elective
        $core_courses = array();
        $elective_courses = array();
        foreach ($courses as $c) {
            if (strtolower($c['type']) === 'elective') {
                $elective_courses[] = $c;
            } else {
                $core_courses[] = $c;
            }
        }

        // 4. Get existing registration if any
        $registration = $this->Course_registration_model->get_student_registration($student['id'], $session_id, $semester_id, $student['current_level']);
        $registration_items = array();
        if ($registration) {
            $registration_items = $this->Course_registration_model->get_registration_items($registration['id']);
        }

        // 5. Detect Carryovers automatically from Academic History
        $carryovers = array();
        if ($this->db->table_exists('result_attempts')) {
            $this->load->model('Results_model');
            $history_data = $this->Results_model->get_student_history($student['id']);
            
            if ($history_data && isset($history_data['history'])) {
                $passed_courses = array();
                $failed_courses = array();
                
                // Process chronologically to find latest status
                foreach ($history_data['history'] as $group) {
                    foreach ($group['results'] as $res) {
                        if (in_array(strtoupper($res['grade']), ['A', 'B', 'C', 'D', 'E', 'P'])) {
                            $passed_courses[$res['course_id']] = true;
                            unset($failed_courses[$res['course_id']]); // Cleared
                        } else if (strtoupper($res['grade']) === 'F') {
                            if (!isset($passed_courses[$res['course_id']])) {
                                $failed_courses[$res['course_id']] = array(
                                    'id' => $res['course_id'],
                                    'code' => $res['course_code'],
                                    'title' => $res['course_title'],
                                    'credit_units' => $res['credit_units'] ?? 0, // Fallback if missing
                                    'type' => 'carryover'
                                );
                            }
                        }
                    }
                }
                
                // Fetch full course details for failed ones
                if (!empty($failed_courses)) {
                    $this->db->where_in('id', array_keys($failed_courses));
                    $carryover_details = $this->db->get('courses')->result_array();
                    foreach ($carryover_details as &$co) {
                        $co['type'] = 'carryover';
                        $carryovers[] = $co;
                    }
                }
            }
        }

        return $this->json_response(200, array(
            'status' => 'success',
            'data' => array(
                'student' => $student,
                'session_id' => $session_id,
                'session_name' => isset($active_session['name']) ? $active_session['name'] : null,
                'semester_id' => $semester_id,
                'settings' => $settings,
                'rules' => $rules,
                'core_courses' => $core_courses,
                'elective_courses' => $elective_courses,
                'carryovers' => $carryovers,
                'registration' => $registration,
                'registration_items' => $registration_items
            )
        ));
    }

    public function save()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return $this->json_response(405, array('status' => 'error', 'message' => 'Method not allowed'));
        }
        $user = $this->require_login();
        $payload = json_decode(file_get_contents('php://input'), true);

        $student_id = $payload['student_id'] ?? null;
        $session_id = $payload['session_id'] ?? null;
        $semester_id = $payload['semester_id'] ?? null;
        $courses = $payload['courses'] ?? array();
        $action = $payload['action'] ?? 'draft'; // draft or submit

        // Verify student
        $this->Student_model->ensure_student_levels_synced();
        $this->db->where('user_id', $user['id']);
        $student = $this->db->get('students')->row_array();
        if (!$student) {
            return $this->json_response(404, array('status' => 'error', 'message' => 'Student record not found'));
        }
        $student_id = $student['id'];

        $active_session = $this->Courses_model->get_active_session();
        if (!$active_session || empty($active_session['id'])) {
            return $this->json_response(409, array('status' => 'error', 'message' => 'Course registration is unavailable because no active academic session is configured.'));
        }
        $student['current_level'] = $this->resolve_canonical_student_level($student, $active_session);
        if ($session_id && $session_id !== $active_session['id']) {
            return $this->json_response(409, array('status' => 'error', 'message' => 'Course registration is only available for the active academic session.'));
        }
        $session_id = $active_session['id'];
        if (!$semester_id) {
            if ($this->db->table_exists('semesters')) {
                $semester = $this->db->order_by('sort_order', 'asc')->get('semesters', 1)->row_array();
                $semester_id = $semester && isset($semester['id']) ? $semester['id'] : null;
            }
        }

        if (!$session_id || !$semester_id) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Session and semester required'));
        }

        // Verify settings / registration window
        $settings = $this->Course_registration_model->get_registration_settings($session_id, $semester_id);
        $is_late = false;
        $now_time = time();

        if ($settings) {
            if (isset($settings['status']) && $settings['status'] === 'closed') {
                return $this->json_response(400, array('status' => 'error', 'message' => 'Course registration is currently closed.'));
            }

            if (!empty($settings['opens_at'])) {
                $open_ts = strtotime($settings['opens_at']);
                if ($open_ts && $now_time < $open_ts) {
                    return $this->json_response(400, array(
                        'status' => 'error',
                        'message' => 'Registration window has not opened yet. Opens on ' . date('d M Y, h:i A', $open_ts) . '.'
                    ));
                }
            }

            if (!empty($settings['closes_at'])) {
                $close_ts = strtotime($settings['closes_at']);
                if ($close_ts && $now_time > $close_ts) {
                    if (!empty($settings['late_closes_at'])) {
                        $late_close_ts = strtotime($settings['late_closes_at']);
                        if ($late_close_ts && $now_time > $late_close_ts) {
                            return $this->json_response(400, array(
                                'status' => 'error',
                                'message' => 'Registration window closed on ' . date('d M Y, h:i A', $late_close_ts) . '.'
                            ));
                        }
                        $is_late = true;
                    } else {
                        return $this->json_response(400, array(
                            'status' => 'error',
                            'message' => 'Registration window closed on ' . date('d M Y, h:i A', $close_ts) . '.'
                        ));
                    }
                }
            }
        }

        // Find existing registration
        $registration = $this->Course_registration_model->get_student_registration($student['id'], $session_id, $semester_id, $student['current_level']);
        if ($registration && in_array($registration['status'], ['submitted', 'approved', 'locked'])) {
            return $this->json_response(400, array('status' => 'error', 'message' => 'Registration has already been ' . $registration['status'] . ' and cannot be edited.'));
        }

        // Validate submitted courses belong to student's programme or are outstanding carryovers
        $total_credits = 0;
        $course_map = array();
        if (!empty($courses)) {
            $submitted_cids = array_column($courses, 'course_id');
            $this->db->where_in('id', $submitted_cids);
            $course_records = $this->db->get('courses')->result_array();
            foreach ($course_records as $cr) {
                $course_map[$cr['id']] = $cr;
            }

            // Fetch outstanding carryovers for this student
            $allowed_carry_ids = array();
            if ($this->db->table_exists('result_attempts')) {
                $this->load->model('Outstanding_course_model');
                $allowed_carryovers = $this->Outstanding_course_model->get_outstanding_courses_before($student['id'], $session_id, $semester_id);
                $allowed_carry_ids = !empty($allowed_carryovers) ? array_keys($allowed_carryovers) : array();
            }

            foreach ($courses as $c) {
                $cid = $c['course_id'];
                if (!isset($course_map[$cid])) {
                    return $this->json_response(400, array('status' => 'error', 'message' => "Invalid course: course ID '{$cid}' not found."));
                }
                $cr = $course_map[$cid];
                $is_own_prog = ($cr['programme_id'] === $student['programme_id']);
                $is_valid_carry = in_array($cid, $allowed_carry_ids);
                if (!$is_own_prog && !$is_valid_carry) {
                    return $this->json_response(400, array('status' => 'error', 'message' => "Course {$cr['code']} does not belong to your academic programme."));
                }
                $units = isset($cr['credit_units']) ? (int)$cr['credit_units'] : (isset($cr['credit_unit']) ? (int)$cr['credit_unit'] : 0);
                $total_credits += $units;
            }
        }

        // Validate credit load if submitting
        if ($action === 'submit') {
            $rules = $this->Course_registration_model->get_credit_rules($student['programme_id'], $student['current_level'], $semester_id);
            if ($rules) {
                if ($total_credits < $rules['min_credits']) {
                    return $this->json_response(400, array('status' => 'error', 'message' => "Total credits ($total_credits) is below the minimum required (" . $rules['min_credits'] . ")."));
                }
                if ($total_credits > $rules['max_credits']) {
                    return $this->json_response(400, array('status' => 'error', 'message' => "Total credits ($total_credits) exceeds the maximum allowed (" . $rules['max_credits'] . ")."));
                }
            }
        }

        $this->db->trans_start();

        $reg_id = $registration ? $registration['id'] : $this->Course_registration_model->generate_uuid();
        
        // Save Registration
        $reg_data = array(
            'student_id' => $student['id'],
            'session_id' => $session_id,
            'semester_id' => $semester_id,
            'programme_id' => $student['programme_id'],
            'level' => $student['current_level'],
            'total_credits' => $total_credits,
            'status' => $action === 'submit' ? 'submitted' : 'draft',
            'updated_at' => date('Y-m-d H:i:s')
        );

        // Keep the legacy session reference during the transition, but write
        // the canonical teaching-session envelope for every new/editable
        // registration once the shared-hosting schema script has run.  A
        // student's entry cohort is immutable; it is copied only when that
        // proven value already exists, never inferred from the active session.
        if ($this->db->field_exists('academic_session_id', 'course_registrations')) {
            $reg_data['academic_session_id'] = $session_id;
        }
        if ($this->db->field_exists('entry_session_id', 'course_registrations')
            && !empty($student['entry_session_id'])) {
            $reg_data['entry_session_id'] = $student['entry_session_id'];
        }

        if ($action === 'submit') {
            $reg_data['submitted_at'] = date('Y-m-d H:i:s');
        }

        $student_policy = $this->registration_service->policy('student');

        if (!$registration) {
            $reg_data['id'] = $reg_id;
            $reg_data['created_at'] = date('Y-m-d H:i:s');
            $this->db->insert('course_registrations', $reg_data);
        } else {
            $this->db->where('id', $reg_id);
            $this->db->update('course_registrations', $reg_data);
        }

        // Fetch current active items for this registration
        $current_active_items = array(); // [course_id] => item
        if ($registration) {
            $this->db->select('id, course_id, registration_type');
            $this->db->where('registration_id', $reg_id);
            if ($this->db->field_exists('status', 'course_registration_items')) {
                $this->db->group_start();
                $this->db->where('status', 'active');
                $this->db->or_where('status IS NULL', null, false);
                $this->db->group_end();
            }
            $active_rows = $this->db->get('course_registration_items')->result_array();
            foreach ($active_rows as $ar) {
                $current_active_items[$ar['course_id']] = $ar;
            }
        }

        $submitted_course_ids = !empty($courses) ? array_column($courses, 'course_id') : array();

        // Soft-drop removed courses using the registration service
        foreach ($current_active_items as $c_id => $item) {
            if (!in_array($c_id, $submitted_course_ids)) {
                $drop_res = $this->registration_service->check_drop_allowed($item, $student_policy, array('in_window' => true));
                if ($drop_res['allowed'] || !in_array(strtolower($item['registration_type'] ?? ''), array('carryover', 'repeat'))) {
                    $this->registration_service->drop_course($reg_id, $c_id, $user['id'], 'Student updated registration');
                }
            }
        }

        // Add or reactivate courses using the registration service
        if (!empty($courses)) {
            foreach ($courses as $c) {
                $c_id = $c['course_id'];
                $c_type = isset($course_map[$c_id]) ? strtolower($course_map[$c_id]['type']) : 'core';
                $resolved_type = $this->registration_service->resolve_type(
                    $student['id'],
                    array('id' => $c_id, 'type' => $c_type),
                    array('session_id' => $session_id, 'semester_id' => $semester_id)
                );
                $this->registration_service->add_course($reg_id, $c_id, $resolved_type, $user['id']);
            }
        }

        $this->db->trans_complete();

        // After successful save, automatically trigger Carryover Sync
        // to ensure they have the latest correct carryovers without any tampering.
        if ($this->db->trans_status() !== FALSE) {
            $this->load->model('Outstanding_course_model');
            $this->load->model('Carryover_sync_model');
            try {
                $this->Carryover_sync_model->commit_sync($student['id'], $session_id, $semester_id);
                
                // We should also recalculate total_credits since commit_sync might have added/removed items
                $has_units = $this->db->field_exists('credit_units', 'courses');
                $credit_col = $has_units ? 'c.credit_units' : ($this->db->field_exists('credit_unit', 'courses') ? 'c.credit_unit' : '0');
                $this->db->select('COALESCE(SUM(' . $credit_col . '), 0) as total');
                $this->db->from('course_registration_items i');
                $this->db->join('courses c', 'c.id = i.course_id');
                $this->db->where('i.registration_id', $reg_id);
                if ($this->db->field_exists('status', 'course_registration_items')) {
                    $this->db->group_start();
                    $this->db->where('i.status', 'active');
                    $this->db->or_where('i.status IS NULL', null, false);
                    $this->db->group_end();
                }
                $new_credits_row = $this->db->get()->row_array();
                if ($new_credits_row) {
                    $this->db->where('id', $reg_id);
                    $this->db->update('course_registrations', array('total_credits' => $new_credits_row['total'] ? $new_credits_row['total'] : 0));
                }
            } catch (Exception $e) {
                // Log silently, don't fail the registration save
                log_message('error', 'Auto-Carryover Sync failed during registration save: ' . $e->getMessage());
            }
        }

        if ($this->db->trans_status() === FALSE) {
            return $this->json_response(500, array('status' => 'error', 'message' => 'Database transaction failed'));
        }

        $success_msg = $action === 'submit' 
            ? ($is_late ? 'Registration submitted (Late registration).' : 'Registration submitted successfully!') 
            : ($is_late ? 'Draft saved (Late registration window).' : 'Draft saved successfully.');

        return $this->json_response(200, array(
            'status'  => 'success',
            'is_late' => $is_late,
            'message' => $success_msg
        ));
    }

    private function resolve_canonical_student_level($student, $active_session)
    {
        if (!is_array($student)) {
            return '100';
        }
        $admission = null;
        if (!empty($student['admission_id']) && $this->db->table_exists('admissions')) {
            $admission = $this->db->get_where('admissions', array('id' => $student['admission_id']), 1)->row_array();
        }
        $entrySessionRef = '';
        foreach (array(
            isset($student['session_name']) ? $student['session_name'] : null,
            isset($student['entry_session_id']) ? $student['entry_session_id'] : null,
            isset($student['session_id']) ? $student['session_id'] : null,
            $admission && isset($admission['session_id']) ? $admission['session_id'] : null,
        ) as $candidate) {
            if ($candidate !== null && trim((string) $candidate) !== '') {
                $entrySessionRef = trim((string) $candidate);
                break;
            }
        }
        $entryMode = isset($student['entry_mode']) ? $student['entry_mode'] : null;
        $admissionLevel = $admission && isset($admission['level']) ? $admission['level'] : null;
        $admissionMode = $admission && isset($admission['mode_of_entry']) ? $admission['mode_of_entry'] : null;
        $matricNumber = $admission && isset($admission['matric_number']) ? $admission['matric_number'] : null;
        $programmeId = isset($student['programme_id']) ? $student['programme_id'] : null;

        return $this->Student_model->calculate_student_level(
            $entrySessionRef,
            $entryMode,
            $admissionLevel,
            $programmeId,
            $active_session,
            null,
            $admissionMode,
            $matricNumber
        );
    }
}

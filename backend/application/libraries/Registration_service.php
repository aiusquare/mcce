<?php
defined('BASEPATH') OR exit('No direct script access allowed');

/**
 * Registration_service
 *
 * Unified Business Logic and Rule Engine for Course Registrations.
 * Enforces policies across student, admin, and legacy workflows according
 * to Nigerian tertiary institutional standards (NUC BMAS: 15–24 units).
 */
class Registration_service
{
    protected $CI;

    public function __construct()
    {
        if (function_exists('get_instance')) {
            $this->CI =& get_instance();
        }
    }

    /**
     * Get policy configuration for the specified actor context.
     *
     * @param string $name 'student', 'admin', or 'legacy'
     * @return array
     */
    public function policy($name)
    {
        $key = strtolower(trim((string)$name));
        $policies = array(
            'student' => array(
                'name'                     => 'student',
                'enforce_window'           => true,
                'credit_load'              => 'block', // 15–24: block > 24, block < 15 on submit
                'enforce_fees'             => true,
                'enforce_programme_course' => true,
                'require_approval'         => true,
                'drop_core'                => 'blocked',
                'drop_elective'            => 'window_only',
                'drop_carryover'           => 'blocked',
                'drop_with_score'          => 'blocked',
            ),
            'admin' => array(
                'name'                     => 'admin',
                'enforce_window'           => false,
                'credit_load'              => 'warn', // warn only
                'enforce_fees'             => false,
                'enforce_programme_course' => true,
                'require_approval'         => false,
                'drop_core'                => 'warn',
                'drop_elective'            => 'allowed',
                'drop_carryover'           => 'reason_required',
                'drop_with_score'          => 'blocked_unless_forced',
            ),
            'legacy' => array(
                'name'                     => 'legacy',
                'enforce_window'           => false,
                'credit_load'              => 'skip', // skip limits for legacy bulk
                'enforce_fees'             => false,
                'enforce_programme_course' => true,
                'require_approval'         => false,
                'drop_core'                => 'warn',
                'drop_elective'            => 'allowed',
                'drop_carryover'           => 'reason_required',
                'drop_with_score'          => 'blocked_unless_forced',
            ),
        );

        if (!isset($policies[$key])) {
            throw new InvalidArgumentException("Unknown registration policy: {$name}");
        }

        return $policies[$key];
    }

    /**
     * Evaluates whether dropping an item is allowed under the given policy.
     *
     * @param array $item Course registration item details:
     *                    - registration_type: 'core', 'elective', 'carryover', 'repeat'
     *                    - has_score: bool (whether CA/Exam score is recorded)
     *                    - drop_reason: string (optional)
     * @param string|array $policy Policy name ('student', 'admin', 'legacy') or policy array
     * @param array $context Additional context:
     *                       - in_window: bool (for student elective drop check)
     *                       - force: bool (admin force override for scored drops)
     *                       - reason: string (admin reason for carryover drop)
     * @return array ['allowed' => bool, 'action' => 'allowed'|'blocked'|'warn', 'message' => string, 'reason_required' => bool]
     */
    public function check_drop_allowed($item, $policy, $context = array())
    {
        $pol = is_array($policy) ? $policy : $this->policy($policy);

        $has_score = !empty($item['has_score']) || !empty($item['has_recorded_score']);
        $force = !empty($context['force']) || !empty($item['force']);
        $type = strtolower((string)($item['registration_type'] ?? 'core'));
        $in_window = isset($context['in_window']) ? (bool)$context['in_window'] : true;
        $reason = trim((string)($context['reason'] ?? ($item['drop_reason'] ?? '')));

        // Rule 1: Scored course guard
        if ($has_score) {
            if ($pol['drop_with_score'] === 'blocked') {
                return array(
                    'allowed'         => false,
                    'action'          => 'blocked',
                    'message'         => 'Cannot drop course with recorded CA or Exam scores.',
                    'reason_required' => false
                );
            }
            if ($pol['drop_with_score'] === 'blocked_unless_forced' && !$force) {
                return array(
                    'allowed'         => false,
                    'action'          => 'blocked',
                    'message'         => 'Cannot drop course with recorded scores unless force override is specified.',
                    'reason_required' => false
                );
            }
        }

        // Rule 2: Carryover drop
        if ($type === 'carryover' || $type === 'repeat') {
            if ($pol['drop_carryover'] === 'blocked') {
                return array(
                    'allowed'         => false,
                    'action'          => 'blocked',
                    'message'         => 'Students cannot drop carryover courses.',
                    'reason_required' => false
                );
            }
            if ($pol['drop_carryover'] === 'reason_required') {
                if (empty($reason)) {
                    return array(
                        'allowed'         => false,
                        'action'          => 'blocked',
                        'message'         => 'A justification reason is required to drop a carryover course.',
                        'reason_required' => true
                    );
                }
                return array(
                    'allowed'         => true,
                    'action'          => 'allowed',
                    'message'         => 'Carryover drop authorized with reason.',
                    'reason_required' => true
                );
            }
        }

        // Rule 3: Core drop
        if ($type === 'core') {
            if ($pol['drop_core'] === 'blocked') {
                return array(
                    'allowed'         => false,
                    'action'          => 'blocked',
                    'message'         => 'Students cannot drop core courses.',
                    'reason_required' => false
                );
            }
            if ($pol['drop_core'] === 'warn') {
                return array(
                    'allowed'         => true,
                    'action'          => 'warn',
                    'message'         => 'Warning: Dropping a core curriculum course.',
                    'reason_required' => false
                );
            }
        }

        // Rule 4: Elective drop
        if ($type === 'elective') {
            if ($pol['drop_elective'] === 'window_only') {
                if (!$in_window) {
                    return array(
                        'allowed'         => false,
                        'action'          => 'blocked',
                        'message'         => 'Elective drop is only allowed during the active registration window.',
                        'reason_required' => false
                    );
                }
                return array(
                    'allowed'         => true,
                    'action'          => 'allowed',
                    'message'         => 'Elective course dropped within window.',
                    'reason_required' => false
                );
            }
            return array(
                'allowed'         => true,
                'action'          => 'allowed',
                'message'         => 'Elective drop allowed.',
                'reason_required' => false
            );
        }

        // Default fallback for any other course types
        return array(
            'allowed'         => true,
            'action'          => 'allowed',
            'message'         => 'Course drop allowed.',
            'reason_required' => false
        );
    }

    /**
     * Resolves canonical registration type for a course:
     * returns 'carryover' if outstanding for this student, otherwise the course's own type, lowercase.
     *
     * @param string $student_id
     * @param array|string $course Array with course details or course_id string
     * @param array $period Array with 'session_id' and 'semester_id'
     * @return string 'core', 'elective', or 'carryover'
     */
    public function resolve_type($student_id, $course, $period = array())
    {
        $course_id = is_array($course) ? ($course['id'] ?? null) : $course;
        $default_type = is_array($course) ? strtolower($course['type'] ?? 'core') : 'core';

        if (!$student_id || !$course_id) {
            return $default_type;
        }

        $session_id  = $period['session_id'] ?? null;
        $semester_id = $period['semester_id'] ?? null;

        // Check if student has outstanding carryover for this course before this period
        if ($this->CI) {
            if (!isset($this->CI->Outstanding_course_model)) {
                $this->CI->load->model('Outstanding_course_model');
            }
            if (isset($this->CI->Outstanding_course_model) && method_exists($this->CI->Outstanding_course_model, 'get_outstanding_courses_before')) {
                try {
                    $outstanding = $this->CI->Outstanding_course_model->get_outstanding_courses_before($student_id, $session_id, $semester_id);
                    if (!empty($outstanding)) {
                        $outstanding_course_ids = array();
                        foreach ($outstanding as $row) {
                            $cid = is_array($row) ? ($row['course_id'] ?? ($row['id'] ?? null)) : null;
                            if ($cid) {
                                $outstanding_course_ids[$cid] = true;
                            }
                        }
                        if (isset($outstanding_course_ids[$course_id])) {
                            return 'carryover';
                        }
                    }
                } catch (Exception $e) {
                    log_message('error', 'Registration_service::resolve_type carryover check error: ' . $e->getMessage());
                }
            }
        }

        return $default_type;
    }

    /**
     * Inserts an item, or re-activates a dropped item. It never creates a duplicate.
     *
     * @param string $registration_id
     * @param string $course_id
     * @param string $type 'core', 'elective', or 'carryover'
     * @param string $actor_id
     * @return array
     */
    public function add_course($registration_id, $course_id, $type = 'core', $actor_id = null)
    {
        if (!$this->CI || empty($registration_id) || empty($course_id)) {
            return array('success' => false, 'error' => 'Missing registration or course ID');
        }

        $canonical_type = strtolower(trim((string)$type));
        $now = date('Y-m-d H:i:s');
        $has_item_status = $this->CI->db->field_exists('status', 'course_registration_items');
        $has_dropped_at  = $this->CI->db->field_exists('dropped_at', 'course_registration_items');

        // Check for existing item
        $this->CI->db->where('registration_id', $registration_id);
        $this->CI->db->where('course_id', $course_id);
        $existing = $this->CI->db->get('course_registration_items')->row_array();

        if ($existing) {
            $current_status = $has_item_status ? strtolower((string)($existing['status'] ?? 'active')) : 'active';
            if ($current_status === 'active' || empty($existing['status'])) {
                // Already actively registered, no duplicate
                return array(
                    'success' => true,
                    'action'  => 'existing',
                    'item_id' => $existing['id'],
                    'message' => 'Course is already actively registered.'
                );
            }

            // Reactivate soft-dropped or obsolete item
            $upd = array(
                'registration_type' => $canonical_type,
            );
            if ($has_item_status) {
                $upd['status'] = 'active';
            }
            if ($has_dropped_at) {
                $upd['dropped_at']  = null;
                $upd['dropped_by']  = null;
                $upd['drop_reason'] = null;
            }
            $this->_execute_with_deadlock_retry(function() use ($existing, $upd) {
                $this->CI->db->where('id', $existing['id']);
                return $this->CI->db->update('course_registration_items', $upd);
            });

            return array(
                'success' => true,
                'action'  => 'reactivated',
                'item_id' => $existing['id'],
                'message' => 'Re-activated previously dropped course.'
            );
        }

        // Insert fresh item
        $item_id = $this->generate_uuid();
        $item = array(
            'id'                => $item_id,
            'registration_id'   => $registration_id,
            'course_id'         => $course_id,
            'registration_type' => $canonical_type,
            'created_at'        => $now,
        );
        if ($has_item_status) {
            $item['status'] = 'active';
        }
        $this->_execute_with_deadlock_retry(function() use ($item) {
            return $this->CI->db->insert('course_registration_items', $item);
        });

        return array(
            'success' => true,
            'action'  => 'inserted',
            'item_id' => $item_id,
            'message' => 'Course added successfully.'
        );
    }

    /**
     * Executes a DB write callback with automatic retry on MySQL deadlock (1213) or lock wait timeout (1205).
     */
    private function _execute_with_deadlock_retry($callback, $max_attempts = 3)
    {
        $orig_debug = $this->CI->db->db_debug;
        $attempt = 0;
        while (true) {
            $attempt++;
            if ($attempt < $max_attempts) {
                $this->CI->db->db_debug = false;
            } else {
                $this->CI->db->db_debug = $orig_debug;
            }

            $res = $callback();
            $err = $this->CI->db->error();
            $err_code = isset($err['code']) ? (int)$err['code'] : 0;

            $this->CI->db->db_debug = $orig_debug;

            if ($res !== false && $err_code === 0) {
                return $res;
            }

            if ($attempt < $max_attempts && in_array($err_code, array(1213, 1205), true)) {
                usleep(mt_rand(30000, 120000) * $attempt);
                continue;
            }

            return $res;
        }
    }

    /**
     * Soft-drops a registered course. Never deletes from database.
     *
     * @param string $registration_id
     * @param string $course_id
     * @param string $actor_id
     * @param string $reason
     * @return array
     */
    public function drop_course($registration_id, $course_id, $actor_id = null, $reason = null)
    {
        if (!$this->CI || empty($registration_id) || empty($course_id)) {
            return array('success' => false, 'error' => 'Missing registration or course ID');
        }

        $now = date('Y-m-d H:i:s');
        $has_item_status = $this->CI->db->field_exists('status', 'course_registration_items');
        $has_dropped_at  = $this->CI->db->field_exists('dropped_at', 'course_registration_items');

        $this->CI->db->where('registration_id', $registration_id);
        $this->CI->db->where('course_id', $course_id);
        $existing = $this->CI->db->get('course_registration_items')->row_array();

        if (!$existing) {
            return array('success' => false, 'error' => 'Registration item not found.');
        }

        $upd = array();
        if ($has_item_status) {
            $upd['status'] = 'dropped';
        }
        if ($has_dropped_at) {
            $upd['dropped_at']  = $now;
            $upd['dropped_by']  = $actor_id;
            $upd['drop_reason'] = $reason;
        }

        if (!empty($upd)) {
            $this->_execute_with_deadlock_retry(function() use ($existing, $upd) {
                $this->CI->db->where('id', $existing['id']);
                return $this->CI->db->update('course_registration_items', $upd);
            });
        } else {
            $this->_execute_with_deadlock_retry(function() use ($existing) {
                $this->CI->db->where('id', $existing['id']);
                return $this->CI->db->delete('course_registration_items');
            });
        }

        return array(
            'success' => true,
            'action'  => 'dropped',
            'item_id' => $existing['id'],
            'message' => 'Course soft-dropped successfully.'
        );
    }

    /**
     * Checks credit load bounds against policy and configurable rules (BMAS default: 15–24 units).
     *
     * @param string $registration_id
     * @param string $programme_id
     * @param string $level
     * @param string|array $policy
     * @param string $action 'draft' or 'submit'
     * @return array
     */
    public function check_credit_load($registration_id, $programme_id = null, $level = null, $policy = 'student', $action = 'submit')
    {
        $pol = is_array($policy) ? $policy : $this->policy($policy);

        // Legacy bypasses credit load checks completely
        if ($pol['credit_load'] === 'skip') {
            return array(
                'status'  => 'ok',
                'allowed' => true,
                'min'     => 0,
                'max'     => 999,
                'total'   => 0,
                'message' => 'Credit limit check skipped for legacy registration.'
            );
        }

        // Sum active credit units
        $total_credits = 0;
        if ($this->CI && $registration_id) {
            $has_units = $this->CI->db->field_exists('credit_units', 'courses');
            $credit_col = $has_units ? 'c.credit_units' : ($this->CI->db->field_exists('credit_unit', 'courses') ? 'c.credit_unit' : '0');
            $this->CI->db->select('COALESCE(SUM(' . $credit_col . '), 0) as total', false);
            $this->CI->db->from('course_registration_items i');
            $this->CI->db->join('courses c', 'c.id = i.course_id');
            $this->CI->db->where('i.registration_id', $registration_id);
            if ($this->CI->db->field_exists('status', 'course_registration_items')) {
                $this->CI->db->group_start();
                $this->CI->db->where('i.status', 'active');
                $this->CI->db->or_where('i.status IS NULL', null, false);
                $this->CI->db->group_end();
            }
            $row = $this->CI->db->get()->row_array();
            $total_credits = (int)($row['total'] ?? 0);
        }

        // Look up configurable rules (programme+level -> programme+ALL -> GLOBAL+level -> GLOBAL+ALL -> 15–24 default)
        $min = 15;
        $max = 24;

        if ($this->CI) {
            if (!isset($this->CI->Course_registration_model)) {
                $this->CI->load->model('Course_registration_model');
            }
            $rule = $this->CI->Course_registration_model->get_credit_rules($programme_id, $level);
            if ($rule) {
                if (isset($rule['min_credits']) && (int)$rule['min_credits'] > 0) $min = (int)$rule['min_credits'];
                if (isset($rule['max_credits']) && (int)$rule['max_credits'] > 0) $max = (int)$rule['max_credits'];
            }
        }

        // Admin policy: warn only, never block
        if ($pol['credit_load'] === 'warn') {
            if ($total_credits > $max) {
                return array(
                    'status'  => 'warn',
                    'allowed' => true,
                    'min'     => $min,
                    'max'     => $max,
                    'total'   => $total_credits,
                    'message' => "Warning: Total credits ({$total_credits}) exceeds maximum standard ({$max})."
                );
            }
            if ($total_credits < $min) {
                return array(
                    'status'  => 'warn',
                    'allowed' => true,
                    'min'     => $min,
                    'max'     => $max,
                    'total'   => $total_credits,
                    'message' => "Warning: Total credits ({$total_credits}) is below minimum standard ({$min})."
                );
            }
            return array(
                'status'  => 'ok',
                'allowed' => true,
                'min'     => $min,
                'max'     => $max,
                'total'   => $total_credits,
                'message' => 'Credit load is within standard limits.'
            );
        }

        // Student policy: block on limit violation
        if ($total_credits > $max) {
            return array(
                'status'  => 'block',
                'allowed' => false,
                'min'     => $min,
                'max'     => $max,
                'total'   => $total_credits,
                'message' => "Maximum credit limit of {$max} units exceeded (current: {$total_credits} units)."
            );
        }

        if ($action === 'submit' && $total_credits < $min) {
            return array(
                'status'  => 'block',
                'allowed' => false,
                'min'     => $min,
                'max'     => $max,
                'total'   => $total_credits,
                'message' => "Minimum credit load of {$min} units is required to submit (current: {$total_credits} units)."
            );
        }

        if ($total_credits < $min) {
            return array(
                'status'  => 'warn',
                'allowed' => true,
                'min'     => $min,
                'max'     => $max,
                'total'   => $total_credits,
                'message' => "Note: Minimum credit load for submission is {$min} units (currently {$total_credits} units)."
            );
        }

        return array(
            'status'  => 'ok',
            'allowed' => true,
            'min'     => $min,
            'max'     => $max,
            'total'   => $total_credits,
            'message' => 'Credit load is within standard limits.'
        );
    }

    /**
     * Recalculates total_credits on course_registrations for given ID(s), summing active items only.
     *
     * @param string|array $registration_ids Single ID or array of IDs
     * @return array [registration_id => total_credits]
     */
    public function recalculate_credits($registration_ids)
    {
        if (empty($registration_ids) || !$this->CI) {
            return array();
        }

        if (!is_array($registration_ids)) {
            $registration_ids = array($registration_ids);
        }
        $registration_ids = array_values(array_unique(array_filter($registration_ids)));
        sort($registration_ids);
        if (empty($registration_ids)) {
            return array();
        }

        $now = date('Y-m-d H:i:s');
        $has_item_status = $this->CI->db->field_exists('status', 'course_registration_items');
        $has_updated_at  = $this->CI->db->field_exists('updated_at', 'course_registrations');
        $has_units       = $this->CI->db->field_exists('credit_units', 'courses');
        $credit_col      = $has_units ? 'c.credit_units' : ($this->CI->db->field_exists('credit_unit', 'courses') ? 'c.credit_unit' : '0');

        $totals_map = array();
        foreach (array_chunk($registration_ids, 300) as $chunk) {
            $this->CI->db->select('i.registration_id, COALESCE(SUM(' . $credit_col . '), 0) as total_units', false);
            $this->CI->db->from('course_registration_items i');
            $this->CI->db->join('courses c', 'c.id = i.course_id', 'inner');
            $this->CI->db->where_in('i.registration_id', $chunk);
            if ($has_item_status) {
                $this->CI->db->group_start();
                $this->CI->db->where('i.status', 'active');
                $this->CI->db->or_where('i.status IS NULL', null, false);
                $this->CI->db->group_end();
            }
            $this->CI->db->group_by('i.registration_id');
            $rows = $this->CI->db->get()->result_array();

            $chunk_map = array_fill_keys($chunk, 0);
            foreach ($rows as $r) {
                $chunk_map[$r['registration_id']] = (int)$r['total_units'];
            }

            $update_batch = array();
            foreach ($chunk_map as $reg_id => $total_units) {
                $totals_map[$reg_id] = $total_units;
                $row_upd = array(
                    'id'            => $reg_id,
                    'total_credits' => $total_units,
                );
                if ($has_updated_at) {
                    $row_upd['updated_at'] = $now;
                }
                $update_batch[] = $row_upd;
            }
            if (!empty($update_batch)) {
                $this->CI->db->update_batch('course_registrations', $update_batch, 'id');
            }
        }

        return $totals_map;
    }

    /**
     * Generates a standard UUID v4 string.
     *
     * @return string
     */
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


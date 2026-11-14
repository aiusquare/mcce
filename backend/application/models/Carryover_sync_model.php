<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Carryover_sync_model extends CI_Model {

    public function __construct() {
        parent::__construct();
        $this->load->model('Outstanding_course_model');
    }

    /**
     * Preview the Carryover Synchronization for a student in a target period.
     * Returns the exact reconciliation actions without committing them.
     */
    public function preview_sync($student_id, $target_session_id, $target_semester_id) {
        $desired_carryovers = $this->Outstanding_course_model->get_outstanding_courses_before($student_id, $target_session_id, $target_semester_id);
        
        // Fetch current period's registration envelope
        // Fetch current period's registration envelope (supporting dual academic_session_id match)
        $this->db->where('student_id', $student_id);
        $this->db->where('session_id', $target_session_id);
        if ($this->db->field_exists('academic_session_id', 'course_registrations')) {
            $this->db->group_start();
            $this->db->where('academic_session_id', $target_session_id);
            $this->db->or_group_start();
            $this->db->group_start();
            $this->db->where('academic_session_id IS NULL', null, false);
            $this->db->or_where('academic_session_id', '');
            $this->db->group_end();
            $this->db->where('session_id', $target_session_id);
            $this->db->group_end();
            $this->db->group_end();
        } else {
            $this->db->where('session_id', $target_session_id);
        }
        $this->db->where('semester_id', $target_semester_id);
        $envelope = $this->db->get('course_registrations')->row_array();
        
        $existing_auto_carryovers = [];
        $existing_other_items = [];
        $current_results = [];

        if ($envelope) {
            // Fetch items (active or null) with course details
            $this->db->select('cri.*, c.code as course_code, c.title as course_title');
            $this->db->from('course_registration_items cri');
            $this->db->join('courses c', 'c.id = cri.course_id', 'left');
            $this->db->where('cri.registration_id', $envelope['id']);
            if ($this->db->field_exists('status', 'course_registration_items')) {
                $this->db->group_start();
                $this->db->where('cri.status', 'active');
                $this->db->or_where('cri.status IS NULL', null, false);
                $this->db->group_end();
            }
            $items = $this->db->get()->result_array();
            
            foreach ($items as $item) {
                if (strtolower($item['registration_type']) === 'carryover') {
                    $existing_auto_carryovers[$item['course_id']] = $item;
                } else {
                    $existing_other_items[$item['course_id']] = $item;
                }
            }
            
            // Check for published results for these current registrations
            $has_batch_acad = $this->db->field_exists('academic_session_id', 'result_batches');
            $session_condition = $has_batch_acad 
                ? "(b.academic_session_id = ? OR ((b.academic_session_id IS NULL OR b.academic_session_id = '') AND b.session_id = ?))"
                : "b.session_id = ?";
            $sql = "
                SELECT b.course_id
                FROM result_attempts a
                JOIN result_batches b ON b.id = a.batch_id
                WHERE a.student_id = ? AND {$session_condition} AND b.semester_id = ?
            ";
            $sql_params = $has_batch_acad
                ? [$student_id, $target_session_id, $target_session_id, $target_semester_id]
                : [$student_id, $target_session_id, $target_semester_id];
            $results = $this->db->query($sql, $sql_params)->result_array();
            foreach ($results as $res) {
                $current_results[$res['course_id']] = true;
            }
        }

        $to_add = [];
        $to_keep = [];
        $to_remove = [];
        $conflicts = [];

        // 1. Process Desired against Existing
        foreach ($desired_carryovers as $cid => $att) {
            if (isset($existing_auto_carryovers[$cid])) {
                $to_keep[] = [
                    'course_id' => $cid,
                    'course_code' => $att['course_code'],
                    'course_title' => $att['course_title'],
                    'item_id' => $existing_auto_carryovers[$cid]['id'],
                    'reason' => 'Already correctly synced.'
                ];
            } else {
                // Not synced yet. Check for conflict with normal registration.
                if (isset($existing_other_items[$cid])) {
                    $conflicts[] = [
                        'course_id' => $cid,
                        'course_code' => $att['course_code'],
                        'course_title' => $att['course_title'],
                        'reason' => 'Requires carryover sync, but already registered manually as ' . $existing_other_items[$cid]['registration_type']
                    ];
                } else {
                    $to_add[] = [
                        'course_id' => $cid,
                        'course_code' => $att['course_code'],
                        'course_title' => $att['course_title'],
                        'origin_result_attempt_id' => $att['id'],
                        'origin_session_id' => $att['session_id'],
                        'origin_semester_id' => $att['semester_id'],
                        'origin_level' => $att['level'],
                        'origin_score' => $att['total_score'],
                        'origin_grade' => $att['grade']
                    ];
                }
            }
        }

        // 2. Process Existing against Desired (To Remove)
        foreach ($existing_auto_carryovers as $cid => $item) {
            if (!isset($desired_carryovers[$cid])) {
                // It's no longer a desired carryover (maybe result was corrected to Pass).
                // Check if it's safe to remove.
                if (isset($current_results[$cid])) {
                    $conflicts[] = [
                        'course_id' => $cid,
                        'course_code' => $item['course_code'] ?? 'N/A',
                        'course_title' => $item['course_title'] ?? '',
                        'reason' => 'Auto-carryover is obsolete but cannot be removed because a result has already been published for it in the current period.'
                    ];
                } else {
                    $to_remove[] = [
                        'course_id' => $cid,
                        'item_id' => $item['id'],
                        'course_code' => $item['course_code'] ?? 'N/A',
                        'course_title' => $item['course_title'] ?? '',
                        'reason' => 'Obsolete carryover. Originating result was likely corrected to Pass.'
                    ];
                }
            }
        }

        return [
            'to_add' => $to_add,
            'to_keep' => $to_keep,
            'to_remove' => $to_remove,
            'conflicts' => $conflicts,
            'envelope_id' => $envelope ? $envelope['id'] : null
        ];
    }

    private function generate_uuid() {
        return sprintf( '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand( 0, 0xffff ), mt_rand( 0, 0xffff ),
            mt_rand( 0, 0xffff ),
            mt_rand( 0, 0x0fff ) | 0x4000,
            mt_rand( 0, 0x3fff ) | 0x8000,
            mt_rand( 0, 0xffff ), mt_rand( 0, 0xffff ), mt_rand( 0, 0xffff )
        );
    }

    /**
     * Commits the synchronization logic based on the preview plan.
     */
    public function commit_sync($student_id, $target_session_id, $target_semester_id) {
        $preview = $this->preview_sync($student_id, $target_session_id, $target_semester_id);
        
        $this->db->trans_start();

        $envelope_id = $preview['envelope_id'];
        
        // Ensure envelope exists if there's anything to add
        if (!$envelope_id && !empty($preview['to_add'])) {
            $this->db->where('id', $student_id);
            $student = $this->db->get('students')->row_array();
            
            $env_data = [
                'id' => $this->generate_uuid(),
                'student_id' => $student_id,
                'session_id' => $target_session_id,
                'semester_id' => $target_semester_id,
                'status' => 'approved',
                'created_at' => date('Y-m-d H:i:s')
            ];
            // Explicitly bind the teaching session envelope and immutable entry cohort
            if ($this->db->field_exists('academic_session_id', 'course_registrations')) {
                $env_data['academic_session_id'] = $target_session_id;
            }
            if ($this->db->field_exists('entry_session_id', 'course_registrations') && !empty($student['entry_session_id'])) {
                $env_data['entry_session_id'] = $student['entry_session_id'];
            }
            $optional_fields = [
                'programme_id' => $student['programme_id'] ?? null,
                'level' => $student['current_level'] ?? null,
                'level' => $student['current_level'] ?? ($student['level'] ?? null),
                'total_credits' => 0
            ];
            foreach ($optional_fields as $field => $value) {
                if ($this->db->field_exists($field, 'course_registrations')) {
                    $env_data[$field] = $value;
                }
            }
            $this->db->insert('course_registrations', $env_data);
            $envelope_id = $env_data['id'];
        }

        $sync_run_id = uniqid('sync_', true);
        $now = date('Y-m-d H:i:s');

        // Execute Additions
        foreach ($preview['to_add'] as $add) {
            $item = [
                'id' => $this->generate_uuid(),
                'registration_id' => $envelope_id,
                'course_id' => $add['course_id'],
                'registration_type' => 'carryover',
                'status' => 'active',
                'created_at' => $now
            ];
            $origin_fields = [
                'source' => 'AUTO',
                'origin_result_attempt_id' => $add['origin_result_attempt_id'],
                'origin_session_id' => $add['origin_session_id'],
                'origin_semester_id' => $add['origin_semester_id'],
                'origin_level' => $add['origin_level'],
                'origin_score' => $add['origin_score'],
                'origin_grade' => $add['origin_grade'],
                'last_synced_at' => $now,
                'sync_run_id' => $sync_run_id,
                'sync_status' => 'synced'
            ];
            foreach ($origin_fields as $field => $value) {
                if ($this->db->field_exists($field, 'course_registration_items')) {
                    $item[$field] = $value;
                }
            }
            $this->db->insert('course_registration_items', $item);
        }

        // Execute Removals: Soft-mark obsolete instead of deleting
        $has_item_status = $this->db->field_exists('status', 'course_registration_items');
        $has_dropped_at  = $this->db->field_exists('dropped_at', 'course_registration_items');
        foreach ($preview['to_remove'] as $rem) {
            $upd_obs = array();
            if ($has_item_status) {
                $upd_obs['status'] = 'obsolete';
            }
            if ($has_dropped_at) {
                $upd_obs['dropped_at']  = $now;
                $upd_obs['dropped_by']  = null;
                $upd_obs['drop_reason'] = 'Auto carryover obsolete (cleared or superseded)';
            }
            if (!empty($upd_obs)) {
                $this->db->where('id', $rem['item_id']);
                $this->db->update('course_registration_items', $upd_obs);
            }
        }

        // We don't have tracking columns to update in to_keep, so just ignore it.

        $this->db->trans_complete();

        return [
            'success' => $this->db->trans_status(),
            'added' => count($preview['to_add']),
            'removed' => count($preview['to_remove']),
            'kept' => count($preview['to_keep']),
            'conflicts' => count($preview['conflicts']),
            'conflict_details' => $preview['conflicts']
        ];
    }
}


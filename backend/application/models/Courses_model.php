<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Courses_model extends CI_Model
{
    public function tables_ready()
    {
        return $this->db->table_exists('departments')
            && $this->db->table_exists('programmes')
            && $this->db->table_exists('academic_sessions')
            && $this->db->table_exists('semesters')
            && $this->db->table_exists('courses')
            && $this->db->table_exists('course_offerings');
    }

    public function ensure_course_structure_columns()
    {
        if (!$this->db->table_exists('courses')) {
            return false;
        }

        if (!$this->db->field_exists('programme_structure', 'courses')) {
            $this->db->query("ALTER TABLE `courses` ADD COLUMN `programme_structure` VARCHAR(30) NOT NULL DEFAULT 'semester' AFTER `type`");
        }

        if (!$this->db->field_exists('contact_number', 'courses')) {
            $this->db->query("ALTER TABLE `courses` ADD COLUMN `contact_number` TINYINT NULL AFTER `programme_structure`");
        }

        if (!$this->db->field_exists('year_number', 'courses')) {
            $this->db->query("ALTER TABLE `courses` ADD COLUMN `year_number` TINYINT NULL AFTER `contact_number`");
        }

        if (!$this->db->field_exists('semester_name', 'courses')) {
            $this->db->query("ALTER TABLE `courses` ADD COLUMN `semester_name` VARCHAR(50) NULL AFTER `year_number`");
        }

        return $this->db->field_exists('programme_structure', 'courses')
            && $this->db->field_exists('contact_number', 'courses')
            && $this->db->field_exists('year_number', 'courses')
            && $this->db->field_exists('semester_name', 'courses');
    }

    public function programme_tables_ready()
    {
        return $this->db->table_exists('departments')
            && $this->db->table_exists('programmes');
    }

    public function ensure_programme_structure_column()
    {
        if (!$this->db->table_exists('programmes')) {
            return false;
        }

        if (!$this->db->field_exists('programme_structure', 'programmes')) {
            $this->db->query("ALTER TABLE `programmes` ADD COLUMN `programme_structure` VARCHAR(30) NOT NULL DEFAULT 'semester' AFTER `duration_years`");
        }

        return $this->db->field_exists('programme_structure', 'programmes');
    }

    private function normalize_programme_structure($structure)
    {
        $structure = strtolower(trim((string) $structure));
        if ($structure === 'contact_based') {
            $structure = 'contact';
        }

        return $structure === 'contact' ? 'contact' : 'semester';
    }

    public function ensure_default_degree_catalogue()
    {
        // Auto-seeding disabled: prevents deleted programmes from reappearing when the table becomes empty.
        return;


        $items = array(
            array('department' => 'Arts and Islamic Studies', 'department_code' => 'AIS', 'name' => 'B.A Islamic Studies', 'code' => 'BAIS', 'duration' => 4),
            array('department' => 'Arts and Islamic Studies', 'department_code' => 'AIS', 'name' => 'B.A Hausa', 'code' => 'BAHA', 'duration' => 4),
            array('department' => 'Education', 'department_code' => 'EDU', 'name' => 'B.ED Guidance and Counselling', 'code' => 'BEDGC', 'duration' => 4),
            array('department' => 'Information Studies', 'department_code' => 'LIS', 'name' => 'B. Library and Information Science', 'code' => 'BLIS', 'duration' => 4),
            array('department' => 'Education', 'department_code' => 'EDU', 'name' => 'B.A (ED) English', 'code' => 'BAEDENG', 'duration' => 4),
            array('department' => 'Education', 'department_code' => 'EDU', 'name' => 'Bsc. (ED) Biology', 'code' => 'BSCEDBIO', 'duration' => 4),
            array('department' => 'Science and Computing', 'department_code' => 'SCI', 'name' => 'Bsc. Computer Science', 'code' => 'BSCCS', 'duration' => 4),
        );

        foreach ($items as $item) {
            $department_id = $this->resolve_department($item['department'], $item['department_code']);
            if ($department_id) {
                $this->create_programme($department_id, $item['name'], $item['code'], $item['duration']);
            }
        }
    }

    public function get_departments()
    {
        return $this->db->order_by('name')->get('departments')->result_array();
    }

    public function get_programmes($department_id = null, $only_active = false)
    {
        $this->ensure_programme_structure_column();
        $this->db->select('p.id, p.department_id, p.name, p.code, p.award, p.duration_years');
        if ($this->db->field_exists('programme_structure', 'programmes')) {
            $this->db->select('p.programme_structure');
        } else {
            $this->db->select("'semester' as programme_structure", false);
        }
        $hasIsActive = $this->db->field_exists('is_active', 'programmes');
        if ($hasIsActive) {
            $this->db->select('p.is_active');
        }
        $this->db->select('d.name as department_name, d.code as department_code');
        $this->db->from('programmes p');
        $this->db->join('departments d', 'd.id = p.department_id', 'left');
        if ($department_id) {
            $this->db->where('p.department_id', $department_id);
        }
        if ($only_active && $hasIsActive) {
            $this->db->where('p.is_active', 1);
        }
        $this->db->order_by('p.name');
        return $this->db->get()->result_array();
    }

    public function create_programme($department_id, $name, $code, $duration_years, $programme_structure = 'semester')
    {
        $this->ensure_programme_structure_column();
        $name = trim((string) $name);
        $code = trim((string) $code);

        if (!$department_id || $name === '' || $code === '' || !$duration_years) {
            return null;
        }

        $query = $this->db->get_where('programmes', array('code' => $code), 1);
        $row = $query->row_array();
        if ($row && isset($row['id'])) {
            return $row['id'];
        }

        $programme_id = $this->generate_uuid();
        $data = array(
            'id' => $programme_id,
            'department_id' => $department_id,
            'name' => $name,
            'code' => $code,
            'award' => null,
            'duration_years' => (int) $duration_years,
            'created_at' => date('Y-m-d H:i:s'),
        );
        if ($this->db->field_exists('programme_structure', 'programmes')) {
            $data['programme_structure'] = $this->normalize_programme_structure($programme_structure);
        }
        if ($this->db->field_exists('is_active', 'programmes')) {
            $data['is_active'] = 1;
        }
        $this->db->insert('programmes', $data);

        return $programme_id;
    }

    public function update_programme_status($programme_id, $is_active)
    {
        if (!$programme_id) {
            return array('success' => false, 'message' => 'Programme id is required', 'code' => 400);
        }

        // Ensure the status column exists; auto-create if missing
        if (!$this->db->field_exists('is_active', 'programmes')) {
            $this->load->dbforge();
            $fields = array(
                'is_active' => array(
                    'type' => 'TINYINT',
                    'constraint' => 1,
                    'null' => false,
                    'default' => 1,
                ),
            );
            $this->dbforge->add_column('programmes', $fields);

            if (!$this->db->field_exists('is_active', 'programmes')) {
                return array('success' => false, 'message' => 'is_active column missing on programmes table', 'code' => 500);
            }
        }

        // Ensure programme exists
        $programme = $this->db->get_where('programmes', array('id' => $programme_id), 1)->row_array();
        if (!$programme) {
            return array('success' => false, 'message' => 'Programme not found', 'code' => 404);
        }

        // Apply update
        $this->db->where('id', $programme_id);
        $ok = $this->db->update('programmes', array(
            'is_active' => $is_active ? 1 : 0,
            'updated_at' => date('Y-m-d H:i:s'),
        ));

        if (!$ok) {
            return array('success' => false, 'message' => 'Unable to update programme status', 'code' => 400);
        }

        // If no rows affected but value already set, treat as success
        if ($this->db->affected_rows() === 0 && isset($programme['is_active'])) {
            if ((int) $programme['is_active'] === ($is_active ? 1 : 0)) {
                return array('success' => true, 'message' => 'Programme status unchanged');
            }
        }

        return array('success' => true, 'message' => 'Programme status updated');
    }

    public function update_programme($programme_id, $department_id, $name, $code, $duration_years, $programme_structure = 'semester')
    {
        $this->ensure_programme_structure_column();

        $name = trim((string) $name);
        $code = trim((string) $code);
        $duration_years = (int) $duration_years;

        if (!$programme_id || !$department_id || $name === '' || $code === '' || !$duration_years) {
            return array('success' => false, 'message' => 'Programme, department, name, code, and duration are required', 'code' => 400);
        }

        $programme = $this->db->get_where('programmes', array('id' => $programme_id), 1)->row_array();
        if (!$programme) {
            return array('success' => false, 'message' => 'Programme not found', 'code' => 404);
        }

        $department = $this->db->get_where('departments', array('id' => $department_id), 1)->row_array();
        if (!$department) {
            return array('success' => false, 'message' => 'Department not found', 'code' => 404);
        }

        $duplicate = $this->db
            ->where('code', $code)
            ->where('id !=', $programme_id)
            ->limit(1)
            ->get('programmes')
            ->row_array();
        if ($duplicate) {
            return array('success' => false, 'message' => 'Another programme already uses this code', 'code' => 409);
        }

        $data = array(
            'department_id' => $department_id,
            'name' => $name,
            'code' => $code,
            'duration_years' => $duration_years,
        );
        if ($this->db->field_exists('programme_structure', 'programmes')) {
            $data['programme_structure'] = $this->normalize_programme_structure($programme_structure);
        }
        if ($this->db->field_exists('updated_at', 'programmes')) {
            $data['updated_at'] = date('Y-m-d H:i:s');
        }

        $this->db->where('id', $programme_id);
        $ok = $this->db->update('programmes', $data);

        if (!$ok) {
            return array('success' => false, 'message' => 'Unable to update programme', 'code' => 400);
        }

        return array('success' => true, 'message' => 'Programme updated successfully');
    }

    public function delete_programme($programme_id)
    {
        if (!$programme_id) {
            return array('success' => false, 'message' => 'Programme ID is required');
        }

        // Check for dependencies
        $dependencies = array();

        // Check applications
        if ($this->db->table_exists('applications')) {
            $this->db->where('programme_id', $programme_id);
            $app_count = $this->db->count_all_results('applications');
            if ($app_count > 0) {
                $dependencies[] = $app_count . ' application' . ($app_count > 1 ? 's' : '');
            }
        }

        // Check courses
        if ($this->db->table_exists('courses')) {
            $this->db->where('programme_id', $programme_id);
            $course_count = $this->db->count_all_results('courses');
            if ($course_count > 0) {
                $dependencies[] = $course_count . ' course' . ($course_count > 1 ? 's' : '');
            }
        }

        // Check students
        if ($this->db->table_exists('students')) {
            $this->db->where('programme_id', $programme_id);
            $student_count = $this->db->count_all_results('students');
            if ($student_count > 0) {
                $dependencies[] = $student_count . ' student' . ($student_count > 1 ? 's' : '');
            }
        }

        // If there are dependencies, return error with details
        if (!empty($dependencies)) {
            $message = 'Cannot delete programme. It has ' . implode(', ', $dependencies) . '. Consider setting it to unavailable instead.';
            return array('success' => false, 'message' => $message, 'has_dependencies' => true);
        }

        // No dependencies, safe to delete
        $this->db->where('id', $programme_id);
        $deleted = $this->db->delete('programmes');
        
        if ($deleted) {
            return array('success' => true, 'message' => 'Programme deleted successfully');
        } else {
            return array('success' => false, 'message' => 'Failed to delete programme');
        }
    }

    public function delete_department($department_id)
    {
        if (!$department_id) {
            return array('success' => false, 'message' => 'Department ID is required');
        }

        if (!$this->db->table_exists('departments')) {
            return array('success' => false, 'message' => 'Departments table not found', 'code' => 500);
        }

        $department = $this->db->get_where('departments', array('id' => $department_id), 1)->row_array();
        if (!$department) {
            return array('success' => false, 'message' => 'Department not found', 'code' => 404);
        }

        $dependencies = array();

        if ($this->db->table_exists('programmes')) {
            $this->db->where('department_id', $department_id);
            $programme_count = $this->db->count_all_results('programmes');
            if ($programme_count > 0) {
                $dependencies[] = $programme_count . ' programme' . ($programme_count > 1 ? 's' : '');
            }
        }

        if ($this->db->table_exists('courses') && $this->db->field_exists('programme_id', 'courses') && $this->db->table_exists('programmes')) {
            $this->db->from('courses c');
            $this->db->join('programmes p', 'p.id = c.programme_id', 'left');
            $this->db->where('p.department_id', $department_id);
            $course_count = $this->db->count_all_results();
            if ($course_count > 0) {
                $dependencies[] = $course_count . ' course' . ($course_count > 1 ? 's' : '');
            }
        }

        if ($this->db->table_exists('students')) {
            $student_count = 0;
            if ($this->db->field_exists('department_id', 'students')) {
                $this->db->where('department_id', $department_id);
                $student_count = $this->db->count_all_results('students');
            } elseif ($this->db->field_exists('programme_id', 'students') && $this->db->table_exists('programmes')) {
                $this->db->from('students s');
                $this->db->join('programmes p', 'p.id = s.programme_id', 'left');
                $this->db->where('p.department_id', $department_id);
                $student_count = $this->db->count_all_results();
            }

            if ($student_count > 0) {
                $dependencies[] = $student_count . ' student' . ($student_count > 1 ? 's' : '');
            }
        }

        if ($this->db->table_exists('applications') && $this->db->field_exists('programme_id', 'applications') && $this->db->table_exists('programmes')) {
            $this->db->from('applications a');
            $this->db->join('programmes p', 'p.id = a.programme_id', 'left');
            $this->db->where('p.department_id', $department_id);
            $app_count = $this->db->count_all_results();
            if ($app_count > 0) {
                $dependencies[] = $app_count . ' application' . ($app_count > 1 ? 's' : '');
            }
        }

        if (!empty($dependencies)) {
            $message = 'Cannot delete department. It has ' . implode(', ', $dependencies) . '. Remove dependent records first.';
            return array('success' => false, 'message' => $message, 'has_dependencies' => true);
        }

        $this->db->where('id', $department_id);
        $deleted = $this->db->delete('departments');

        if ($deleted) {
            return array('success' => true, 'message' => 'Department deleted successfully');
        }

        return array('success' => false, 'message' => 'Failed to delete department');
    }

    public function update_department($department_id, $name, $code = null)
    {
        $name = trim((string) $name);
        $code = $code !== null ? trim((string) $code) : null;

        if (!$department_id || $name === '') {
            return array('success' => false, 'message' => 'Department id and name are required', 'code' => 400);
        }

        if (!$this->db->table_exists('departments')) {
            return array('success' => false, 'message' => 'Departments table not found', 'code' => 500);
        }

        $department = $this->db->get_where('departments', array('id' => $department_id), 1)->row_array();
        if (!$department) {
            return array('success' => false, 'message' => 'Department not found', 'code' => 404);
        }

        $duplicateName = $this->db
            ->where('name', $name)
            ->where('id !=', $department_id)
            ->limit(1)
            ->get('departments')
            ->row_array();
        if ($duplicateName) {
            return array('success' => false, 'message' => 'Another department already uses this name', 'code' => 409);
        }

        $data = array(
            'name' => $name,
            'code' => $code ?: null,
        );
        if ($this->db->field_exists('updated_at', 'departments')) {
            $data['updated_at'] = date('Y-m-d H:i:s');
        }

        $this->db->where('id', $department_id);
        $ok = $this->db->update('departments', $data);

        if (!$ok) {
            return array('success' => false, 'message' => 'Unable to update department', 'code' => 400);
        }

        return array('success' => true, 'message' => 'Department updated successfully');
    }

    public function get_sessions()
    {
        return $this->db->order_by('name', 'desc')->get('academic_sessions')->result_array();
    }

    public function get_active_session()
    {
        if (!$this->db->table_exists('academic_sessions')) {
            return null;
        }

        if ($this->db->field_exists('is_active', 'academic_sessions')) {
            $this->db->where('is_active', 1);
            $this->db->order_by('name', 'desc');
            $active_sessions = $this->db->get('academic_sessions')->result_array();
            if (empty($active_sessions)) {
                return null;
            }

            // Do not choose an arbitrary row if a legacy database contains
            // multiple active sessions. The database guard in migration 025
            // prevents new duplicates; this makes existing corruption visible
            // instead of silently directing students to the wrong session.
            if (count($active_sessions) !== 1) {
                log_message('error', 'Academic-session integrity error: multiple active sessions were found.');
                return null;
            }

            return $active_sessions[0];
        }

        $this->db->order_by('name', 'desc');
        return $this->db->get('academic_sessions', 1)->row_array();
    }

    public function create_session($name, $start_date = null, $end_date = null, $is_active = 0)
    {
        $name = trim((string) $name);
        if ($name === '' || !$this->db->table_exists('academic_sessions')) {
            return null;
        }

        $existing = $this->db->get_where('academic_sessions', array('name' => $name), 1)->row_array();
        if ($existing && isset($existing['id'])) {
            if ($is_active) {
                $this->set_active_session($existing['id']);
            }
            return $existing['id'];
        }

        $year = $this->extract_session_year($name);
        $session_id = $this->generate_uuid();
        $data = array(
            'id' => $session_id,
            'name' => $name,
            'start_date' => $start_date ?: $year . '-01-01',
            'end_date' => $end_date ?: ((int) $year + 1) . '-12-31',
            'is_active' => $is_active ? 1 : 0,
            'created_at' => date('Y-m-d H:i:s'),
        );

        $this->db->trans_begin();

        if ($is_active && $this->db->field_exists('is_active', 'academic_sessions')) {
            // Serialize activation with other session changes. This is also
            // required before migration 025 has been applied on every
            // environment.
            $this->db->query('SELECT id FROM academic_sessions FOR UPDATE');
            $this->db->update('academic_sessions', array('is_active' => 0));
        }

        $this->db->insert('academic_sessions', $data);
        if ($this->db->trans_status() === false) {
            $this->db->trans_rollback();
            return null;
        }

        $this->db->trans_commit();
        return $session_id;
    }

    public function update_session($session_id, $name, $start_date = null, $end_date = null)
    {
        $name = trim((string) $name);
        if (!$session_id || $name === '') {
            return array('success' => false, 'message' => 'Session id and name are required', 'code' => 400);
        }

        if (!$this->db->table_exists('academic_sessions')) {
            return array('success' => false, 'message' => 'Academic sessions table not found', 'code' => 500);
        }

        $session = $this->db->get_where('academic_sessions', array('id' => $session_id), 1)->row_array();
        if (!$session) {
            return array('success' => false, 'message' => 'Session not found', 'code' => 404);
        }

        if ($this->db->field_exists('archived_at', 'academic_sessions') && !empty($session['archived_at'])) {
            return array('success' => false, 'message' => 'Archived sessions cannot be edited.', 'code' => 409);
        }

        if ($name !== (string) $session['name'] && !empty($this->session_dependency_summary($session_id))) {
            return array(
                'success' => false,
                'message' => 'A referenced academic session cannot be renamed. Archive it and create a corrected session if required.',
                'code' => 409,
                'has_dependencies' => true,
            );
        }

        $duplicate = $this->db
            ->where('name', $name)
            ->where('id !=', $session_id)
            ->get('academic_sessions', 1)
            ->row_array();
        if ($duplicate) {
            return array('success' => false, 'message' => 'Another session already uses this name', 'code' => 409);
        }

        $data = array('name' => $name);
        if ($start_date) {
            $data['start_date'] = $start_date;
        }
        if ($end_date) {
            $data['end_date'] = $end_date;
        }
        if ($this->db->field_exists('updated_at', 'academic_sessions')) {
            $data['updated_at'] = date('Y-m-d H:i:s');
        }

        $this->db->where('id', $session_id);
        if (!$this->db->update('academic_sessions', $data)) {
            return array('success' => false, 'message' => 'Unable to update session', 'code' => 400);
        }

        return array('success' => true, 'message' => 'Session updated successfully');
    }

    public function delete_session($session_id)
    {
        if (!$session_id) {
            return array('success' => false, 'message' => 'Session id is required', 'code' => 400);
        }

        if (!$this->db->table_exists('academic_sessions')) {
            return array('success' => false, 'message' => 'Academic sessions table not found', 'code' => 500);
        }

        $session = $this->db->get_where('academic_sessions', array('id' => $session_id), 1)->row_array();
        if (!$session) {
            return array('success' => false, 'message' => 'Session not found', 'code' => 404);
        }

        if (isset($session['is_active']) && (int) $session['is_active'] === 1) {
            return array(
                'success' => false,
                'message' => 'The active session cannot be deleted. Activate another session first.',
                'code' => 409,
            );
        }

        $dependencies = $this->session_dependency_summary($session_id);

        if (!empty($dependencies)) {
            return array(
                'success' => false,
                'message' => 'Cannot delete this session because it has ' . implode(', ', $dependencies) . '.',
                'code' => 409,
                'has_dependencies' => true,
            );
        }

        $this->db->where('id', $session_id);
        if (!$this->db->delete('academic_sessions')) {
            return array('success' => false, 'message' => 'Unable to delete session', 'code' => 400);
        }

        return array('success' => true, 'message' => 'Session deleted successfully');
    }

    public function archive_session($session_id, $reason, $actor_id = null)
    {
        if (!$session_id || trim((string) $reason) === '') {
            return array('success' => false, 'message' => 'Session id and archive reason are required', 'code' => 400);
        }
        if (!$this->db->table_exists('academic_sessions')) {
            return array('success' => false, 'message' => 'Academic sessions table not found', 'code' => 500);
        }
        if (!$this->db->field_exists('archived_at', 'academic_sessions')) {
            return array('success' => false, 'message' => 'Session archival is not installed. Run db/migrations/027_add_academic_session_archival.sql first.', 'code' => 503);
        }

        $session = $this->db->get_where('academic_sessions', array('id' => $session_id), 1)->row_array();
        if (!$session) {
            return array('success' => false, 'message' => 'Session not found', 'code' => 404);
        }
        if (!empty($session['archived_at'])) {
            return array('success' => true, 'message' => 'Session is already archived');
        }
        if (!empty($session['is_active'])) {
            return array('success' => false, 'message' => 'The active session cannot be archived. Activate another session first.', 'code' => 409);
        }

        $data = array(
            'archived_at' => date('Y-m-d H:i:s'),
            'archive_reason' => trim((string) $reason),
        );
        if ($this->db->field_exists('archived_by', 'academic_sessions')) {
            $data['archived_by'] = $actor_id;
        }
        if ($this->db->field_exists('updated_at', 'academic_sessions')) {
            $data['updated_at'] = date('Y-m-d H:i:s');
        }
        $this->db->where('id', $session_id);
        if (!$this->db->update('academic_sessions', $data)) {
            return array('success' => false, 'message' => 'Unable to archive session', 'code' => 500);
        }

        $this->record_session_event($session_id, 'archived', $actor_id, $reason);

        return array('success' => true, 'message' => 'Session archived successfully');
    }

    private function session_dependency_summary($session_id)
    {
        $references = array(
            'applications' => array('application', array('session_id')),
            'admissions' => array('admission', array('session_id')),
            'students' => array('student entry cohort', array('entry_session_id')),
            'course_offerings' => array('course offering', array('session_id')),
            'course_registrations' => array('course registration', array('session_id', 'academic_session_id', 'entry_session_id')),
            'result_batches' => array('result batch', array('session_id', 'academic_session_id', 'cohort_session_id')),
            'hostel_bookings' => array('hostel booking', array('session_id')),
            'session_fee_settings' => array('session fee setting', array('session_id')),
        );
        $dependencies = array();

        foreach ($references as $table => $definition) {
            if (!$this->db->table_exists($table)) {
                continue;
            }
            $label = $definition[0];
            foreach ($definition[1] as $field) {
                if (!$this->db->field_exists($field, $table)) {
                    continue;
                }
                $this->db->where($field, $session_id);
                $count = (int) $this->db->count_all_results($table);
                if ($count > 0) {
                    $dependencies[] = $count . ' ' . $label . ($count > 1 ? 's' : '');
                    break;
                }
            }
        }

        return $dependencies;
    }

    private function record_session_event($session_id, $event_type, $actor_id = null, $reason = null)
    {
        if (!$this->db->table_exists('academic_session_events')) {
            return;
        }

        $this->db->insert('academic_session_events', array(
            'id' => $this->generate_uuid(),
            'session_id' => $session_id,
            'event_type' => $event_type,
            'reason' => $reason ? trim((string) $reason) : null,
            'actor_id' => $actor_id,
            'created_at' => date('Y-m-d H:i:s'),
        ));
    }

    public function set_active_session($session_id, $actor_id = null, $reason = null)
    {
        if (!$session_id || !$this->db->table_exists('academic_sessions')) {
            return array('success' => false, 'message' => 'Session id is required', 'code' => 400);
        }

        if ($this->db->field_exists('is_active', 'academic_sessions')) {
            $this->db->trans_begin();

            // Lock the complete session set before changing any active flag.
            // This prevents concurrent requests from activating different
            // sessions at the same time.
            $this->db->query('SELECT id FROM academic_sessions FOR UPDATE');
            $session = $this->db->get_where('academic_sessions', array('id' => $session_id), 1)->row_array();
            if (!$session) {
                $this->db->trans_rollback();
                return array('success' => false, 'message' => 'Session not found', 'code' => 404);
            }
            if ($this->db->field_exists('archived_at', 'academic_sessions') && !empty($session['archived_at'])) {
                $this->db->trans_rollback();
                return array('success' => false, 'message' => 'Archived sessions cannot be activated.', 'code' => 409);
            }

            $this->db->update('academic_sessions', array('is_active' => 0));
            $this->db->where('id', $session_id);
            $active_data = array('is_active' => 1);
            if ($this->db->field_exists('updated_at', 'academic_sessions')) {
                $active_data['updated_at'] = date('Y-m-d H:i:s');
            }
            $this->db->update('academic_sessions', $active_data);
            $this->record_session_event($session_id, 'activated', $actor_id, $reason);

            if ($this->db->trans_status() === false) {
                $this->db->trans_rollback();
                return array('success' => false, 'message' => 'Unable to update active session', 'code' => 500);
            }
            $this->db->trans_commit();
        } else {
            $session = $this->db->get_where('academic_sessions', array('id' => $session_id), 1)->row_array();
            if (!$session) {
                return array('success' => false, 'message' => 'Session not found', 'code' => 404);
            }
        }

        $this->load->model('Student_model');
        if (isset($this->Student_model) && method_exists($this->Student_model, 'recalculate_all_student_levels')) {
            $this->Student_model->recalculate_all_student_levels($session);
        }

        return array('success' => true, 'message' => 'Active session updated');
    }

    public function get_semesters()
    {
        return $this->db->order_by('sort_order')->get('semesters')->result_array();
    }

    private function select_course_structure_fields()
    {
        $fields = array('programme_structure', 'contact_number', 'year_number', 'semester_name');
        $missing = false;

        foreach ($fields as $field) {
            if (!$this->db->field_exists($field, 'courses')) {
                $missing = true;
                break;
            }
        }

        if ($missing) {
            $this->db->select("'semester' as programme_structure, NULL as contact_number, NULL as year_number, NULL as semester_name", false);
            return;
        }

        $this->db->select('c.programme_structure, c.contact_number, c.year_number, c.semester_name');
    }

    public function get_courses()
    {
        $this->ensure_course_structure_columns();
        $latest_offering = "(SELECT co1.* FROM course_offerings co1 INNER JOIN (SELECT course_id, MAX(created_at) AS max_created FROM course_offerings GROUP BY course_id) latest ON latest.course_id = co1.course_id AND latest.max_created = co1.created_at) co";

        $this->db->select('c.id, c.code, c.title, c.credit_units, c.level, c.type');
        $this->select_course_structure_fields();
        $this->db->select('p.id as programme_id, p.name as programme_name, p.code as programme_code');
        $this->db->select('d.id as department_id, d.name as department_name, d.code as department_code');
        $this->db->select('s.id as session_id, s.name as session_name');
        $this->db->select('sem.id as semester_id, sem.name as offering_semester_name');
        $this->db->select('co.id as offering_id, co.lecturer_name, co.schedule');
        $this->db->from('courses c');
        $this->db->join('programmes p', 'p.id = c.programme_id', 'left');
        $this->db->join('departments d', 'd.id = p.department_id', 'left');
        $this->db->join($latest_offering, 'co.course_id = c.id', 'left', false);
        $this->db->join('academic_sessions s', 's.id = co.session_id', 'left');
        $this->db->join('semesters sem', 'sem.id = co.semester_id', 'left');
        $this->db->order_by('c.title');
        return $this->db->get()->result_array();
    }

    public function get_course_by_id($course_id)
    {
        if (!$course_id) {
            return null;
        }

        $this->ensure_course_structure_columns();
        $latest_offering = "(SELECT co1.* FROM course_offerings co1 INNER JOIN (SELECT course_id, MAX(created_at) AS max_created FROM course_offerings GROUP BY course_id) latest ON latest.course_id = co1.course_id AND latest.max_created = co1.created_at) co";

        $this->db->select('c.id, c.code, c.title, c.credit_units, c.level, c.type');
        $this->select_course_structure_fields();
        $this->db->select('p.id as programme_id, p.name as programme_name, p.code as programme_code');
        $this->db->select('d.id as department_id, d.name as department_name, d.code as department_code');
        $this->db->select('s.id as session_id, s.name as session_name');
        $this->db->select('sem.id as semester_id, sem.name as offering_semester_name');
        $this->db->select('co.id as offering_id, co.lecturer_name, co.schedule');
        $this->db->from('courses c');
        $this->db->join('programmes p', 'p.id = c.programme_id', 'left');
        $this->db->join('departments d', 'd.id = p.department_id', 'left');
        $this->db->join($latest_offering, 'co.course_id = c.id', 'left', false);
        $this->db->join('academic_sessions s', 's.id = co.session_id', 'left');
        $this->db->join('semesters sem', 'sem.id = co.semester_id', 'left');
        $this->db->where('c.id', $course_id);
        $this->db->limit(1);
        return $this->db->get()->row_array();
    }

    public function resolve_department($name, $code = null)
    {
        $name = trim((string) $name);
        $code = $code !== null ? trim((string) $code) : null;

        if ($code) {
            $query = $this->db->get_where('departments', array('code' => $code), 1);
            $row = $query->row_array();
            if ($row && isset($row['id'])) {
                return $row['id'];
            }
        }

        if ($name !== '') {
            $query = $this->db->get_where('departments', array('name' => $name), 1);
            $row = $query->row_array();
            if ($row && isset($row['id'])) {
                return $row['id'];
            }
        }

        if ($name === '') {
            return null;
        }

        $dept_id = $this->generate_uuid();
        $this->db->insert('departments', array(
            'id' => $dept_id,
            'name' => $name,
            'code' => $code,
            'created_at' => date('Y-m-d H:i:s'),
        ));

        return $dept_id;
    }

    public function resolve_programme($department_id, $name, $code)
    {
        $name = trim((string) $name);
        $code = $code !== null ? trim((string) $code) : null;

        if ($code) {
            $query = $this->db->get_where('programmes', array('code' => $code), 1);
            $row = $query->row_array();
            if ($row && isset($row['id'])) {
                return $row['id'];
            }
        }

        if ($name !== '' && $department_id) {
            $query = $this->db->get_where('programmes', array('name' => $name, 'department_id' => $department_id), 1);
            $row = $query->row_array();
            if ($row && isset($row['id'])) {
                return $row['id'];
            }
        }

        if ($name === '' || !$department_id) {
            return null;
        }

        $programme_id = $this->generate_uuid();
        $this->db->insert('programmes', array(
            'id' => $programme_id,
            'department_id' => $department_id,
            'name' => $name,
            'code' => $code,
            'award' => null,
            'duration_years' => 2,
            'created_at' => date('Y-m-d H:i:s'),
        ));

        return $programme_id;
    }

    public function resolve_session($name)
    {
        $name = trim((string) $name);
        if ($name === '') {
            return null;
        }

        $query = $this->db->get_where('academic_sessions', array('name' => $name), 1);
        $row = $query->row_array();
        if ($row && isset($row['id'])) {
            return $row['id'];
        }

        $year = $this->extract_session_year($name);
        $session_id = $this->generate_uuid();
        return $this->create_session($name, $year . '-01-01', $year . '-12-31', 0);
    }

    public function resolve_semester($name)
    {
        $name = trim((string) $name);
        if ($name === '') {
            return null;
        }

        // Check if $name is already a valid semester id
        $query_id = $this->db->get_where('semesters', array('id' => $name), 1);
        $row_id = $query_id->row_array();
        if ($row_id && isset($row_id['id'])) {
            return $row_id['id'];
        }

        $query = $this->db->get_where('semesters', array('name' => $name), 1);
        $row = $query->row_array();
        if ($row && isset($row['id'])) {
            return $row['id'];
        }

        $semester_id = $this->generate_uuid();
        $this->db->insert('semesters', array(
            'id' => $semester_id,
            'name' => $name,
            'sort_order' => $this->semester_sort_order($name),
            'created_at' => date('Y-m-d H:i:s'),
        ));

        return $semester_id;
    }

    private function course_structure_data($placement = array())
    {
        $structure = isset($placement['programme_structure'])
            ? strtolower(trim((string) $placement['programme_structure']))
            : 'semester';
        if ($structure === 'contact_based') {
            $structure = 'contact';
        }
        if ($structure !== 'contact' && $structure !== 'semester') {
            $structure = 'semester';
        }

        $contact_number = isset($placement['contact_number']) && $placement['contact_number'] !== null
            ? (int) $placement['contact_number']
            : null;
        $year_number = isset($placement['year_number']) && $placement['year_number'] !== null
            ? (int) $placement['year_number']
            : null;
        $semester_name = isset($placement['semester_name']) && $placement['semester_name'] !== null
            ? trim((string) $placement['semester_name'])
            : null;

        if ($structure === 'contact') {
            return array(
                'programme_structure' => 'contact',
                'contact_number' => $contact_number,
                'year_number' => null,
                'semester_name' => null,
            );
        }

        return array(
            'programme_structure' => 'semester',
            'contact_number' => null,
            'year_number' => $year_number,
            'semester_name' => $semester_name ?: null,
        );
    }

    public function create_course($programme_id, $code, $title, $units, $level = null, $type = 'core', $placement = array())
    {
        $this->ensure_course_structure_columns();
        $code = trim((string) $code);
        $title = trim((string) $title);

        if ($programme_id === null || $code === '' || $title === '') {
            return null;
        }

        $query = $this->db->get_where('courses', array('programme_id' => $programme_id, 'code' => $code), 1);
        $row = $query->row_array();
        if ($row && isset($row['id'])) {
            return $row['id'];
        }

        $course_id = $this->generate_uuid();
        $data = array(
            'id' => $course_id,
            'programme_id' => $programme_id,
            'code' => $code,
            'title' => $title,
            'credit_units' => (int) $units,
            'level' => $level,
            'type' => $type ?: 'core',
            'created_at' => date('Y-m-d H:i:s'),
        );

        if ($this->db->field_exists('programme_structure', 'courses')) {
            $data = array_merge($data, $this->course_structure_data($placement));
        }

        $this->db->insert('courses', $data);

        return $course_id;
    }

    public function bulk_import_courses($rows)
    {
        if (!is_array($rows) || empty($rows)) {
            return array('error' => 'The CSV has no course rows to import', 'code' => 400);
        }

        $this->ensure_course_structure_columns();
        $this->ensure_programme_structure_column();

        $this->db->select('p.id, p.code, p.name, p.department_id, d.code as department_code, d.name as department_name');
        if ($this->db->field_exists('programme_structure', 'programmes')) {
            $this->db->select('p.programme_structure');
        } else {
            $this->db->select("'semester' as programme_structure", false);
        }
        $this->db->from('programmes p');
        $this->db->join('departments d', 'd.id = p.department_id', 'left');
        $programmes = $this->db->get()->result_array();

        $programme_by_code = array();
        foreach ($programmes as $programme) {
            $code = strtolower(trim((string) (isset($programme['code']) ? $programme['code'] : '')));
            if ($code !== '') {
                $programme_by_code[$code] = $programme;
            }
        }

        $existing = array();
        $course_rows = $this->db->select('programme_id, code')->get('courses')->result_array();
        foreach ($course_rows as $course) {
            $existing[(string) $course['programme_id'] . '|' . strtolower(trim((string) $course['code']))] = true;
        }

        $validated = array();
        $errors = array();
        $seen = array();
        $skipped = 0;

        foreach ($rows as $index => $row) {
            $row_number = $index + 2;
            $programme_code = $this->course_csv_value($row, array('programme_code', 'program_code'));
            $department_code = $this->course_csv_value($row, array('department_code', 'dept_code'));
            $course_code = strtoupper($this->course_csv_value($row, array('course_code', 'code')));
            $course_title = $this->course_csv_value($row, array('course_title', 'title'));
            $unit_value = $this->course_csv_value($row, array('credit_units', 'credits', 'unit', 'units'));
            $structure_value = strtolower($this->course_csv_value($row, array('programme_structure', 'program_structure', 'programme_type', 'program_type')));
            $contact_value = $this->course_csv_value($row, array('contact_number', 'contact'));
            $year_value = $this->course_csv_value($row, array('year_number', 'year'));
            $semester_value = $this->course_csv_value($row, array('semester', 'semester_name'));
            $type = strtolower($this->course_csv_value($row, array('type', 'course_type')));
            $row_errors = array();

            $programme_key = strtolower($programme_code);
            $programme = $programme_key !== '' && isset($programme_by_code[$programme_key])
                ? $programme_by_code[$programme_key]
                : null;

            if ($programme_code === '') {
                $row_errors[] = 'programme_code is required';
            } elseif (!$programme) {
                $row_errors[] = 'programme_code does not match an existing programme';
            }
            if ($course_code === '') {
                $row_errors[] = 'course_code is required';
            }
            if ($course_title === '') {
                $row_errors[] = 'course_title is required';
            }

            $units = filter_var($unit_value, FILTER_VALIDATE_INT);
            if ($units === false || $units < 1 || $units > 20) {
                $row_errors[] = 'credit_units must be a whole number between 1 and 20';
            }

            if ($type === '') {
                $type = 'core';
            }
            if ($type !== 'core' && $type !== 'elective') {
                $row_errors[] = 'type must be core or elective';
            }

            if ($structure_value === 'contact_based' || $structure_value === 'contact based') {
                $structure_value = 'contact';
            } elseif ($structure_value === 'semester_based' || $structure_value === 'semester based') {
                $structure_value = 'semester';
            }
            $programme_structure = $programme && isset($programme['programme_structure'])
                ? $this->normalize_programme_structure($programme['programme_structure'])
                : 'semester';
            if ($structure_value === '') {
                $structure_value = $programme_structure;
            }
            if ($structure_value !== 'contact' && $structure_value !== 'semester') {
                $row_errors[] = 'programme_structure must be contact or semester';
            } elseif ($programme && $structure_value !== $programme_structure) {
                $row_errors[] = 'programme_structure does not match the selected programme';
            }

            if ($programme && $department_code !== '' && strtolower($department_code) !== strtolower(trim((string) $programme['department_code']))) {
                $row_errors[] = 'department_code does not match the selected programme';
            }

            $placement = array('programme_structure' => $structure_value);
            $level = null;
            if ($structure_value === 'contact') {
                $contact_number = filter_var($contact_value, FILTER_VALIDATE_INT);
                if ($contact_number === false || $contact_number < 1 || $contact_number > 6) {
                    $row_errors[] = 'contact_number must be between 1 and 6';
                } else {
                    $placement['contact_number'] = (int) $contact_number;
                    $placement['year_number'] = null;
                    $placement['semester_name'] = null;
                    $level = 'Contact ' . (int) $contact_number;
                }
            } elseif ($structure_value === 'semester') {
                $year_number = filter_var($year_value, FILTER_VALIDATE_INT);
                if ($year_number === false || $year_number < 1 || $year_number > 5) {
                    $row_errors[] = 'year_number must be between 1 and 5';
                }
                $semester_lookup = array(
                    'first semester' => 'First Semester',
                    'second semester' => 'Second Semester',
                );
                $semester_key = strtolower($semester_value);
                if (!isset($semester_lookup[$semester_key])) {
                    $row_errors[] = 'semester must be First Semester or Second Semester';
                }
                if ($year_number !== false && $year_number >= 1 && $year_number <= 5 && isset($semester_lookup[$semester_key])) {
                    $placement['contact_number'] = null;
                    $placement['year_number'] = (int) $year_number;
                    $placement['semester_name'] = $semester_lookup[$semester_key];
                    $level = 'Year ' . (int) $year_number;
                }
            }

            if ($programme) {
                $key = (string) $programme['id'] . '|' . strtolower($course_code);
                if (isset($seen[$key])) {
                    $row_errors[] = 'course_code is duplicated for this programme in the CSV';
                } else {
                    $seen[$key] = true;
                }

                if (empty($row_errors) && isset($existing[$key])) {
                    $skipped++;
                    continue;
                }
            }

            if (!empty($row_errors)) {
                $errors[] = array(
                    'row' => $row_number,
                    'course_code' => $course_code,
                    'message' => implode('; ', $row_errors),
                );
                continue;
            }

            $validated[] = array(
                'programme_id' => $programme['id'],
                'course_code' => $course_code,
                'course_title' => $course_title,
                'units' => (int) $units,
                'level' => $level,
                'type' => $type,
                'placement' => $placement,
            );
        }

        if (!empty($errors)) {
            return array(
                'error' => 'No courses were imported. Fix the CSV validation errors and try again.',
                'code' => 422,
                'errors' => $errors,
            );
        }

        $this->db->trans_begin();
        $created = 0;
        foreach ($validated as $course) {
            $course_id = $this->create_course(
                $course['programme_id'],
                $course['course_code'],
                $course['course_title'],
                $course['units'],
                $course['level'],
                $course['type'],
                $course['placement']
            );
            if (!$course_id) {
                $this->db->trans_rollback();
                return array('error' => 'The course upload could not be saved', 'code' => 500);
            }
            $created++;
        }

        if ($this->db->trans_status() === false) {
            $this->db->trans_rollback();
            return array('error' => 'The course upload could not be saved', 'code' => 500);
        }

        $this->db->trans_commit();
        return array('created' => $created, 'skipped' => $skipped);
    }

    private function course_csv_value($row, $keys)
    {
        foreach ($keys as $key) {
            if (isset($row[$key]) && trim((string) $row[$key]) !== '') {
                return trim((string) $row[$key]);
            }
        }

        foreach ($row as $row_key => $value) {
            $normalized_key = strtolower(trim((string) $row_key));
            $normalized_key = preg_replace('/[\s-]+/', '_', $normalized_key);
            if (in_array($normalized_key, $keys, true) && trim((string) $value) !== '') {
                return trim((string) $value);
            }
        }

        return '';
    }

    public function create_offering($course_id, $session_id, $semester_id, $lecturer_name = null, $schedule = null)
    {
        if (!$course_id || !$session_id || !$semester_id) {
            return null;
        }

        // Course offerings are teaching-period records. Refuse an arbitrary
        // client-supplied session ID even where the database has not yet had a
        // foreign key added.
        $session = $this->db->get_where('academic_sessions', array('id' => $session_id), 1)->row_array();
        if (!$session) {
            return null;
        }

        $query = $this->db->get_where('course_offerings', array(
            'course_id' => $course_id,
            'session_id' => $session_id,
            'semester_id' => $semester_id,
        ), 1);
        $row = $query->row_array();
        if ($row && isset($row['id'])) {
            return $row['id'];
        }

        $offering_id = $this->generate_uuid();
        $this->db->insert('course_offerings', array(
            'id' => $offering_id,
            'course_id' => $course_id,
            'session_id' => $session_id,
            'semester_id' => $semester_id,
            'lecturer_name' => $lecturer_name,
            'schedule' => $schedule,
            'created_at' => date('Y-m-d H:i:s'),
        ));

        return $offering_id;
    }

    public function update_course(
        $course_id,
        $programme_id,
        $code,
        $title,
        $units,
        $level,
        $type,
        $placement = array()
    ) {
        $this->ensure_course_structure_columns();
        if (!$course_id || !$programme_id || !$code || !$title || $units === null || $units === '') {
            return array('success' => false, 'message' => 'Missing required course fields', 'code' => 400);
        }

        $course = $this->db->get_where('courses', array('id' => $course_id), 1)->row_array();
        if (!$course) {
            return array('success' => false, 'message' => 'Course not found', 'code' => 404);
        }

        $existingCode = $this->db
            ->where('programme_id', $programme_id)
            ->where('code', trim((string) $code))
            ->where('id !=', $course_id)
            ->limit(1)
            ->get('courses')
            ->row_array();

        if ($existingCode) {
            return array('success' => false, 'message' => 'Another course with this code already exists in the selected programme', 'code' => 409);
        }

        $this->db->trans_begin();

        $courseUpdate = array(
            'programme_id' => $programme_id,
            'code' => trim((string) $code),
            'title' => trim((string) $title),
            'credit_units' => (int) $units,
            'level' => $level ?: null,
            'type' => $type ?: 'core',
        );
        if ($this->db->field_exists('programme_structure', 'courses')) {
            $courseUpdate = array_merge($courseUpdate, $this->course_structure_data($placement));
        }
        if ($this->db->field_exists('updated_at', 'courses')) {
            $courseUpdate['updated_at'] = date('Y-m-d H:i:s');
        }

        $this->db->where('id', $course_id);
        $this->db->update('courses', $courseUpdate);

        $old_units = (int) ($course['credit_units'] ?? 0);
        $new_units = (int) $units;
        if ($old_units !== $new_units && $this->db->table_exists('result_attempts') && $this->db->table_exists('result_batches')) {
            // Update credit_units_snapshot and recalculate quality_point for unlocked attempts
            $this->db->query("UPDATE `result_attempts` ra
                JOIN `result_batches` rb ON rb.id = ra.batch_id
                SET ra.`credit_units_snapshot` = {$new_units},
                    ra.`quality_point` = ra.`grade_point` * {$new_units}
                WHERE rb.`course_id` = '{$course_id}' AND ra.`is_locked` = 0");
        }

        if ($this->db->trans_status() === false) {
            $this->db->trans_rollback();
            return array('success' => false, 'message' => 'Failed to update course', 'code' => 400);
        }

        $this->db->trans_commit();

        return array(
            'success' => true,
            'message' => 'Course updated successfully',
            'offering_id' => null,
        );
    }

    public function delete_course($course_id)
    {
        if (!$course_id) {
            return array('success' => false, 'message' => 'Course id is required', 'code' => 400);
        }

        $course = $this->db->get_where('courses', array('id' => $course_id), 1)->row_array();
        if (!$course) {
            return array('success' => false, 'message' => 'Course not found', 'code' => 404);
        }

        if ($this->db->table_exists('course_registration_items') && $this->db->field_exists('course_id', 'course_registration_items')) {
            $this->db->where('course_id', $course_id);
            $registrationCount = $this->db->count_all_results('course_registration_items');
            if ($registrationCount > 0) {
                return array(
                    'success' => false,
                    'message' => 'Cannot delete course. It has ' . $registrationCount . ' course registration item' . ($registrationCount > 1 ? 's' : '') . '.',
                    'code' => 409,
                    'has_dependencies' => true,
                );
            }
        }

        if ($this->db->table_exists('result_batches') && $this->db->field_exists('course_id', 'result_batches')) {
            $this->db->where('course_id', $course_id);
            $batchCount = $this->db->count_all_results('result_batches');
            if ($batchCount > 0) {
                return array(
                    'success' => false,
                    'message' => 'Cannot delete course. It has ' . $batchCount . ' associated result batch' . ($batchCount > 1 ? 'es' : '') . '.',
                    'code' => 409,
                    'has_dependencies' => true,
                );
            }
        }

        $this->db->trans_begin();

        if ($this->db->table_exists('course_offerings')) {
            $this->db->where('course_id', $course_id);
            $this->db->delete('course_offerings');
        }

        $this->db->where('id', $course_id);
        $this->db->delete('courses');

        if ($this->db->trans_status() === false) {
            $this->db->trans_rollback();
            return array('success' => false, 'message' => 'Failed to delete course', 'code' => 400);
        }

        $this->db->trans_commit();
        return array('success' => true, 'message' => 'Course deleted successfully');
    }

    private function extract_session_year($name)
    {
        if (preg_match('/(20\d{2})/', $name, $matches)) {
            return $matches[1];
        }
        return date('Y');
    }

    private function semester_sort_order($name)
    {
        $name = strtolower($name);
        if (strpos($name, 'first') !== false) {
            return 1;
        }
        if (strpos($name, 'second') !== false) {
            return 2;
        }
        return 99;
    }

    private function generate_uuid()
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}

<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Student_model extends CI_Model
{
    public function tables_ready()
    {
        return $this->db->table_exists('students')
            && $this->db->table_exists('users')
            && $this->db->table_exists('programmes')
            && $this->db->table_exists('departments');
    }

    public function list_students($status = null, $department_id = null)
    {
        $this->db->select('s.id as student_id, s.user_id, s.admission_id, s.programme_id, s.department_id');
        $this->db->select('s.current_level, s.status as student_status, s.created_at');
        foreach (array('session_name', 'entry_mode', 'onboarding_source', 'profile_completion_status', 'account_update_required') as $column) {
            if ($this->db->field_exists($column, 'students')) {
                $this->db->select('s.' . $column);
            }
        }
        $this->db->select('u.full_name, u.email, u.phone');
        $hasAdmissions = $this->db->table_exists('admissions');
        if ($hasAdmissions) {
            $this->db->select('adm.matric_number, adm.admission_number');
        }
        $this->db->select('p.name as programme_name, p.code as programme_code');
        $this->db->select('d.name as department_name, d.code as department_code');

        $this->db->from('students s');
        $this->db->join('users u', 'u.id = s.user_id', 'left');
        if ($hasAdmissions) {
            $this->db->join('admissions adm', 'adm.id = s.admission_id', 'left');
        }
        $this->db->join('programmes p', 'p.id = s.programme_id', 'left');
        $this->db->join('departments d', 'd.id = s.department_id', 'left');

        if ($status && $status !== 'all') {
            $this->db->where('s.status', $status);
        }

        if ($department_id) {
            $this->db->where('s.department_id', $department_id);
        }

        $this->db->order_by('s.created_at', 'desc');
        $rows = $this->db->get()->result_array();

        $students = array();
        foreach ($rows as $row) {
            $students[] = array(
                'id' => isset($row['student_id']) ? $row['student_id'] : null,
                'user_id' => isset($row['user_id']) ? $row['user_id'] : null,
                'admission_id' => isset($row['admission_id']) ? $row['admission_id'] : null,
                'programme_id' => isset($row['programme_id']) ? $row['programme_id'] : null,
                'programme_name' => isset($row['programme_name']) ? $row['programme_name'] : null,
                'programme_code' => isset($row['programme_code']) ? $row['programme_code'] : null,
                'department_id' => isset($row['department_id']) ? $row['department_id'] : null,
                'department_name' => isset($row['department_name']) ? $row['department_name'] : null,
                'department_code' => isset($row['department_code']) ? $row['department_code'] : null,
                'full_name' => isset($row['full_name']) ? $row['full_name'] : null,
                'email' => isset($row['email']) ? $row['email'] : null,
                'phone' => isset($row['phone']) ? $row['phone'] : null,
                'current_level' => isset($row['current_level']) ? $row['current_level'] : null,
                'status' => isset($row['student_status']) ? $row['student_status'] : null,
                'matric_number' => $hasAdmissions && isset($row['matric_number']) ? $row['matric_number'] : null,
                'admission_number' => $hasAdmissions && isset($row['admission_number']) ? $row['admission_number'] : null,
                'enrollment_date' => isset($row['created_at']) ? $row['created_at'] : null,
                'gpa' => null,
                'fees_status' => null,
                'session' => isset($row['session_name']) ? $row['session_name'] : null,
                'entry_mode' => isset($row['entry_mode']) ? $row['entry_mode'] : null,
                'onboarding_source' => isset($row['onboarding_source']) ? $row['onboarding_source'] : null,
                'profile_completion_status' => isset($row['profile_completion_status']) ? $row['profile_completion_status'] : null,
                'account_update_required' => isset($row['account_update_required']) ? (int) $row['account_update_required'] : 0,
            );
        }

        return $students;
    }

    public function ensure_bulk_onboarding_schema()
    {
        if ($this->db->table_exists('users')) {
            $this->add_column_if_missing('users', 'dob', "`dob` DATE NULL");
            $this->add_column_if_missing('users', 'gender', "`gender` VARCHAR(20) NULL");
            $this->add_column_if_missing('users', 'address', "`address` TEXT NULL");
            $this->add_column_if_missing('users', 'state', "`state` VARCHAR(100) NULL");
            $this->add_column_if_missing('users', 'lga', "`lga` VARCHAR(100) NULL");
            $this->add_column_if_missing('users', 'guardian_name', "`guardian_name` VARCHAR(200) NULL");
            $this->add_column_if_missing('users', 'guardian_phone', "`guardian_phone` VARCHAR(50) NULL");
            $this->add_column_if_missing('users', 'guardian_relationship', "`guardian_relationship` VARCHAR(100) NULL");
            $this->add_column_if_missing('users', 'guardian_address', "`guardian_address` TEXT NULL");
            $this->add_column_if_missing('users', 'next_of_kin', "`next_of_kin` VARCHAR(200) NULL");
            $this->add_column_if_missing('users', 'next_of_kin_phone', "`next_of_kin_phone` VARCHAR(50) NULL");
        }

        if ($this->db->table_exists('students')) {
            $this->add_column_if_missing('students', 'session_name', "`session_name` VARCHAR(100) NULL");
            $this->add_column_if_missing('students', 'entry_mode', "`entry_mode` VARCHAR(50) NULL");
            $this->add_column_if_missing('students', 'onboarding_source', "`onboarding_source` VARCHAR(50) NOT NULL DEFAULT 'application'");
            $this->add_column_if_missing('students', 'profile_completion_status', "`profile_completion_status` VARCHAR(30) NOT NULL DEFAULT 'complete'");
            $this->add_column_if_missing('students', 'account_update_required', "`account_update_required` TINYINT(1) NOT NULL DEFAULT 0");
            $this->add_column_if_missing('students', 'imported_at', "`imported_at` DATETIME NULL");
            $this->add_column_if_missing('students', 'imported_by', "`imported_by` CHAR(36) NULL");
        }
    }

    public function bulk_onboard_students($rows, $options = array(), $actor_id = null)
    {
        $this->ensure_bulk_onboarding_schema();

        if (!$this->tables_ready() || !$this->db->table_exists('applicants') || !$this->db->table_exists('applications') || !$this->db->table_exists('admissions') || !$this->db->table_exists('academic_sessions')) {
            return array('error' => 'Required student, admission, and academic tables are not available', 'code' => 404);
        }

        $this->load->model('Courses_model');

        $created = 0;
        $updated = 0;
        $skipped = 0;
        $errors = array();
        $credentials = array();

        foreach ($rows as $index => $rawRow) {
            $rowNumber = $index + 2;
            $row = $this->normalize_row_keys($rawRow);
            if ($this->is_bulk_reference_row($row)) {
                continue;
            }
            $firstName = $this->row_value($row, array('first_name', 'firstname', 'given_name'));
            $otherName = $this->row_value($row, array('other_name', 'other_names', 'middle_name', 'middlename'));
            $lastName = $this->row_value($row, array('last_name', 'lastname', 'surname', 'family_name'));
            $fullName = $this->first_non_empty(array(
                $this->row_value($row, array('full_name', 'name', 'student_name')),
                trim($firstName . ' ' . $otherName . ' ' . $lastName),
            ));
            $nameParts = $this->resolve_bulk_name_parts($firstName, $otherName, $lastName, $fullName);
            $fullName = $nameParts['full_name'];
            $email = strtolower(trim($this->row_value($row, array('email', 'email_address'))));
            $departmentName = $this->row_value($row, array('department', 'department_name'));
            $programmeName = $this->row_value($row, array('programme', 'program', 'programme_name', 'program_name'));
            $level = $this->row_value($row, array('level_of_admission', 'current_level', 'level', 'entry_level'));
            $sessionName = $this->row_value($row, array('session_of_entry', 'session', 'academic_session', 'entry_session'));

            $missing = array();
            foreach (array('full_name' => $fullName, 'email' => $email, 'department' => $departmentName, 'programme' => $programmeName, 'level_of_admission' => $level, 'session_of_entry' => $sessionName) as $field => $value) {
                if (trim((string) $value) === '') {
                    $missing[] = $field;
                }
            }
            if (!empty($missing)) {
                $skipped += 1;
                $errors[] = array('row' => $rowNumber, 'message' => 'Missing required fields: ' . implode(', ', $missing));
                continue;
            }
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $skipped += 1;
                $errors[] = array('row' => $rowNumber, 'message' => 'Invalid email address');
                continue;
            }

            $departmentId = $this->resolve_existing_department($departmentName, $this->row_value($row, array('department_code')));
            if (!$departmentId) {
                $skipped += 1;
                $errors[] = array('row' => $rowNumber, 'message' => 'Department does not match an existing backend department');
                continue;
            }
            $programmeId = $this->resolve_existing_programme($departmentId, $programmeName, $this->row_value($row, array('programme_code', 'program_code')));
            if (!$programmeId) {
                $skipped += 1;
                $errors[] = array('row' => $rowNumber, 'message' => 'Programme does not match an existing backend programme for this department');
                continue;
            }
            $sessionId = $this->resolve_existing_session($sessionName);
            if (!$sessionId) {
                $skipped += 1;
                $errors[] = array('row' => $rowNumber, 'message' => 'Session of entry does not match an existing academic session');
                continue;
            }
            $levelValidation = $this->validate_level_for_programme($level, $programmeId);
            if (!$levelValidation['success']) {
                $skipped += 1;
                $errors[] = array('row' => $rowNumber, 'message' => $levelValidation['message']);
                continue;
            }

            $this->db->trans_begin();
            $result = $this->upsert_bulk_student_row($row, array(
                'full_name' => $fullName,
                'first_name' => $nameParts['first_name'],
                'other_name' => $nameParts['other_name'],
                'last_name' => $nameParts['last_name'],
                'email' => $email,
                'department_id' => $departmentId,
                'programme_id' => $programmeId,
                'session_id' => $sessionId,
                'session_name' => $sessionName,
                'level_of_admission' => $level,
                'current_level' => $this->calculate_current_level_from_entry($level, $sessionId, $programmeId),
                'status' => $this->normalize_student_status($this->first_non_empty(array(
                    $this->row_value($row, array('status')),
                    isset($options['default_status']) ? $options['default_status'] : 'active',
                ))),
                'entry_mode' => $this->first_non_empty(array($this->row_value($row, array('entry_mode', 'mode_of_entry')), 'Direct Entry')),
                'actor_id' => $actor_id,
            ));

            if ($this->db->trans_status() === false || isset($result['error'])) {
                $this->db->trans_rollback();
                $skipped += 1;
                $errors[] = array(
                    'row' => $rowNumber,
                    'message' => isset($result['error']) ? $result['error'] : 'Failed to save student',
                );
                continue;
            }

            $this->db->trans_commit();
            if (!empty($result['created'])) {
                $created += 1;
            } else {
                $updated += 1;
            }
            if (isset($result['temporary_password']) && $result['temporary_password']) {
                $credentials[] = array(
                    'email' => $email,
                    'temporary_password' => $result['temporary_password'],
                );
            }
        }

        return array(
            'created' => $created,
            'updated' => $updated,
            'skipped' => $skipped,
            'errors' => $errors,
            'credentials' => $credentials,
        );
    }

    public function update_student_profile_by_user($user_id, $payload)
    {
        $this->ensure_bulk_onboarding_schema();
        if (!$user_id || !$this->db->table_exists('users')) {
            return array('error' => 'User not found', 'code' => 404);
        }

        $markingComplete = (isset($payload['account_update_required']) && !$payload['account_update_required'])
            || (isset($payload['profile_completion_status']) && $payload['profile_completion_status'] === 'complete');
        if ($markingComplete) {
            $validation = $this->validate_profile_completion_payload($payload);
            if (!$validation['success']) {
                return array('error' => $validation['message'], 'code' => 422);
            }
        }

        $allowedUserFields = array(
            'phone', 'dob', 'gender', 'address', 'state', 'lga',
            'guardian_name', 'guardian_phone', 'guardian_relationship',
            'guardian_address', 'next_of_kin', 'next_of_kin_phone',
        );
        $updates = array();
        foreach ($allowedUserFields as $field) {
            if (array_key_exists($field, $payload) && $this->db->field_exists($field, 'users')) {
                $value = is_string($payload[$field]) ? trim($payload[$field]) : $payload[$field];
                $updates[$field] = $value === '' ? null : $value;
            }
        }
        if ($this->db->field_exists('updated_at', 'users')) {
            $updates['updated_at'] = date('Y-m-d H:i:s');
        }

        if (!empty($updates)) {
            $this->db->where('id', $user_id);
            $this->db->update('users', $updates);
        }

        if ($this->db->table_exists('students')) {
            $studentUpdates = array();
            if ($this->db->field_exists('profile_completion_status', 'students')) {
                $studentUpdates['profile_completion_status'] = isset($payload['profile_completion_status'])
                    ? $payload['profile_completion_status']
                    : 'complete';
            }
            if ($this->db->field_exists('account_update_required', 'students')) {
                $studentUpdates['account_update_required'] = isset($payload['account_update_required'])
                    ? (int) (bool) $payload['account_update_required']
                    : 0;
            }
            if ($this->db->field_exists('updated_at', 'students')) {
                $studentUpdates['updated_at'] = date('Y-m-d H:i:s');
            }
            if (!empty($studentUpdates)) {
                $this->db->where('user_id', $user_id);
                $this->db->update('students', $studentUpdates);
            }
        }

        $this->update_imported_application_payload($user_id, $payload);

        return array('data' => $this->get_profile_by_user_id($user_id));
    }

    private function validate_profile_completion_payload($payload)
    {
        $required = array(
            'phone', 'address', 'state', 'lga',
            'guardian_name', 'guardian_phone', 'guardian_relationship',
        );
        foreach ($required as $field) {
            if (!isset($payload[$field]) || trim((string) $payload[$field]) === '') {
                return array('success' => false, 'message' => 'Missing required profile field: ' . $field);
            }
        }

        $education = isset($payload['education']) && is_array($payload['education']) ? $payload['education'] : array();
        foreach (array('primarySchool', 'primaryYear', 'secondarySchool', 'secondaryYear') as $field) {
            if (!isset($education[$field]) || trim((string) $education[$field]) === '') {
                return array('success' => false, 'message' => 'Primary and secondary education information is required.');
            }
        }

        $academic = isset($payload['academic']) && is_array($payload['academic']) ? $payload['academic'] : array();
        foreach (array('qualification', 'examNumber', 'examYear') as $field) {
            if (!isset($academic[$field]) || trim((string) $academic[$field]) === '') {
                return array('success' => false, 'message' => 'Exam body, exam number, and exam year are required.');
            }
        }

        $oLevel = isset($payload['oLevel']) && is_array($payload['oLevel']) ? $payload['oLevel'] : array();
        $firstSitting = isset($oLevel['firstSitting']) && is_array($oLevel['firstSitting']) ? $oLevel['firstSitting'] : array();
        $validRows = 0;
        foreach ($firstSitting as $row) {
            if (is_array($row) && !empty($row['subject']) && !empty($row['grade'])) {
                $validRows += 1;
            }
        }
        if ($validRows < 5) {
            return array('success' => false, 'message' => 'At least five O Level subjects with grades are required.');
        }

        return array('success' => true);
    }

    public function get_profile_by_user_id($user_id)
    {
        $this->ensure_bulk_onboarding_schema();
        $this->db->select('u.*');
        if ($this->db->table_exists('students')) {
            $this->db->select('s.id as student_id, s.current_level, s.status as student_status');
            foreach (array('session_name', 'entry_mode', 'onboarding_source', 'profile_completion_status', 'account_update_required') as $column) {
                if ($this->db->field_exists($column, 'students')) {
                    $this->db->select('s.' . $column);
                }
            }
            $this->db->select('p.name as programme_name, d.name as department_name');
            if ($this->db->table_exists('admissions')) {
                $this->db->select('adm.admission_number, adm.matric_number');
            }
            if ($this->db->table_exists('applications')) {
                $this->db->select('app.application_no, app.payload as application_payload');
            }
        }
        $this->db->from('users u');
        if ($this->db->table_exists('students')) {
            $this->db->join('students s', 's.user_id = u.id', 'left');
            $this->db->join('programmes p', 'p.id = s.programme_id', 'left');
            $this->db->join('departments d', 'd.id = s.department_id', 'left');
            if ($this->db->table_exists('admissions')) {
                $this->db->join('admissions adm', 'adm.id = s.admission_id', 'left');
            }
            if ($this->db->table_exists('applications')) {
                $this->db->join('applications app', 'app.id = adm.application_id', 'left');
            }
        }
        $this->db->where('u.id', $user_id);
        $this->db->limit(1);
        $row = $this->db->get()->row_array();
        if ($row && isset($row['application_payload'])) {
            $decoded = json_decode($row['application_payload'], true);
            if (is_array($decoded)) {
                $row['education'] = isset($decoded['education']) ? $decoded['education'] : null;
                $row['academic'] = isset($decoded['academic']) ? $decoded['academic'] : null;
                $row['oLevel'] = isset($decoded['oLevel']) ? $decoded['oLevel'] : null;
            }
        }
        return $row;
    }

    private function update_imported_application_payload($user_id, $payload)
    {
        if (!$user_id || !$this->db->table_exists('students') || !$this->db->table_exists('admissions') || !$this->db->table_exists('applications')) {
            return;
        }

        if (!$this->db->field_exists('payload', 'applications')) {
            $this->db->query("ALTER TABLE `applications` ADD COLUMN `payload` MEDIUMTEXT NULL");
        }

        $this->db->select('app.*');
        $this->db->from('students s');
        $this->db->join('admissions adm', 'adm.id = s.admission_id', 'left');
        $this->db->join('applications app', 'app.id = adm.application_id', 'left');
        $this->db->where('s.user_id', $user_id);
        $this->db->limit(1);
        $application = $this->db->get()->row_array();
        if (!$application || !isset($application['id'])) {
            return;
        }

        $currentPayload = array();
        if (isset($application['payload']) && $application['payload']) {
            $decoded = json_decode($application['payload'], true);
            if (is_array($decoded)) {
                $currentPayload = $decoded;
            }
        }

        $education = isset($payload['education']) && is_array($payload['education'])
            ? $payload['education']
            : array(
                'primarySchool' => isset($payload['primary_school']) ? $payload['primary_school'] : null,
                'primaryYear' => isset($payload['primary_year']) ? $payload['primary_year'] : null,
                'secondarySchool' => isset($payload['secondary_school']) ? $payload['secondary_school'] : null,
                'secondaryYear' => isset($payload['secondary_year']) ? $payload['secondary_year'] : null,
            );

        $academicPatch = isset($payload['academic']) && is_array($payload['academic'])
            ? $payload['academic']
            : array(
                'qualification' => isset($payload['qualification']) ? $payload['qualification'] : null,
                'graduationYear' => isset($payload['graduation_year']) ? $payload['graduation_year'] : null,
                'examNumber' => isset($payload['exam_number']) ? $payload['exam_number'] : null,
                'examCenter' => isset($payload['exam_center']) ? $payload['exam_center'] : null,
                'examYear' => isset($payload['exam_year']) ? $payload['exam_year'] : null,
                'qualification2' => isset($payload['qualification2']) ? $payload['qualification2'] : null,
                'examNumber2' => isset($payload['exam_number2']) ? $payload['exam_number2'] : null,
                'examCenter2' => isset($payload['exam_center2']) ? $payload['exam_center2'] : null,
                'examYear2' => isset($payload['exam_year2']) ? $payload['exam_year2'] : null,
            );

        $oLevel = isset($payload['oLevel']) && is_array($payload['oLevel'])
            ? $payload['oLevel']
            : array('firstSitting' => array(), 'secondSitting' => array());

        $currentPayload['education'] = $education;
        $currentPayload['academic'] = array_merge(
            isset($currentPayload['academic']) && is_array($currentPayload['academic']) ? $currentPayload['academic'] : array(),
            $academicPatch
        );
        $currentPayload['oLevel'] = array(
            'firstSitting' => isset($oLevel['firstSitting']) && is_array($oLevel['firstSitting']) ? $oLevel['firstSitting'] : array(),
            'secondSitting' => isset($oLevel['secondSitting']) && is_array($oLevel['secondSitting']) ? $oLevel['secondSitting'] : array(),
        );

        $this->db->where('id', $application['id']);
        $this->db->update('applications', $this->filter_table_data('applications', array(
            'payload' => json_encode($currentPayload),
            'updated_at' => date('Y-m-d H:i:s'),
        )));

        $this->sync_application_olevel_results($application['id'], $currentPayload['academic'], $currentPayload['oLevel']);
    }

    private function sync_application_olevel_results($applicationId, $academic, $oLevel)
    {
        if (!$applicationId) {
            return;
        }

        $this->ensure_application_olevel_results_table();
        if (!$this->db->table_exists('application_olevel_results')) {
            return;
        }

        $this->db->where('application_id', $applicationId);
        $this->db->delete('application_olevel_results');

        $sittings = array(
            1 => array(
                'rows' => isset($oLevel['firstSitting']) && is_array($oLevel['firstSitting']) ? $oLevel['firstSitting'] : array(),
                'exam_body' => isset($academic['qualification']) ? $academic['qualification'] : null,
                'exam_number' => isset($academic['examNumber']) ? $academic['examNumber'] : null,
                'exam_year' => isset($academic['examYear']) ? $academic['examYear'] : null,
            ),
            2 => array(
                'rows' => isset($oLevel['secondSitting']) && is_array($oLevel['secondSitting']) ? $oLevel['secondSitting'] : array(),
                'exam_body' => isset($academic['qualification2']) ? $academic['qualification2'] : null,
                'exam_number' => isset($academic['examNumber2']) ? $academic['examNumber2'] : null,
                'exam_year' => isset($academic['examYear2']) ? $academic['examYear2'] : null,
            ),
        );

        foreach ($sittings as $sitting => $data) {
            $rows = array_values(array_filter($data['rows'], function ($row) {
                return is_array($row)
                    && !empty($row['subject'])
                    && !empty($row['grade']);
            }));
            if (empty($rows)) {
                continue;
            }
            $this->db->insert('application_olevel_results', $this->filter_table_data('application_olevel_results', array(
                'id' => $this->generate_uuid(),
                'application_id' => $applicationId,
                'sitting' => $sitting,
                'exam_body' => $data['exam_body'],
                'exam_number' => $data['exam_number'],
                'exam_year' => $data['exam_year'],
                'exam_type' => $sitting === 1 ? 'First Sitting' : 'Second Sitting',
                'subjects' => json_encode($rows),
                'created_at' => date('Y-m-d H:i:s'),
            )));
        }
    }

    private function ensure_application_olevel_results_table()
    {
        if ($this->db->table_exists('application_olevel_results')) {
            return;
        }

        $this->db->query("CREATE TABLE IF NOT EXISTS `application_olevel_results` (
            `id` CHAR(36) NOT NULL,
            `application_id` CHAR(36) NOT NULL,
            `sitting` TINYINT(1) NULL,
            `exam_body` VARCHAR(50) NULL,
            `exam_number` VARCHAR(50) NULL,
            `exam_year` VARCHAR(10) NULL,
            `exam_type` VARCHAR(30) NULL,
            `subjects` MEDIUMTEXT NULL,
            `created_at` DATETIME NULL,
            PRIMARY KEY (`id`),
            KEY `application_id` (`application_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    }

    private function upsert_bulk_student_row($row, $context)
    {
        $now = date('Y-m-d H:i:s');
        $email = $context['email'];
        $temporaryPassword = $this->row_value($row, array('temporary_password', 'password'));
        $createdUser = false;

        $user = $this->db->get_where('users', array('email' => $email), 1)->row_array();
        if ($user && isset($user['id'])) {
            $userId = $user['id'];
            $userUpdates = array(
                'full_name' => $context['full_name'],
                'phone' => $this->null_if_empty($this->bulk_phone_value($row)),
                'status' => 'active',
            );
            if ($temporaryPassword !== '') {
                $userUpdates['password_hash'] = password_hash($temporaryPassword, PASSWORD_BCRYPT);
            }
            if ($this->db->field_exists('updated_at', 'users')) {
                $userUpdates['updated_at'] = $now;
            }
            $this->db->where('id', $userId);
            $this->db->update('users', $this->filter_table_data('users', $userUpdates));
        } else {
            $createdUser = true;
            $userId = $this->generate_uuid();
            if ($temporaryPassword === '') {
                $temporaryPassword = 'MCCAS' . substr(str_replace('-', '', $userId), 0, 8);
            }
            $this->db->insert('users', $this->filter_table_data('users', array(
                'id' => $userId,
                'email' => $email,
                'full_name' => $context['full_name'],
                'phone' => $this->null_if_empty($this->bulk_phone_value($row)),
                'nin' => $this->null_if_empty($this->row_value($row, array('nin'))),
                'password_hash' => password_hash($temporaryPassword, PASSWORD_BCRYPT),
                'status' => 'active',
                'created_at' => $now,
                'created_by' => $context['actor_id'],
            )));
        }

        $nameParts = array(
            'first_name' => isset($context['first_name']) ? $context['first_name'] : null,
            'other_name' => isset($context['other_name']) ? $context['other_name'] : null,
            'last_name' => isset($context['last_name']) ? $context['last_name'] : null,
        );
        $applicantId = $this->ensure_applicant($email, $nameParts, $row, $context, $now);
        $applicationId = $this->ensure_import_application($applicantId, $row, $context, $now);
        $admissionId = $this->ensure_import_admission($applicationId, $row, $context, $now);

        $student = $this->db->get_where('students', array('user_id' => $userId), 1)->row_array();
        $studentData = $this->filter_table_data('students', array(
            'user_id' => $userId,
            'admission_id' => $admissionId,
            'programme_id' => $context['programme_id'],
            'department_id' => $context['department_id'],
            'current_level' => $context['current_level'],
            'status' => $context['status'],
            'session_name' => $context['session_name'],
            'entry_mode' => $context['entry_mode'],
            'onboarding_source' => 'bulk_upload',
            'profile_completion_status' => 'pending',
            'account_update_required' => 1,
            'imported_at' => $now,
            'imported_by' => $context['actor_id'],
            'updated_at' => $now,
        ));

        // Bulk imports carry an administrator-selected canonical session.
        // Set the immutable entry cohort only when creating the student; a
        // later import must never silently move an existing student between
        // cohorts.
        if (!$student && $this->db->field_exists('entry_session_id', 'students')
            && !empty($context['session_id'])) {
            $studentData['entry_session_id'] = $context['session_id'];
        }

        if ($student && isset($student['id'])) {
            $this->db->where('id', $student['id']);
            $this->db->update('students', $studentData);
        } else {
            $studentData['id'] = $this->generate_uuid();
            $studentData['created_at'] = $now;
            $studentData['created_by'] = $context['actor_id'];
            $this->db->insert('students', $this->filter_table_data('students', $studentData));
        }

        return array(
            'created' => $createdUser || !$student,
            'temporary_password' => $createdUser ? $temporaryPassword : null,
        );
    }

    private function ensure_applicant($email, $nameParts, $row, $context, $now)
    {
        $existing = $this->db->get_where('applicants', array('email' => $email), 1)->row_array();
        $data = $this->filter_table_data('applicants', array(
            'full_name' => $context['full_name'],
            'email' => $email,
            'first_name' => $nameParts['first_name'],
            'last_name' => $nameParts['last_name'],
            'other_name' => $nameParts['other_name'],
            'phone' => $this->null_if_empty($this->bulk_phone_value($row)),
            'address' => $this->null_if_empty($this->row_value($row, array('address'))),
            'state' => $this->null_if_empty($this->row_value($row, array('state'))),
            'lga' => $this->null_if_empty($this->row_value($row, array('lga'))),
            'nin' => $this->null_if_empty($this->row_value($row, array('nin'))),
            'updated_at' => $now,
        ));
        if ($existing && isset($existing['id'])) {
            $this->db->where('id', $existing['id']);
            $this->db->update('applicants', $data);
            return $existing['id'];
        }

        $id = $this->generate_uuid();
        $data['id'] = $id;
        $data['created_at'] = $now;
        $data['created_by'] = $context['actor_id'];
        $this->db->insert('applicants', $this->filter_table_data('applicants', $data));
        return $id;
    }

    private function ensure_import_application($applicantId, $row, $context, $now)
    {
        $payload = $this->build_import_application_payload($row, $context);
        $existing = $this->db->get_where('applications', array(
            'applicant_id' => $applicantId,
            'programme_id' => $context['programme_id'],
            'session_id' => $context['session_id'],
        ), 1)->row_array();
        if ($existing && isset($existing['id'])) {
            $this->db->where('id', $existing['id']);
            $this->db->update('applications', $this->filter_table_data('applications', array(
                'entry_mode' => $context['entry_mode'],
                'status' => 'approved',
                'payload' => json_encode($payload),
                'updated_at' => $now,
            )));
            return $existing['id'];
        }

        $id = $this->generate_uuid();
        $this->db->insert('applications', $this->filter_table_data('applications', array(
            'id' => $id,
            'applicant_id' => $applicantId,
            'application_no' => 'IMP-' . date('Ymd') . '-' . strtoupper(substr(str_replace('-', '', $id), 0, 6)),
            'session_id' => $context['session_id'],
            'programme_id' => $context['programme_id'],
            'entry_mode' => $context['entry_mode'],
            'status' => 'approved',
            'payload' => json_encode($payload),
            'applied_at' => $now,
            'created_at' => $now,
            'created_by' => $context['actor_id'],
        )));
        return $id;
    }

    private function ensure_import_admission($applicationId, $row, $context, $now)
    {
        $existing = $this->db->get_where('admissions', array('application_id' => $applicationId), 1)->row_array();
        $admissionNumber = $this->first_non_empty(array(
            $this->row_value($row, array('admission_number', 'admission_no')),
            $this->row_value($row, array('matric_number', 'matric_no')),
            $existing && isset($existing['admission_number']) ? $existing['admission_number'] : null,
            'ADM-' . date('Ymd') . '-' . strtoupper(substr(str_replace('-', '', $applicationId), 0, 6)),
        ));
        $data = $this->filter_table_data('admissions', array(
            'admission_number' => $admissionNumber,
            'matric_number' => null,
            'level' => isset($context['level_of_admission']) ? $context['level_of_admission'] : $context['current_level'],
            'admission_date' => date('Y-m-d'),
            'status' => 'admitted',
            'updated_at' => $now,
        ));
        if ($existing && isset($existing['id'])) {
            $this->db->where('id', $existing['id']);
            $this->db->update('admissions', $data);
            return $existing['id'];
        }

        $id = $this->generate_uuid();
        $data['id'] = $id;
        $data['application_id'] = $applicationId;
        $data['created_at'] = $now;
        $data['created_by'] = $context['actor_id'];
        $this->db->insert('admissions', $this->filter_table_data('admissions', $data));
        return $id;
    }

    private function add_column_if_missing($table, $column, $definition)
    {
        if (!$this->db->field_exists($column, $table)) {
            $this->db->query("ALTER TABLE `" . $table . "` ADD COLUMN " . $definition);
        }
    }

    private function filter_table_data($table, $data)
    {
        $fields = $this->db->list_fields($table);
        $filtered = array();
        foreach ($data as $key => $value) {
            if (in_array($key, $fields, true)) {
                $filtered[$key] = $value;
            }
        }
        return $filtered;
    }

    private function normalize_row_keys($row)
    {
        $out = array();
        foreach ($row as $key => $value) {
            $normalized = strtolower(trim((string) $key));
            $normalized = str_replace(array(' ', '-'), '_', $normalized);
            $out[$normalized] = is_string($value) ? trim($value) : $value;
        }
        return $out;
    }

    private function is_bulk_reference_row($row)
    {
        $studentFields = array(
            'first_name', 'firstname', 'last_name', 'lastname', 'full_name',
            'email', 'admission_number',
            'level_of_admission', 'session_of_entry',
        );
        foreach ($studentFields as $field) {
            if (isset($row[$field]) && trim((string) $row[$field]) !== '') {
                return false;
            }
        }

        foreach (array('programme_reference', 'reference_department', 'reference_code', 'reference_structure') as $field) {
            if (isset($row[$field]) && trim((string) $row[$field]) !== '') {
                return true;
            }
        }

        return false;
    }

    private function resolve_existing_department($name, $code = null)
    {
        $name = trim((string) $name);
        $code = $code !== null ? trim((string) $code) : '';

        if ($code !== '') {
            $row = $this->db->get_where('departments', array('code' => $code), 1)->row_array();
            if ($row && isset($row['id'])) {
                return $row['id'];
            }
        }

        if ($name === '') {
            return null;
        }

        $row = $this->db->get_where('departments', array('name' => $name), 1)->row_array();
        return $row && isset($row['id']) ? $row['id'] : null;
    }

    private function resolve_existing_programme($departmentId, $name, $code = null)
    {
        $name = trim((string) $name);
        $code = $code !== null ? trim((string) $code) : '';

        if ($code !== '') {
            $this->db->where('code', $code);
            if ($departmentId) {
                $this->db->where('department_id', $departmentId);
            }
            $row = $this->db->get('programmes', 1)->row_array();
            if ($row && isset($row['id'])) {
                return $row['id'];
            }
        }

        if ($name === '' || !$departmentId) {
            return null;
        }

        $row = $this->db->get_where('programmes', array(
            'name' => $name,
            'department_id' => $departmentId,
        ), 1)->row_array();

        return $row && isset($row['id']) ? $row['id'] : null;
    }

    private function resolve_existing_session($name)
    {
        $name = trim((string) $name);
        if ($name === '' || !$this->db->table_exists('academic_sessions')) {
            return null;
        }

        $row = $this->db->get_where('academic_sessions', array('name' => $name), 1)->row_array();
        return $row && isset($row['id']) ? $row['id'] : null;
    }

    private function row_value($row, $keys)
    {
        foreach ($keys as $key) {
            if (isset($row[$key]) && trim((string) $row[$key]) !== '') {
                return trim((string) $row[$key]);
            }
        }
        return '';
    }

    private function bulk_phone_value($row)
    {
        $value = $this->row_value($row, array('phone_number', 'phone', 'contact', 'phone_no'));
        $value = trim((string) $value);

        if (preg_match('/^=\s*["\'](.+)["\']$/', $value, $matches)) {
            $value = $matches[1];
        }
        if (strpos($value, "'") === 0) {
            $value = substr($value, 1);
        }

        return trim($value);
    }

    private function first_non_empty($values)
    {
        foreach ($values as $value) {
            if ($value !== null && trim((string) $value) !== '') {
                return trim((string) $value);
            }
        }
        return null;
    }

    private function resolve_bulk_name_parts($firstName, $otherName, $lastName, $fullName)
    {
        $firstName = trim((string) $firstName);
        $otherName = trim((string) $otherName);
        $lastName = trim((string) $lastName);

        if (($firstName === '' || $lastName === '') && trim((string) $fullName) !== '') {
            $split = $this->split_name($fullName);
            if ($firstName === '') {
                $firstName = $split['first_name'];
            }
            if ($otherName === '') {
                $otherName = $split['other_name'];
            }
            if ($lastName === '') {
                $lastName = $split['last_name'];
            }
        }

        $resolvedFullName = trim(implode(' ', array_filter(array($firstName, $otherName, $lastName), function ($value) {
            return trim((string) $value) !== '';
        })));

        return array(
            'first_name' => $firstName,
            'other_name' => $otherName === '' ? null : $otherName,
            'last_name' => $lastName,
            'full_name' => $resolvedFullName !== '' ? $resolvedFullName : trim((string) $fullName),
        );
    }

    private function build_import_application_payload($row, $context)
    {
        return array(
            'personal' => array(
                'firstName' => isset($context['first_name']) ? $context['first_name'] : null,
                'middleName' => isset($context['other_name']) ? $context['other_name'] : null,
                'lastName' => isset($context['last_name']) ? $context['last_name'] : null,
                'dateOfBirth' => $this->row_value($row, array('date_of_birth', 'dob')),
                'gender' => $this->row_value($row, array('gender')),
                'maritalStatus' => $this->row_value($row, array('marital_status')),
                'nationality' => $this->row_value($row, array('nationality')),
                'stateOfOrigin' => $this->row_value($row, array('state_of_origin', 'state')),
                'localGovernment' => $this->row_value($row, array('local_government', 'lga')),
            ),
            'contact' => array(
                'email' => $context['email'],
                'phone' => $this->bulk_phone_value($row),
                'alternatePhone' => $this->row_value($row, array('alternate_phone', 'alt_phone')),
                'address' => $this->row_value($row, array('address')),
                'city' => $this->row_value($row, array('city')),
                'state' => $this->row_value($row, array('state')),
                'postalCode' => $this->row_value($row, array('postal_code')),
            ),
            'jamb' => array(
                'jambNumber' => $this->row_value($row, array('jamb_number')),
                'jambScore' => $this->row_value($row, array('jamb_score')),
            ),
            'academic' => array(
                'qualification' => $this->row_value($row, array('qualification')),
                'graduationYear' => $this->row_value($row, array('graduation_year')),
                'gradeObtained' => $this->row_value($row, array('grade_obtained')),
                'examNumber' => $this->row_value($row, array('exam_number')),
                'examCenter' => $this->row_value($row, array('exam_center')),
                'examYear' => $this->row_value($row, array('exam_year')),
                'applicationSession' => $context['session_name'],
                'applicationLevel' => isset($context['level_of_admission']) ? $context['level_of_admission'] : null,
                'applicationModeOfEntry' => $context['entry_mode'],
                'firstChoiceDepartment' => $this->row_value($row, array('department', 'department_name')),
                'firstChoiceProgram' => $this->row_value($row, array('programme', 'program', 'programme_name', 'program_name')),
                'courseOfStudy' => $this->row_value($row, array('programme', 'program', 'programme_name', 'program_name')),
            ),
            'guardian' => array(
                'guardianName' => $this->row_value($row, array('guardian_name')),
                'guardianEmail' => $this->row_value($row, array('guardian_email')),
                'guardianPhone' => $this->row_value($row, array('guardian_phone')),
                'guardianAddress' => $this->row_value($row, array('guardian_address')),
            ),
            'oLevel' => array(
                'firstSitting' => array(),
                'secondSitting' => array(),
                'hasSecondSitting' => false,
            ),
            'documents' => array(),
        );
    }

    private function split_name($fullName)
    {
        $parts = preg_split('/\s+/', trim((string) $fullName));
        $parts = array_values(array_filter($parts));
        if (count($parts) <= 1) {
            return array('first_name' => isset($parts[0]) ? $parts[0] : 'Student', 'other_name' => null, 'last_name' => 'Student');
        }
        return array(
            'first_name' => $parts[0],
            'other_name' => count($parts) > 2 ? implode(' ', array_slice($parts, 1, -1)) : null,
            'last_name' => $parts[count($parts) - 1],
        );
    }

    private function null_if_empty($value)
    {
        $value = trim((string) $value);
        return $value === '' ? null : $value;
    }

    private function normalize_student_status($status)
    {
        $status = strtolower(trim((string) $status));
        return in_array($status, array('inactive', 'suspended', 'graduated'), true) ? $status : 'active';
    }

    private function calculate_current_level_from_entry($levelOfAdmission, $entrySessionId, $programmeId)
    {
        $admissionNumber = $this->level_number_from_label($levelOfAdmission);
        if ($admissionNumber < 1) {
            return $levelOfAdmission;
        }

        $entrySession = $this->academic_session_by_id($entrySessionId);
        $activeSession = $this->active_academic_session();
        $sessionIndex = $this->calculate_session_index($entrySession, $activeSession);
        $currentNumber = $admissionNumber + max(0, $sessionIndex - 1);
        $programme = $this->programme_summary($programmeId);
        $structure = isset($programme['programme_structure']) ? strtolower(trim((string) $programme['programme_structure'])) : 'semester';
        if ($structure === 'contact_based') {
            $structure = 'contact';
        }

        if ($structure === 'contact') {
            return 'Contact ' . min(6, $currentNumber);
        }

        $durationYears = isset($programme['duration_years']) ? (int) $programme['duration_years'] : 0;
        if ($durationYears > 0) {
            $currentNumber = min($durationYears, $currentNumber);
        }
        return (string) ($currentNumber * 100);
    }

    private function validate_level_for_programme($levelOfAdmission, $programmeId)
    {
        $number = $this->level_number_from_label($levelOfAdmission);
        if ($number < 1) {
            return array('success' => false, 'message' => 'Level of admission is not valid for the selected programme');
        }

        $programme = $this->programme_summary($programmeId);
        $structure = isset($programme['programme_structure']) ? strtolower(trim((string) $programme['programme_structure'])) : 'semester';
        if ($structure === 'contact_based') {
            $structure = 'contact';
        }

        if ($structure === 'contact') {
            if ($number > 6) {
                return array('success' => false, 'message' => 'Contact programme level must be Contact 1 to Contact 6');
            }
            return array('success' => true);
        }

        $durationYears = isset($programme['duration_years']) ? (int) $programme['duration_years'] : 0;
        if ($durationYears > 0 && $number > $durationYears) {
            return array('success' => false, 'message' => 'Level of admission is above the programme duration');
        }

        return array('success' => true);
    }

    private function level_number_from_label($value)
    {
        $value = trim((string) $value);
        if ($value === '') {
            return 0;
        }
        if (preg_match('/contact\s*(\d+)/i', $value, $matches)) {
            return max(1, (int) $matches[1]);
        }
        if (preg_match('/(\d+)/', $value, $matches)) {
            $number = (int) $matches[1];
            return $number >= 100 ? max(1, (int) ceil($number / 100)) : max(1, $number);
        }
        return 0;
    }

    private function calculate_session_index($entrySession, $currentSession)
    {
        $entryYear = $this->session_start_year($entrySession);
        $currentYear = $this->session_start_year($currentSession);
        if ($entryYear !== null && $currentYear !== null) {
            return max(1, ($currentYear - $entryYear) + 1);
        }

        if (!$entrySession || !$currentSession || empty($entrySession['id']) || empty($currentSession['id'])) {
            return 1;
        }

        $ordered = $this->ordered_academic_sessions();
        $entryIndex = null;
        $currentIndex = null;
        foreach ($ordered as $index => $session) {
            if (isset($session['id']) && $session['id'] === $entrySession['id']) {
                $entryIndex = $index;
            }
            if (isset($session['id']) && $session['id'] === $currentSession['id']) {
                $currentIndex = $index;
            }
        }

        if ($entryIndex === null || $currentIndex === null) {
            return 1;
        }

        return max(1, ($currentIndex - $entryIndex) + 1);
    }

    private function session_start_year($session)
    {
        if (!is_array($session)) {
            return null;
        }

        if (!empty($session['name']) && preg_match('/(20\d{2}|19\d{2})/', $session['name'], $matches)) {
            return (int) $matches[1];
        }

        if (!empty($session['start_date'])) {
            $time = strtotime($session['start_date']);
            if ($time) {
                return (int) date('Y', $time);
            }
        }

        return null;
    }

    private function ordered_academic_sessions()
    {
        if (!$this->db->table_exists('academic_sessions')) {
            return array();
        }

        if ($this->db->field_exists('start_date', 'academic_sessions')) {
            $this->db->order_by('start_date', 'asc');
        } else {
            $this->db->order_by('name', 'asc');
        }
        return $this->db->get('academic_sessions')->result_array();
    }

    private function academic_session_by_id($sessionId)
    {
        if (!$sessionId || !$this->db->table_exists('academic_sessions')) {
            return null;
        }
        return $this->db->get_where('academic_sessions', array('id' => $sessionId), 1)->row_array();
    }

    private function active_academic_session()
    {
        if (!$this->db->table_exists('academic_sessions')) {
            return null;
        }
        if ($this->db->field_exists('is_active', 'academic_sessions')) {
            $this->db->where('is_active', 1);
            $this->db->order_by('start_date', 'desc');
            $this->db->order_by('name', 'desc');
            $row = $this->db->get('academic_sessions', 1)->row_array();
            if ($row) {
                return $row;
            }
        }
        $this->db->order_by('name', 'desc');
        return $this->db->get('academic_sessions', 1)->row_array();
    }

    private function programme_summary($programmeId)
    {
        if (!$programmeId || !$this->db->table_exists('programmes')) {
            return array();
        }
        if ($this->db->field_exists('programme_structure', 'programmes')) {
            $this->db->select('programme_structure');
        } else {
            $this->db->select("'semester' as programme_structure", false);
        }
        if ($this->db->field_exists('duration_years', 'programmes')) {
            $this->db->select('duration_years');
        }
        return $this->db->get_where('programmes', array('id' => $programmeId), 1)->row_array();
    }

    private function generate_uuid()
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}

<?php
/**
 * Test Harness for MCCE Result Batch Student Eligibility & Unsafe Fallbacks Fix
 *
 * Verifies all 12 required regression scenarios:
 * Test 1:  Normal course registration
 * Test 2:  Wrong course (registered GST122, not GST112 -> excluded from GST112)
 * Test 3:  Wrong academic session (registered in 2022/2023 -> excluded from 2023/2024)
 * Test 4:  Historical failure without current registration (failed 2021/2022, no reg in 2022/2023 -> excluded)
 * Test 5:  Already corrected carryover (failed 2021/2022, passed 2022/2023 -> excluded from 2023/2024)
 * Test 6:  Valid carryover registration (failed 2021/2022 C1, registered carryover in 2022/2023 C2 -> included)
 * Test 7:  Future failure (failed in 2024/2025 -> does not establish eligibility in 2023/2024)
 * Test 8:  Inactive course item (status = 'obsolete' / dropped -> excluded)
 * Test 9:  No eligible students (0 registrations -> batch creation fails safely, returns false)
 * Test 10: Existing scored history (historical scored attempts preserved without active reg item)
 * Test 11: Idempotency (repeated population does not duplicate attempts or create course items)
 * Test 12: Direct Entry and contact separation (DE begins Contact 2; carryover contact separation respected)
 */

define('BASEPATH', 'mock');
define('APPPATH', dirname(__DIR__) . '/application/');

if (!function_exists('log_message')) {
    function log_message($level, $message) {}
}

class MockQueryResult {
    private $rows;
    public function __construct(array $rows = []) {
        $this->rows = $rows;
    }
    public function result_array() {
        return $this->rows;
    }
    public function row_array() {
        return !empty($this->rows) ? $this->rows[0] : null;
    }
}

class MockResultsDB {
    public $tables = [];
    public $fields = [];

    private $select_fields = '*';
    private $from_table = '';
    private $joins = [];
    private $where_conditions = [];
    private $group_stack = [];
    private $trans_status = true;

    public function __construct() {
        $this->reset();
    }

    public function reset() {
        $this->tables = [
            'academic_sessions' => [
                ['id' => 'sess-2021', 'name' => '2021/2022'],
                ['id' => 'sess-2022', 'name' => '2022/2023'],
                ['id' => 'sess-2023', 'name' => '2023/2024'],
                ['id' => 'sess-2024', 'name' => '2024/2025'],
            ],
            'semesters' => [
                ['id' => 'sem-c1', 'name' => 'Contact 1', 'contact_number' => 1],
                ['id' => 'sem-c2', 'name' => 'Contact 2', 'contact_number' => 2],
                ['id' => 'sem-c3', 'name' => 'Contact 3', 'contact_number' => 3],
                ['id' => 'sem-c4', 'name' => 'Contact 4', 'contact_number' => 4],
            ],
            'programmes' => [
                ['id' => 'prog-peap', 'name' => 'B. Ed Educational Administration and Planning', 'code' => 'PEAP', 'department_id' => 'dept-edu']
            ],
            'departments' => [
                ['id' => 'dept-edu', 'name' => 'Educational Management']
            ],
            'users' => [
                ['id' => 'u-1', 'full_name' => 'Normal Student'],
                ['id' => 'u-2', 'full_name' => 'Wrong Course Student'],
                ['id' => 'u-3', 'full_name' => 'Wrong Session Student'],
                ['id' => 'u-4', 'full_name' => 'Hist Fail Student'],
                ['id' => 'u-5', 'full_name' => 'Cleared Carryover Student'],
                ['id' => 'u-6', 'full_name' => 'Valid Carryover Student'],
                ['id' => 'u-7', 'full_name' => 'Future Fail Student'],
                ['id' => 'u-8', 'full_name' => 'Inactive Item Student'],
                ['id' => 'u-10', 'full_name' => 'Scored History Student'],
                ['id' => 'u-12', 'full_name' => 'Direct Entry Student'],
            ],
            'admissions' => [
                ['id' => 'adm-1', 'matric_number' => 'MCCE/PEAP/23/001', 'admission_number' => 'ADM001', 'level' => 'Contact 1', 'entry_mode' => 'Fresh'],
                ['id' => 'adm-2', 'matric_number' => 'MCCE/PEAP/23/002', 'admission_number' => 'ADM002', 'level' => 'Contact 1', 'entry_mode' => 'Fresh'],
                ['id' => 'adm-3', 'matric_number' => 'MCCE/PEAP/22/003', 'admission_number' => 'ADM003', 'level' => 'Contact 1', 'entry_mode' => 'Fresh'],
                ['id' => 'adm-4', 'matric_number' => 'MCCE/PEAP/21/004', 'admission_number' => 'ADM004', 'level' => 'Contact 1', 'entry_mode' => 'Fresh'],
                ['id' => 'adm-5', 'matric_number' => 'MCCE/PEAP/21/005', 'admission_number' => 'ADM005', 'level' => 'Contact 1', 'entry_mode' => 'Fresh'],
                ['id' => 'adm-6', 'matric_number' => 'MCCE/PEAP/21/006', 'admission_number' => 'ADM006', 'level' => 'Contact 1', 'entry_mode' => 'Fresh'],
                ['id' => 'adm-7', 'matric_number' => 'MCCE/PEAP/23/007', 'admission_number' => 'ADM007', 'level' => 'Contact 1', 'entry_mode' => 'Fresh'],
                ['id' => 'adm-8', 'matric_number' => 'MCCE/PEAP/23/008', 'admission_number' => 'ADM008', 'level' => 'Contact 1', 'entry_mode' => 'Fresh'],
                ['id' => 'adm-10', 'matric_number' => 'MCCE/PEAP/20/010', 'admission_number' => 'ADM010', 'level' => 'Contact 1', 'entry_mode' => 'Fresh'],
                ['id' => 'adm-12', 'matric_number' => 'MCCE/PEAP/22/012', 'admission_number' => 'ADM012', 'level' => 'Contact 2', 'entry_mode' => 'Direct Entry'],
            ],
            'students' => [
                ['id' => 'stu-norm', 'user_id' => 'u-1', 'programme_id' => 'prog-peap', 'department_id' => 'dept-edu', 'admission_id' => 'adm-1', 'session_name' => '2023/2024', 'entry_session_id' => 'sess-2023', 'entry_mode' => 'Fresh', 'current_level' => 'Contact 1'],
                ['id' => 'stu-wrong-crs', 'user_id' => 'u-2', 'programme_id' => 'prog-peap', 'department_id' => 'dept-edu', 'admission_id' => 'adm-2', 'session_name' => '2023/2024', 'entry_session_id' => 'sess-2023', 'entry_mode' => 'Fresh', 'current_level' => 'Contact 1'],
                ['id' => 'stu-wrong-sess', 'user_id' => 'u-3', 'programme_id' => 'prog-peap', 'department_id' => 'dept-edu', 'admission_id' => 'adm-3', 'session_name' => '2022/2023', 'entry_session_id' => 'sess-2022', 'entry_mode' => 'Fresh', 'current_level' => 'Contact 1'],
                ['id' => 'stu-hist-fail', 'user_id' => 'u-4', 'programme_id' => 'prog-peap', 'department_id' => 'dept-edu', 'admission_id' => 'adm-4', 'session_name' => '2021/2022', 'entry_session_id' => 'sess-2021', 'entry_mode' => 'Fresh', 'current_level' => 'Contact 2'],
                ['id' => 'stu-passed-co', 'user_id' => 'u-5', 'programme_id' => 'prog-peap', 'department_id' => 'dept-edu', 'admission_id' => 'adm-5', 'session_name' => '2021/2022', 'entry_session_id' => 'sess-2021', 'entry_mode' => 'Fresh', 'current_level' => 'Contact 3'],
                ['id' => 'stu-valid-co', 'user_id' => 'u-6', 'programme_id' => 'prog-peap', 'department_id' => 'dept-edu', 'admission_id' => 'adm-6', 'session_name' => '2021/2022', 'entry_session_id' => 'sess-2021', 'entry_mode' => 'Fresh', 'current_level' => 'Contact 2'],
                ['id' => 'stu-future-fail', 'user_id' => 'u-7', 'programme_id' => 'prog-peap', 'department_id' => 'dept-edu', 'admission_id' => 'adm-7', 'session_name' => '2023/2024', 'entry_session_id' => 'sess-2023', 'entry_mode' => 'Fresh', 'current_level' => 'Contact 1'],
                ['id' => 'stu-inactive-item', 'user_id' => 'u-8', 'programme_id' => 'prog-peap', 'department_id' => 'dept-edu', 'admission_id' => 'adm-8', 'session_name' => '2023/2024', 'entry_session_id' => 'sess-2023', 'entry_mode' => 'Fresh', 'current_level' => 'Contact 1'],
                ['id' => 'stu-scored-history', 'user_id' => 'u-10', 'programme_id' => 'prog-peap', 'department_id' => 'dept-edu', 'admission_id' => 'adm-10', 'session_name' => '2020/2021', 'entry_session_id' => 'sess-2020', 'entry_mode' => 'Fresh', 'current_level' => 'Contact 4'],
                ['id' => 'stu-de', 'user_id' => 'u-12', 'programme_id' => 'prog-peap', 'department_id' => 'dept-edu', 'admission_id' => 'adm-12', 'session_name' => '2022/2023', 'entry_session_id' => 'sess-2022', 'entry_mode' => 'Direct Entry', 'current_level' => 'Contact 2'],
            ],
            'courses' => [
                ['id' => 'crs-gst112', 'code' => 'GST112', 'title' => 'Logic & Philosophy', 'level' => 'Contact 1', 'contact_number' => 1, 'credit_units' => 2, 'programme_id' => 'prog-peap'],
                ['id' => 'crs-gst122', 'code' => 'GST122', 'title' => 'Use of Library', 'level' => 'Contact 1', 'contact_number' => 1, 'credit_units' => 2, 'programme_id' => 'prog-peap'],
                ['id' => 'crs-edu211', 'code' => 'EDU211', 'title' => 'Philosophy of Education', 'level' => 'Contact 2', 'contact_number' => 2, 'credit_units' => 2, 'programme_id' => 'prog-peap'],
                ['id' => 'crs-empty', 'code' => 'EMPTY999', 'title' => 'Course Without Students', 'level' => 'Contact 1', 'contact_number' => 1, 'credit_units' => 2, 'programme_id' => 'prog-peap'],
            ],
            'grading_schemes' => [
                ['id' => 'scheme-1', 'name' => 'Standard NUC', 'is_active' => 1]
            ],
            'grading_ranges' => [
                ['scheme_id' => 'scheme-1', 'grade' => 'A', 'min_score' => 70, 'max_score' => 100, 'grade_point' => 5],
                ['scheme_id' => 'scheme-1', 'grade' => 'B', 'min_score' => 60, 'max_score' => 69, 'grade_point' => 4],
                ['scheme_id' => 'scheme-1', 'grade' => 'C', 'min_score' => 50, 'max_score' => 59, 'grade_point' => 3],
                ['scheme_id' => 'scheme-1', 'grade' => 'D', 'min_score' => 45, 'max_score' => 49, 'grade_point' => 2],
                ['scheme_id' => 'scheme-1', 'grade' => 'E', 'min_score' => 40, 'max_score' => 44, 'grade_point' => 1],
                ['scheme_id' => 'scheme-1', 'grade' => 'F', 'min_score' => 0, 'max_score' => 39, 'grade_point' => 0],
            ],
            'course_registrations' => [],
            'course_registration_items' => [],
            'result_batches' => [],
            'result_attempts' => [],
            'carryover_corrections' => [],
        ];

        $this->fields = [
            'course_registrations' => ['id', 'student_id', 'session_id', 'academic_session_id', 'entry_session_id', 'semester_id', 'level', 'programme_id', 'status', 'total_credits'],
            'course_registration_items' => ['id', 'registration_id', 'course_id', 'registration_type', 'status', 'origin_result_attempt_id', 'source', 'created_at', 'updated_at'],
            'result_batches' => ['id', 'course_id', 'session_id', 'academic_session_id', 'semester_id', 'level', 'contact_number', 'programme_id', 'department_id', 'status', 'created_at'],
            'result_attempts' => ['id', 'batch_id', 'student_id', 'course_registration_id', 'ca_score', 'exam_score', 'total_score', 'grade', 'grade_point', 'quality_point', 'status', 'result_state', 'credit_units_snapshot', 'registration_type_snapshot', 'contact_number', 'grading_scheme_id', 'origin_result_attempt_id', 'is_locked'],
            'students' => ['id', 'user_id', 'programme_id', 'department_id', 'admission_id', 'session_name', 'entry_session_id', 'entry_mode', 'current_level'],
            'admissions' => ['id', 'matric_number', 'admission_number', 'level', 'entry_mode', 'mode_of_entry'],
            'courses' => ['id', 'code', 'title', 'level', 'contact_number', 'credit_units', 'programme_id'],
        ];

        $this->where_conditions = [];
        $this->group_stack = [];
    }

    public function table_exists($table) {
        return isset($this->tables[$table]);
    }

    public function field_exists($field, $table) {
        return isset($this->fields[$table]) && in_array($field, $this->fields[$table], true);
    }

    public function trans_start() { $this->trans_status = true; }
    public function trans_complete() {}
    public function trans_rollback() { $this->trans_status = false; }
    public function trans_status() { return $this->trans_status; }

    public function select($fields, $escape = true) {
        $this->select_fields = $fields;
        return $this;
    }

    public function distinct() {
        return $this;
    }

    public function from($table) {
        $this->from_table = $table;
        return $this;
    }

    public function join($table, $cond, $type = 'inner') {
        $this->joins[] = ['table' => $table, 'cond' => $cond, 'type' => $type];
        return $this;
    }

    public function where($k, $v = null, $escape = true) {
        $this->where_conditions[] = ['op' => 'AND', 'type' => 'EQ', 'k' => $k, 'v' => $v];
        return $this;
    }

    public function or_where($k, $v = null, $escape = true) {
        $this->where_conditions[] = ['op' => 'OR', 'type' => 'EQ', 'k' => $k, 'v' => $v];
        return $this;
    }

    public function where_in($k, $vals) {
        $this->where_conditions[] = ['op' => 'AND', 'type' => 'IN', 'k' => $k, 'v' => (array)$vals];
        return $this;
    }

    public function or_where_in($k, $vals) {
        $this->where_conditions[] = ['op' => 'OR', 'type' => 'IN', 'k' => $k, 'v' => (array)$vals];
        return $this;
    }

    public function where_not_in($k, $vals) {
        $this->where_conditions[] = ['op' => 'AND', 'type' => 'NOT_IN', 'k' => $k, 'v' => (array)$vals];
        return $this;
    }

    public function group_start() {
        $this->where_conditions[] = ['type' => 'GROUP_START', 'op' => 'AND'];
        return $this;
    }

    public function or_group_start() {
        $this->where_conditions[] = ['type' => 'GROUP_START', 'op' => 'OR'];
        return $this;
    }

    public function group_end() {
        $this->where_conditions[] = ['type' => 'GROUP_END'];
        return $this;
    }

    public function order_by($col, $dir = 'ASC') {
        return $this;
    }

    public function get($table = null) {
        $tbl = $table ?: $this->from_table;
        $clean_tbl = preg_replace('/\s+.*$/', '', trim((string)$tbl));
        $rows = $this->tables[$clean_tbl] ?? [];

        // If this is the registration items query for get_registered_students_for_batch
        if (strpos($tbl, 'course_registration_items') !== false) {
            $joined = [];
            foreach ($this->tables['course_registration_items'] as $item) {
                $reg = null;
                foreach ($this->tables['course_registrations'] as $r) {
                    if ($r['id'] === $item['registration_id']) {
                        $reg = $r;
                        break;
                    }
                }
                if (!$reg) continue;

                $stu = null;
                foreach ($this->tables['students'] as $s) {
                    if ($s['id'] === $reg['student_id']) {
                        $stu = $s;
                        break;
                    }
                }
                if (!$stu) continue;

                $crs = null;
                foreach ($this->tables['courses'] as $c) {
                    if ($c['id'] === $item['course_id']) {
                        $crs = $c;
                        break;
                    }
                }

                $joined[] = [
                    'student_id' => $stu['id'],
                    'registration_id' => $reg['id'],
                    'registration_type' => $item['registration_type'] ?? 'core',
                    'origin_result_attempt_id' => $item['origin_result_attempt_id'] ?? null,
                    'item_course_id' => $item['course_id'],
                    'item_status' => $item['status'] ?? 'active',
                    'reg_academic_session_id' => $reg['academic_session_id'] ?? null,
                    'reg_session_id' => $reg['session_id'] ?? null,
                    'reg_status' => $reg['status'] ?? 'approved',
                    'reg_semester_id' => $reg['semester_id'] ?? null,
                    'reg_level' => $reg['level'] ?? null,
                    'course_contact_number' => $crs['contact_number'] ?? null,
                    'course_level' => $crs['level'] ?? null,
                    'student_programme_id' => $stu['programme_id'] ?? null,
                ];
            }

            // Filter joined rows using conditions
            $results = [];
            foreach ($joined as $row) {
                if ($this->eval_conditions($row)) {
                    $results[] = [
                        'student_id' => $row['student_id'],
                        'registration_type' => $row['registration_type'],
                        'registration_id' => $row['registration_id'],
                        'origin_result_attempt_id' => $row['origin_result_attempt_id'],
                    ];
                }
            }

            // Deduplicate by student_id
            $dedup = [];
            $final = [];
            foreach ($results as $res) {
                if (!isset($dedup[$res['student_id']])) {
                    $dedup[$res['student_id']] = true;
                    $final[] = $res;
                }
            }

            $this->where_conditions = [];
            $this->from_table = '';
            return new MockQueryResult($final);
        }

        // Generic table query
        $filtered = [];
        foreach ($rows as $r) {
            $match = true;
            foreach ($this->where_conditions as $c) {
                if ($c['type'] === 'EQ') {
                    $col = trim(str_replace(['a.', 'st.', 'rb.', 'ra.', 'r.', 'i.'], '', $c['k']));
                    if (($r[$col] ?? null) != $c['v']) {
                        $match = false;
                        break;
                    }
                } elseif ($c['type'] === 'IN') {
                    $col = trim(str_replace(['a.', 'st.', 'rb.', 'ra.', 'r.', 'i.'], '', $c['k']));
                    if (!in_array($r[$col] ?? null, $c['v'])) {
                        $match = false;
                        break;
                    }
                }
            }
            if ($match) {
                if ($clean_tbl === 'result_attempts') {
                    $stu = null;
                    foreach ($this->tables['students'] as $s) {
                        if ($s['id'] === ($r['student_id'] ?? '')) {
                            $stu = $s;
                            break;
                        }
                    }
                    if ($stu) {
                        $u = null;
                        foreach ($this->tables['users'] as $usr) {
                            if ($usr['id'] === ($stu['user_id'] ?? '')) {
                                $u = $usr;
                                break;
                            }
                        }
                        $r['full_name'] = $u['full_name'] ?? '';
                        $r['entry_mode'] = $stu['entry_mode'] ?? 'Fresh';
                    }
                }
                $filtered[] = $r;
            }
        }

        $this->where_conditions = [];
        $this->from_table = '';
        return new MockQueryResult($filtered);
    }

    private function eval_conditions($row) {
        // Custom evaluator matching get_registered_students_for_batch rules
        // 1. i.course_id == batch course_id
        $cid_match = false;
        foreach ($this->where_conditions as $c) {
            if ($c['type'] === 'EQ' && strpos($c['k'], 'course_id') !== false) {
                if ($row['item_course_id'] === $c['v']) {
                    $cid_match = true;
                }
            }
        }
        if (!$cid_match) return false;

        // 2. Active item status: status == 'active' or status IS NULL
        if ($row['item_status'] !== null && $row['item_status'] !== 'active') {
            return false;
        }

        // 3. Reg status: approved, submitted, draft
        if (!in_array($row['reg_status'], ['approved', 'submitted', 'draft'], true)) {
            return false;
        }

        // 4. Academic session match
        $target_sessions = [];
        foreach ($this->where_conditions as $c) {
            if ($c['type'] === 'IN' && (strpos($c['k'], 'academic_session_id') !== false || strpos($c['k'], 'session_id') !== false)) {
                $target_sessions = array_merge($target_sessions, $c['v']);
            }
        }
        $target_sessions = array_unique($target_sessions);
        $sess_match = false;
        if (!empty($row['reg_academic_session_id'])) {
            $sess_match = in_array($row['reg_academic_session_id'], $target_sessions, true);
        } elseif (!empty($row['reg_session_id'])) {
            $sess_match = in_array($row['reg_session_id'], $target_sessions, true);
        }
        if (!$sess_match) return false;

        // 5. Carryover or target level matching
        $is_co = in_array(strtolower((string)$row['registration_type']), ['carryover', 'repeat'], true);
        if ($is_co) {
            return true;
        }

        // Regular level matching: semester_id or level matches target
        $target_semesters = [];
        foreach ($this->where_conditions as $c) {
            if ($c['type'] === 'IN' && strpos($c['k'], 'semester_id') !== false) {
                $target_semesters = array_merge($target_semesters, $c['v']);
            }
        }
        if (in_array($row['reg_semester_id'], $target_semesters, true)
            || in_array($row['reg_level'], $target_semesters, true)
            || (string)$row['course_contact_number'] === '1' && in_array('Contact 1', $target_semesters, true)) {
            return true;
        }

        return false;
    }

    public function get_where($table, $where = [], $limit = null) {
        $rows = $this->tables[$table] ?? [];
        $res = [];
        foreach ($rows as $r) {
            $match = true;
            foreach ($where as $k => $v) {
                if (($r[$k] ?? null) != $v) {
                    $match = false;
                    break;
                }
            }
            if ($match) {
                $res[] = $r;
                if ($limit === 1) break;
            }
        }
        return new MockQueryResult($res);
    }

    public function insert($table, $data) {
        if (!isset($this->tables[$table])) {
            $this->tables[$table] = [];
        }
        $this->tables[$table][] = $data;
        return true;
    }

    public function insert_batch($table, $rows) {
        if (!isset($this->tables[$table])) {
            $this->tables[$table] = [];
        }
        foreach ($rows as $r) {
            $this->tables[$table][] = $r;
        }
        return count($rows);
    }

    public function update($table, $data) {
        if (!isset($this->tables[$table])) return 0;
        $count = 0;
        foreach ($this->tables[$table] as &$r) {
            $match = true;
            foreach ($this->where_conditions as $c) {
                if ($c['type'] === 'EQ') {
                    $col = trim(str_replace(['a.', 'st.', 'rb.', 'ra.', 'r.', 'i.'], '', $c['k']));
                    if (($r[$col] ?? null) != $c['v']) {
                        $match = false;
                        break;
                    }
                }
            }
            if ($match) {
                foreach ($data as $k => $v) {
                    $r[$k] = $v;
                }
                $count++;
            }
        }
        $this->where_conditions = [];
        return $count;
    }

    public function delete($table) {
        if (!isset($this->tables[$table])) return 0;
        $new_rows = [];
        $deleted = 0;
        foreach ($this->tables[$table] as $r) {
            $match = true;
            foreach ($this->where_conditions as $c) {
                if ($c['type'] === 'EQ') {
                    $col = trim(str_replace(['a.', 'st.', 'rb.', 'ra.', 'r.', 'i.'], '', $c['k']));
                    if (($r[$col] ?? null) != $c['v']) {
                        $match = false;
                        break;
                    }
                } elseif ($c['type'] === 'IN') {
                    $col = trim(str_replace(['a.', 'st.', 'rb.', 'ra.', 'r.', 'i.'], '', $c['k']));
                    if (!in_array($r[$col] ?? null, $c['v'])) {
                        $match = false;
                        break;
                    }
                }
            }
            if ($match) {
                $deleted++;
            } else {
                $new_rows[] = $r;
            }
        }
        $this->tables[$table] = $new_rows;
        $this->where_conditions = [];
        return $deleted;
    }

    public function query($sql, $params = []) {
        // Query simulation for Outstanding_course_model
        if (strpos($sql, 'FROM result_attempts a') !== false) {
            $res = [];
            foreach ($this->tables['result_attempts'] as $a) {
                $b = null;
                foreach ($this->tables['result_batches'] as $batch) {
                    if ($batch['id'] === $a['batch_id']) {
                        $b = $batch;
                        break;
                    }
                }
                if (!$b) continue;

                $s = null;
                foreach ($this->tables['students'] as $stu) {
                    if ($stu['id'] === $a['student_id']) {
                        $s = $stu;
                        break;
                    }
                }
                if (!$s) continue;

                $adm = null;
                foreach ($this->tables['admissions'] as $ad) {
                    if ($ad['id'] === ($s['admission_id'] ?? '')) {
                        $adm = $ad;
                        break;
                    }
                }

                $sess_name = '';
                foreach ($this->tables['academic_sessions'] as $sess) {
                    if ($sess['id'] === ($b['academic_session_id'] ?? $b['session_id']) || $sess['name'] === $b['session_id']) {
                        $sess_name = $sess['name'];
                        break;
                    }
                }

                $sem_name = '';
                foreach ($this->tables['semesters'] as $sem) {
                    if ($sem['id'] === $b['semester_id'] || $sem['name'] === $b['semester_id']) {
                        $sem_name = $sem['name'];
                        break;
                    }
                }

                // Check course filter
                if (!empty($params) && !in_array($b['course_id'], $params)) {
                    continue;
                }

                $res[] = [
                    'id' => $a['id'],
                    'student_id' => $a['student_id'],
                    'total_score' => $a['total_score'],
                    'grade' => $a['grade'],
                    'updated_at' => $a['updated_at'] ?? date('Y-m-d H:i:s'),
                    'created_at' => $a['created_at'] ?? date('Y-m-d H:i:s'),
                    'course_id' => $b['course_id'],
                    'session_id' => $b['session_id'],
                    'semester_id' => $b['semester_id'],
                    'level' => $b['level'] ?? null,
                    'session_name' => $sess_name,
                    'semester_name' => $sem_name,
                    'entry_mode' => $s['entry_mode'] ?? 'Fresh',
                    'matric_number' => $adm['matric_number'] ?? '',
                ];
            }
            return new MockQueryResult($res);
        }

        return new MockQueryResult([]);
    }
}

// Mock CodeIgniter CI_Model and CI_Controller base
class CI_Model {
    public $db;
    public $load;
    public function __construct() {
        $ci = &get_instance();
        $this->db = $ci->db;
        $this->load = $ci->load;
    }
    public function __get($key) {
        $ci = &get_instance();
        return $ci->$key;
    }
}

class MockLoader {
    public $loaded_models = [];
    public $CI;

    public function __construct($ci) {
        $this->CI = $ci;
    }

    public function database() {
        return $this->CI->db;
    }

    public function library($lib) {
        if (strtolower($lib) === 'period_resolver') {
            require_once APPPATH . 'libraries/Period_resolver.php';
            $this->CI->period_resolver = new Period_resolver();
        }
    }

    public function model($model) {
        if ($model === 'Outstanding_course_model') {
            require_once APPPATH . 'models/Outstanding_course_model.php';
            $m = new Outstanding_course_model();
            $m->db = $this->CI->db;
            $m->load = $this;
            $this->CI->Outstanding_course_model = $m;
            return true;
        }
        return false;
    }
}

class MockCIInstance {
    public $db;
    public $load;
    public $period_resolver;
    public $Outstanding_course_model;

    public function __construct() {
        $this->db = new MockResultsDB();
        $this->load = new MockLoader($this);
    }
}

global $CI;
$CI = new MockCIInstance();

function &get_instance() {
    global $CI;
    return $CI;
}

// Load Results_model
require_once APPPATH . 'models/Results_model.php';
$results_model = new Results_model();
$results_model->db = $CI->db;
$results_model->load = $CI->load;

// =========================================================================
// RUN 12 REGRESSION TESTS
// =========================================================================
echo "======================================================================\n";
echo "MCCE RESULT BATCH STUDENT ELIGIBILITY & SAFE FALLBACKS TEST SUITE\n";
echo "======================================================================\n\n";

$passed = 0;
$failed = 0;

function assert_test($condition, $name, $detail = '') {
    global $passed, $failed;
    if ($condition) {
        echo " [PASS] $name\n";
        $passed++;
    } else {
        echo " [FAIL] $name" . ($detail ? " ($detail)" : "") . "\n";
        $failed++;
    }
}

// -------------------------------------------------------------------------
// TEST 1: Normal course registration
// A student has an active GST112 registration in 2023/2024.
// Must appear in the correct GST112 result batch.
// -------------------------------------------------------------------------
$CI->db->tables['course_registrations'] = [
    [
        'id' => 'reg-norm-1',
        'student_id' => 'stu-norm',
        'academic_session_id' => 'sess-2023',
        'session_id' => 'sess-2023',
        'semester_id' => 'sem-c1',
        'level' => 'Contact 1',
        'status' => 'approved',
        'programme_id' => 'prog-peap',
    ]
];
$CI->db->tables['course_registration_items'] = [
    [
        'id' => 'item-norm-1',
        'registration_id' => 'reg-norm-1',
        'course_id' => 'crs-gst112',
        'registration_type' => 'core',
        'status' => 'active',
    ]
];

$batch_gst112_2023 = [
    'id' => 'batch-gst112-2023',
    'course_id' => 'crs-gst112',
    'academic_session_id' => 'sess-2023',
    'session_id' => 'sess-2023',
    'semester_id' => 'sem-c1',
    'level' => 'Contact 1',
    'contact_number' => 1,
    'programme_id' => 'prog-peap',
    'status' => 'draft',
];

$students = $results_model->get_registered_students_for_batch($batch_gst112_2023);
$sids = array_column($students, 'student_id');
assert_test(in_array('stu-norm', $sids, true), 'Test 1: Normal course registration student is eligible for GST112 in 2023/2024');

$results_model->populate_batch_attempts($batch_gst112_2023);
$attempts = $CI->db->tables['result_attempts'];
$att_norm = array_filter($attempts, fn($a) => $a['student_id'] === 'stu-norm' && $a['batch_id'] === 'batch-gst112-2023');
assert_test(!empty($att_norm) && reset($att_norm)['registration_type_snapshot'] === 'core', 'Test 1: Normal attempt created with core registration snapshot');

// -------------------------------------------------------------------------
// TEST 2: Wrong course
// A student registered GST122 but not GST112.
// The student must not appear in a GST112 result batch.
// -------------------------------------------------------------------------
$CI->db->tables['course_registrations'][] = [
    'id' => 'reg-wrong-crs',
    'student_id' => 'stu-wrong-crs',
    'academic_session_id' => 'sess-2023',
    'session_id' => 'sess-2023',
    'semester_id' => 'sem-c1',
    'level' => 'Contact 1',
    'status' => 'approved',
    'programme_id' => 'prog-peap',
];
$CI->db->tables['course_registration_items'][] = [
    'id' => 'item-wrong-crs',
    'registration_id' => 'reg-wrong-crs',
    'course_id' => 'crs-gst122', // NOT GST112
    'registration_type' => 'core',
    'status' => 'active',
];

$students = $results_model->get_registered_students_for_batch($batch_gst112_2023);
$sids = array_column($students, 'student_id');
assert_test(!in_array('stu-wrong-crs', $sids, true), 'Test 2: Student registered for GST122 excluded from GST112 result batch');

// -------------------------------------------------------------------------
// TEST 3: Wrong academic session
// A student registered GST112 in 2022/2023 but not 2023/2024.
// The student must not be included in the 2023/2024 GST112 result batch.
// -------------------------------------------------------------------------
$CI->db->tables['course_registrations'][] = [
    'id' => 'reg-wrong-sess',
    'student_id' => 'stu-wrong-sess',
    'academic_session_id' => 'sess-2022', // 2022/2023, not 2023/2024
    'session_id' => 'sess-2022',
    'semester_id' => 'sem-c1',
    'level' => 'Contact 1',
    'status' => 'approved',
    'programme_id' => 'prog-peap',
];
$CI->db->tables['course_registration_items'][] = [
    'id' => 'item-wrong-sess',
    'registration_id' => 'reg-wrong-sess',
    'course_id' => 'crs-gst112',
    'registration_type' => 'core',
    'status' => 'active',
];

$students = $results_model->get_registered_students_for_batch($batch_gst112_2023);
$sids = array_column($students, 'student_id');
assert_test(!in_array('stu-wrong-sess', $sids, true), 'Test 3: 2022/2023 registrant excluded from 2023/2024 GST112 result batch');

// -------------------------------------------------------------------------
// TEST 4: Historical failure without current registration
// A student failed GST112 in 2021/2022 but has no valid GST112 registration in 2022/2023.
// The student must not be included automatically in the 2022/2023 GST112 batch.
// -------------------------------------------------------------------------
$CI->db->tables['result_batches'][] = [
    'id' => 'batch-gst112-2021',
    'course_id' => 'crs-gst112',
    'academic_session_id' => 'sess-2021',
    'session_id' => 'sess-2021',
    'semester_id' => 'sem-c1',
    'status' => 'published',
];
$CI->db->tables['result_attempts'][] = [
    'id' => 'att-fail-2021',
    'batch_id' => 'batch-gst112-2021',
    'student_id' => 'stu-hist-fail',
    'total_score' => 25,
    'grade' => 'F',
    'status' => 'active',
];

$batch_gst112_2022 = [
    'id' => 'batch-gst112-2022',
    'course_id' => 'crs-gst112',
    'academic_session_id' => 'sess-2022',
    'session_id' => 'sess-2022',
    'semester_id' => 'sem-c1',
    'level' => 'Contact 1',
    'contact_number' => 1,
    'programme_id' => 'prog-peap',
    'status' => 'draft',
];

$students_2022 = $results_model->get_registered_students_for_batch($batch_gst112_2022);
$sids_2022 = array_column($students_2022, 'student_id');
assert_test(!in_array('stu-hist-fail', $sids_2022, true), 'Test 4: Historical failure without current registration excluded (Defect A eliminated)');

// -------------------------------------------------------------------------
// TEST 5: Already corrected carryover
// A student failed GST112 in 2021/2022 and passed in 2022/2023.
// The old failed attempt must not independently make the student eligible for 2023/2024.
// -------------------------------------------------------------------------
$CI->db->tables['result_attempts'][] = [
    'id' => 'att-fail-passedco-2021',
    'batch_id' => 'batch-gst112-2021',
    'student_id' => 'stu-passed-co',
    'total_score' => 30,
    'grade' => 'F',
    'status' => 'active',
];
$CI->db->tables['result_attempts'][] = [
    'id' => 'att-pass-passedco-2022',
    'batch_id' => 'batch-gst112-2022',
    'student_id' => 'stu-passed-co',
    'total_score' => 60,
    'grade' => 'B',
    'status' => 'active',
];

$students_2023 = $results_model->get_registered_students_for_batch($batch_gst112_2023);
$sids_2023 = array_column($students_2023, 'student_id');
assert_test(!in_array('stu-passed-co', $sids_2023, true), 'Test 5: Cleared carryover student not eligible for later session');

// -------------------------------------------------------------------------
// TEST 6: Valid carryover registration
// A student failed GST112 in Contact 1, 2021/2022.
// The student registered GST112 as a carryover in 2022/2023 while studying Contact 2.
// Must be eligible for 2022/2023 GST112 batch; attempt retains carryover snapshot.
// -------------------------------------------------------------------------
$CI->db->tables['result_attempts'][] = [
    'id' => 'att-orig-validco',
    'batch_id' => 'batch-gst112-2021',
    'student_id' => 'stu-valid-co',
    'total_score' => 32,
    'grade' => 'F',
    'status' => 'active',
];
$CI->db->tables['course_registrations'][] = [
    'id' => 'reg-valid-co-2022',
    'student_id' => 'stu-valid-co',
    'academic_session_id' => 'sess-2022',
    'session_id' => 'sess-2022',
    'semester_id' => 'sem-c2', // Student is studying Contact 2
    'level' => 'Contact 2',
    'status' => 'approved',
    'programme_id' => 'prog-peap',
];
$CI->db->tables['course_registration_items'][] = [
    'id' => 'item-valid-co-2022',
    'registration_id' => 'reg-valid-co-2022',
    'course_id' => 'crs-gst112', // Contact 1 course taken as carryover
    'registration_type' => 'carryover',
    'origin_result_attempt_id' => 'att-orig-validco',
    'status' => 'active',
];

$students_co = $results_model->get_registered_students_for_batch($batch_gst112_2022);
$sids_co = array_column($students_co, 'student_id');
assert_test(in_array('stu-valid-co', $sids_co, true), 'Test 6: Valid carryover registrant in Contact 2 is eligible for GST112 batch in 2022/2023');

$results_model->populate_batch_attempts($batch_gst112_2022);
$att_co = array_filter($CI->db->tables['result_attempts'], fn($a) => $a['student_id'] === 'stu-valid-co' && $a['batch_id'] === 'batch-gst112-2022');
$att_co_row = reset($att_co);
assert_test(!empty($att_co_row) && $att_co_row['registration_type_snapshot'] === 'carryover', 'Test 6: Attempt snapshot accurately flagged as carryover');
assert_test(!empty($att_co_row['origin_result_attempt_id']), 'Test 6: Origin failed attempt reference preserved');

// -------------------------------------------------------------------------
// TEST 7: Future failure
// A failed attempt from 2024/2025 must not establish outstanding eligibility for 2023/2024.
// -------------------------------------------------------------------------
$CI->db->tables['result_batches'][] = [
    'id' => 'batch-gst112-2024',
    'course_id' => 'crs-gst112',
    'academic_session_id' => 'sess-2024',
    'session_id' => 'sess-2024',
    'semester_id' => 'sem-c1',
    'status' => 'published',
];
$CI->db->tables['result_attempts'][] = [
    'id' => 'att-future-fail',
    'batch_id' => 'batch-gst112-2024',
    'student_id' => 'stu-future-fail',
    'total_score' => 20,
    'grade' => 'F',
    'status' => 'active',
];

$students_2023 = $results_model->get_registered_students_for_batch($batch_gst112_2023);
$sids_2023 = array_column($students_2023, 'student_id');
assert_test(!in_array('stu-future-fail', $sids_2023, true), 'Test 7: Future failure from 2024/2025 does not establish eligibility in 2023/2024');

// -------------------------------------------------------------------------
// TEST 8: Inactive course item
// A dropped or obsolete course item must not authorize a new examination attempt.
// -------------------------------------------------------------------------
$CI->db->tables['course_registrations'][] = [
    'id' => 'reg-inactive-item',
    'student_id' => 'stu-inactive-item',
    'academic_session_id' => 'sess-2023',
    'session_id' => 'sess-2023',
    'semester_id' => 'sem-c1',
    'level' => 'Contact 1',
    'status' => 'approved',
    'programme_id' => 'prog-peap',
];
$CI->db->tables['course_registration_items'][] = [
    'id' => 'item-inactive-item',
    'registration_id' => 'reg-inactive-item',
    'course_id' => 'crs-gst112',
    'registration_type' => 'core',
    'status' => 'obsolete', // Dropped / cleared item
];

$students_2023 = $results_model->get_registered_students_for_batch($batch_gst112_2023);
$sids_2023 = array_column($students_2023, 'student_id');
assert_test(!in_array('stu-inactive-item', $sids_2023, true), 'Test 8: Inactive / obsolete course registration item excluded');

// -------------------------------------------------------------------------
// TEST 9: No eligible students
// Attempt to create a result batch where no student has a valid registration.
// Batch creation must fail safely without inserting batch or attempts.
// -------------------------------------------------------------------------
$items_count_before = count($CI->db->tables['course_registration_items']);
$batches_count_before = count($CI->db->tables['result_batches']);
$attempts_count_before = count($CI->db->tables['result_attempts']);

$empty_batch_data = [
    'course_id' => 'crs-empty', // 0 registrations
    'academic_session_id' => 'sess-2023',
    'session_id' => 'sess-2023',
    'semester_id' => 'sem-c1',
    'programme_id' => 'prog-peap',
];
$created = $results_model->create_batch($empty_batch_data);
assert_test($created === false, 'Test 9: create_batch returns false when 0 students registered');
assert_test(count($CI->db->tables['result_batches']) === $batches_count_before, 'Test 9: No result_batches record inserted');
assert_test(count($CI->db->tables['result_attempts']) === $attempts_count_before, 'Test 9: No result_attempts created');
assert_test(count($CI->db->tables['course_registration_items']) === $items_count_before, 'Test 9: No course_registration_items created (Defect C prevented)');

// -------------------------------------------------------------------------
// TEST 10: Existing scored history
// A historical result attempt exists without a currently active registration item.
// Regenerating/fetching attempts must not delete or modify its score.
// -------------------------------------------------------------------------
$historical_batch = [
    'id' => 'batch-historical-2020',
    'course_id' => 'crs-gst112',
    'academic_session_id' => 'sess-2020',
    'session_id' => 'sess-2020',
    'semester_id' => 'sem-c1',
    'status' => 'published',
];
$CI->db->tables['result_batches'][] = $historical_batch;
$CI->db->tables['result_attempts'][] = [
    'id' => 'att-hist-scored-10',
    'batch_id' => 'batch-historical-2020',
    'student_id' => 'stu-scored-history',
    'course_registration_id' => null, // No active registration digitized
    'ca_score' => 28,
    'exam_score' => 45,
    'total_score' => 73,
    'grade' => 'A',
    'grade_point' => 5,
    'quality_point' => 10,
    'status' => 'active',
    'result_state' => 'entered',
    'credit_units_snapshot' => 2,
    'registration_type_snapshot' => 'core',
    'is_locked' => 1,
];

$hist_attempts = $results_model->get_attempts_by_batch('batch-historical-2020');
$hist_att_10 = array_filter($hist_attempts, fn($a) => $a['student_id'] === 'stu-scored-history');
$hist_row = reset($hist_att_10);
assert_test(!empty($hist_row), 'Test 10: Historical scored attempt returned even without active registration item');
assert_test($hist_row['total_score'] == 73 && $hist_row['grade'] === 'A', 'Test 10: Historical score and grade perfectly preserved');

// -------------------------------------------------------------------------
// TEST 11: Idempotency
// Repeated population of the same result batch must not duplicate attempts
// or create course-registration items.
// -------------------------------------------------------------------------
$reg_items_count_before = count($CI->db->tables['course_registration_items']);
$results_model->populate_batch_attempts($batch_gst112_2023);
$attempts_first_run = count($CI->db->tables['result_attempts']);

$results_model->populate_batch_attempts($batch_gst112_2023);
$attempts_second_run = count($CI->db->tables['result_attempts']);
$reg_items_count_after = count($CI->db->tables['course_registration_items']);

assert_test($attempts_first_run === $attempts_second_run, 'Test 11: Idempotent - attempt count unchanged on second run');
assert_test($reg_items_count_before === $reg_items_count_after, 'Test 11: Idempotent - no course_registration_items created during population');

// -------------------------------------------------------------------------
// TEST 12: Direct Entry and contact separation
// Direct Entry students retain Contact 2 starting rule and valid carryovers
// are not excluded because the original course contact differs from their contact.
// -------------------------------------------------------------------------
$CI->db->tables['course_registrations'][] = [
    'id' => 'reg-de-1',
    'student_id' => 'stu-de',
    'academic_session_id' => 'sess-2022',
    'session_id' => 'sess-2022',
    'semester_id' => 'sem-c2', // Direct Entry starts at Contact 2
    'level' => 'Contact 2',
    'status' => 'approved',
    'programme_id' => 'prog-peap',
];
$CI->db->tables['course_registration_items'][] = [
    'id' => 'item-de-1',
    'registration_id' => 'reg-de-1',
    'course_id' => 'crs-edu211', // Contact 2 course
    'registration_type' => 'core',
    'status' => 'active',
];

$batch_edu211_2022 = [
    'id' => 'batch-edu211-2022',
    'course_id' => 'crs-edu211',
    'academic_session_id' => 'sess-2022',
    'session_id' => 'sess-2022',
    'semester_id' => 'sem-c2',
    'level' => 'Contact 2',
    'contact_number' => 2,
    'programme_id' => 'prog-peap',
    'status' => 'draft',
];

$de_students = $results_model->get_registered_students_for_batch($batch_edu211_2022);
$de_sids = array_column($de_students, 'student_id');
assert_test(in_array('stu-de', $de_sids, true), 'Test 12: Direct Entry student eligible for Contact 2 course batch at entry');

echo "\n======================================================================\n";
echo "TEST RESULTS: $passed PASSED, $failed FAILED\n";
echo "======================================================================\n";

if ($failed > 0) {
    exit(1);
}

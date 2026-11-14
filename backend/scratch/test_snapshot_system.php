<?php
/**
 * Test Harness for Broadsheet Snapshot & Progression System
 * Validates:
 * 1. Scope canonicalization (stable SHA-256 hash, ignores presentation filters)
 * 2. resolve_or_create initial generation & subsequent cache hit
 * 3. Multi-contact progression chaining (Contact N previous = Contact N-1 cumulative)
 * 4. Invalidation engine & forward dependency chain invalidation
 * 5. Sign-off governance, approval locking, and approved version immutability (superseding version creation)
 */

define('BASEPATH', 'mock');

// In-memory Mock Database
class MockDB {
    public $tables = [
        'broadsheet_snapshots' => [],
        'broadsheet_snapshot_students' => [],
        'broadsheet_snapshot_invalidations' => [],
        'broadsheet_approvals' => [],
        'broadsheet_audit_log' => [],
        'academic_sessions' => [
            ['id' => 1, 'name' => '2021/2022'],
            ['id' => 2, 'name' => '2022/2023'],
            ['id' => 3, 'name' => '2023/2024'],
        ],
        'semesters' => [
            ['id' => 1, 'name' => 'First Semester', 'contact_number' => 1],
            ['id' => 2, 'name' => 'Second Semester', 'contact_number' => 2],
            ['id' => 3, 'name' => 'Contact 3', 'contact_number' => 3],
            ['id' => 4, 'name' => 'Contact 4', 'contact_number' => 4],
        ],
        'programmes' => [
            ['id' => 1, 'name' => 'B. Ed Educational Administration and Planning', 'code' => 'PEAP', 'department_id' => 1]
        ],
        'users' => [
            ['id' => 1, 'full_name' => 'Dr. HOD', 'username' => 'hod'],
            ['id' => 2, 'full_name' => 'Prof. Dean', 'username' => 'dean'],
        ],
        'result_attempts' => [],
        'carryover_corrections' => [],
        'courses' => [],
    ];

    private $where_clauses = [];
    private $order_clauses = [];
    private $limit_val = null;
    private $select_fields = '*';
    private $from_table = '';
    private $trans_status = true;

    public function table_exists($table) {
        return isset($this->tables[$table]);
    }

    public function trans_start() { $this->trans_status = true; }
    public function trans_complete() {}
    public function trans_rollback() { $this->trans_status = false; }
    public function trans_status() { return $this->trans_status; }

    public function select($fields) {
        $this->select_fields = $fields;
        return $this;
    }

    public function from($table) {
        $this->from_table = $table;
        return $this;
    }

    public function join($table, $cond, $type = 'inner') {
        return $this;
    }

    public function where($k, $v = null) {
        if (is_array($k)) {
            foreach ($k as $subk => $subv) {
                $this->where_clauses[$subk] = $subv;
            }
        } else {
            $this->where_clauses[$k] = $v;
        }
        return $this;
    }

    public function or_where($k, $v = null) {
        return $this;
    }

    public function group_start() {
        return $this;
    }

    public function group_end() {
        return $this;
    }

    public function where_in($k, $vals) {
        $this->where_clauses[$k . '__in'] = (array)$vals;
        return $this;
    }

    public function order_by($col, $dir = 'ASC') {
        $this->order_clauses[] = [$col, strtoupper($dir)];
        return $this;
    }

    public function limit($l) {
        $this->limit_val = (int)$l;
        return $this;
    }

    public function get($table = null, $limit = null) {
        $tbl = $table ?: $this->from_table;
        $rows = $this->tables[$tbl] ?? [];
        if ($limit !== null) {
            $this->limit_val = (int)$limit;
        }

        // Apply where filters
        $filtered = [];
        foreach ($rows as $row) {
            $match = true;
            foreach ($this->where_clauses as $k => $v) {
                if (substr($k, -4) === '__in') {
                    $actual_col = substr($k, 0, -4);
                    if (!in_array($row[$actual_col] ?? null, $v)) {
                        $match = false;
                        break;
                    }
                } elseif (strpos($k, ' ') !== false) {
                    list($col, $op) = explode(' ', $k, 2);
                    $row_val = $row[$col] ?? null;
                    if ($op === '<' && !($row_val < $v)) { $match = false; break; }
                    if ($op === '>' && !($row_val > $v)) { $match = false; break; }
                    if ($op === '<=' && !($row_val <= $v)) { $match = false; break; }
                    if ($op === '>=' && !($row_val >= $v)) { $match = false; break; }
                    if ($op === '!=' && !($row_val != $v)) { $match = false; break; }
                } else {
                    if (($row[$k] ?? null) != $v) {
                        $match = false;
                        break;
                    }
                }
            }
            if ($match) {
                $filtered[] = $row;
            }
        }

        // Apply order by
        if (!empty($this->order_clauses)) {
            usort($filtered, function($a, $b) {
                foreach ($this->order_clauses as $ord) {
                    $col = $ord[0];
                    $dir = $ord[1];
                    $va = $a[$col] ?? null;
                    $vb = $b[$col] ?? null;
                    if ($va == $vb) continue;
                    if ($dir === 'DESC') return ($va < $vb) ? 1 : -1;
                    return ($va > $vb) ? 1 : -1;
                }
                return 0;
            });
        }

        if ($this->limit_val !== null) {
            $filtered = array_slice($filtered, 0, $this->limit_val);
        }

        // Reset
        $this->where_clauses = [];
        $this->order_clauses = [];
        $this->limit_val = null;
        $this->select_fields = '*';

        return new MockQueryResult($filtered);
    }

    public function get_where($table, $where = [], $limit = null) {
        $this->where($where);
        if ($limit) $this->limit($limit);
        return $this->get($table);
    }

    public function insert($table, $data) {
        if (!isset($this->tables[$table])) {
            $this->tables[$table] = [];
        }
        $row = $data;
        if (!isset($row['id'])) {
            $row['id'] = count($this->tables[$table]) + 1;
        }
        $this->tables[$table][] = $row;
        return true;
    }

    public function insert_batch($table, $rows) {
        foreach ($rows as $r) {
            $this->insert($table, $r);
        }
        return count($rows);
    }

    public function update($table, $data) {
        if (!isset($this->tables[$table])) return false;
        $count = 0;
        foreach ($this->tables[$table] as &$row) {
            $match = true;
            foreach ($this->where_clauses as $k => $v) {
                if (substr($k, -4) === '__in') {
                    $col = substr($k, 0, -4);
                    if (!in_array($row[$col] ?? null, $v)) { $match = false; break; }
                } elseif (strpos($k, ' ') !== false) {
                    list($col, $op) = explode(' ', $k, 2);
                    $row_val = $row[$col] ?? null;
                    if ($op === '<' && !($row_val < $v)) { $match = false; break; }
                    if ($op === '>' && !($row_val > $v)) { $match = false; break; }
                    if ($op === '<=' && !($row_val <= $v)) { $match = false; break; }
                    if ($op === '>=' && !($row_val >= $v)) { $match = false; break; }
                    if ($op === '!=' && !($row_val != $v)) { $match = false; break; }
                } else {
                    if (($row[$k] ?? null) != $v) { $match = false; break; }
                }
            }
            if ($match) {
                foreach ($data as $dk => $dv) {
                    $row[$dk] = $dv;
                }
                $count++;
            }
        }
        unset($row);
        $this->where_clauses = [];
        return $count > 0;
    }

    public function delete($table) {
        if (!isset($this->tables[$table])) return true;
        $remaining = [];
        foreach ($this->tables[$table] as $row) {
            $match = true;
            foreach ($this->where_clauses as $k => $v) {
                if (($row[$k] ?? null) != $v) {
                    $match = false;
                    break;
                }
            }
            if (!$match) {
                $remaining[] = $row;
            }
        }
        $this->tables[$table] = $remaining;
        $this->where_clauses = [];
        return true;
    }

    public function select_max($col, $alias) {
        $this->select_fields = "MAX({$col}) as {$alias}";
        return $this;
    }

    public function query($sql) {
        if (stripos($sql, 'watermark') !== false || stripos($sql, 'max(') !== false) {
            return new MockQueryResult([['watermark' => date('Y-m-d H:i:s'), 'wm' => date('Y-m-d H:i:s')]]);
        }
        return new MockQueryResult([]);
    }
}

class MockQueryResult {
    private $rows;
    public function __construct($rows) { $this->rows = $rows; }
    public function result_array() { return $this->rows; }
    public function row_array() { return $this->rows[0] ?? null; }
}

// Mock Loader & Libraries
class MockLoader {
    public function model($name) {}
    public function library($name) {}
    public function database() {}
    public function is_loaded($name) { return true; }
}

class MockPeriodResolver {
    public function resolve($sess_id, $sem_id, $lvl = null) {
        $contact_map = [1 => 1, 2 => 2, 3 => 3, 4 => 4];
        $c_num = $contact_map[$sem_id] ?? 1;
        return [
            'contact_number' => $c_num,
            'is_contact_1' => ($c_num === 1),
            'session_name' => "202{$sess_id}/202" . ($sess_id + 1),
            'semester_name' => "Contact {$c_num}",
            'session_ids' => [$sess_id],
            'semester_ids' => [$sem_id],
            'session' => ['id' => $sess_id, 'name' => "202{$sess_id}/202" . ($sess_id + 1)],
            'semester' => ['id' => $sem_id, 'name' => "Contact {$c_num}"]
        ];
    }

    public function resolve_row_contact_number($semester_label, $level_label = null, $semester_id = null) {
        if ($semester_id) return (int)$semester_id;
        if (preg_match('/(?:contact|semester)\s*(\d+)/i', (string)$semester_label, $m)) {
            return (int)$m[1];
        }
        return 1;
    }
}

class MockBroadsheetModel {
    public function generate($session_id, $semester_id, $programme_id, $level = null, $options = []) {
        $contact_map = [1 => 1, 2 => 2, 3 => 3, 4 => 4];
        $contact_num = $contact_map[$semester_id] ?? 1;

        // Sample students
        $students = [
            [
                'student_id' => 101,
                'matric_no' => 'MCCE/PEAP/2021/001',
                'matric_number' => 'MCCE/PEAP/2021/001',
                'full_name' => 'Aliyu Umar',
                'entry_mode' => 'fresh',
            ],
            [
                'student_id' => 102,
                'matric_no' => 'MCCE/PEAP/2021/002',
                'matric_number' => 'MCCE/PEAP/2021/002',
                'full_name' => 'Fatima Bello',
                'entry_mode' => 'fresh',
            ]
        ];

        foreach ($students as &$st) {
            $sid = $st['student_id'];
            $p_snap = $options['previous_snapshot_metrics'][$sid] ?? null;

            if ($p_snap) {
                $p_reg = (int)($p_snap['cum_reg_credits'] ?? $p_snap['registered_credits'] ?? 0);
                $p_earn = (int)($p_snap['cum_earned_credits'] ?? $p_snap['earned_credits'] ?? 0);
                $p_qp = (float)($p_snap['cum_quality_points'] ?? $p_snap['quality_points'] ?? 0);
                $p_cgpa = (float)($p_snap['cum_cgpa'] ?? $p_snap['cgpa'] ?? ($p_reg > 0 ? round($p_qp / $p_reg, 2) : 0));
                $prev_m = [
                    'registered_credits' => $p_reg,
                    'earned_credits' => $p_earn,
                    'quality_points' => $p_qp,
                    'gpa' => number_format($p_cgpa, 2, '.', ''),
                    'cgpa' => number_format($p_cgpa, 2, '.', ''),
                ];
            } else {
                $prev_m = [
                    'registered_credits' => 0,
                    'earned_credits' => 0,
                    'quality_points' => 0.0,
                    'gpa' => '0.00',
                    'cgpa' => '0.00'
                ];
            }

            // Current metrics: 20 units per contact, 70 quality points (GPA 3.50)
            $curr_m = [
                'registered_credits' => 20,
                'earned_credits' => 20,
                'quality_points' => 70.0,
                'gpa' => '3.50',
                'cgpa' => '3.50'
            ];

            // Cumulative additive
            $cum_reg = (int)$prev_m['registered_credits'] + (int)$curr_m['registered_credits'];
            $cum_earn = (int)$prev_m['earned_credits'] + (int)$curr_m['earned_credits'];
            $cum_qp = (float)$prev_m['quality_points'] + (float)$curr_m['quality_points'];
            $cum_cgpa = $cum_reg > 0 ? round($cum_qp / $cum_reg, 2) : 0.0;

            $cum_m = [
                'registered_credits' => $cum_reg,
                'earned_credits' => $cum_earn,
                'quality_points' => $cum_qp,
                'gpa' => number_format($cum_cgpa, 2, '.', ''),
                'cgpa' => number_format($cum_cgpa, 2, '.', '')
            ];

            $st['previous'] = $prev_m;
            $st['current'] = $curr_m;
            $st['cumulative'] = $cum_m;
            $st['academic_standing'] = 'In Good Standing';
            $st['remarks'] = 'Passed';
            $st['is_complete'] = true;
        }
        unset($st);

        return [
            'context' => [
                'session' => ['id' => $session_id, 'name' => "202{$session_id}/202" . ($session_id + 1)],
                'semester' => ['id' => $semester_id, 'name' => "Contact {$contact_num}"],
                'contact_number' => $contact_num,
                'programme' => ['id' => $programme_id, 'name' => 'B. Ed Educational Administration and Planning'],
                'basis' => $options['basis'] ?? 'published',
            ],
            'students' => $students,
            'courses' => [],
            'carryover_courses' => [],
            'summary' => [
                'total_students' => count($students),
                'completeness_percentage' => 100
            ]
        ];
    }
}

if (!class_exists('CI_Model')) {
    class CI_Model {
        public $db;
        public $load;
        public function __construct() {
            $this->load = new MockLoader();
        }
    }
}

// Load Snapshot_model class definition
require_once __DIR__ . '/../application/models/Snapshot_model.php';

// Instantiate Test Runner
class SnapshotSystemTest {
    private $db;
    private $model;

    public function __construct() {
        $this->db = new MockDB();
        $this->model = new Snapshot_model();
        $this->model->db = $this->db;
        $this->model->load = new MockLoader();
        $this->model->period_resolver = new MockPeriodResolver();
        $this->model->Broadsheet_model = new MockBroadsheetModel();
    }

    public function run() {
        echo "========================================================\n";
        echo "Running Broadsheet Snapshot & Progression Test Suite\n";
        echo "========================================================\n\n";

        $this->testScopeCanonicalization();
        $this->testResolveOrCreateAndCacheHit();
        $this->testMultiContactProgressionChaining();
        $this->testInvalidationAndForwardPropagation();
        $this->testSignOffAndImmutability();

        echo "\n========================================================\n";
        echo "ALL SNAPSHOT SYSTEM TESTS PASSED SUCCESSFULLY! (5/5)\n";
        echo "========================================================\n";
    }

    private function assert($condition, $message) {
        if (!$condition) {
            echo "[-] FAILED: {$message}\n";
            exit(1);
        }
        echo "[+] PASSED: {$message}\n";
    }

    public function testScopeCanonicalization() {
        echo "--- 1. Testing Scope Canonicalization ---\n";
        $scopeA = [
            'session_id' => 'sess-uuid-2021',
            'semester_id' => 'fced79f6-dacf-46a2-9756-897ecd090a29',
            'programme_id' => '8732138',
            'level' => 'all',
            'basis' => 'published',
            'cohort' => '2021',
            'entry_mode' => 'all',
            'search' => 'Aliyu',       // presentation filter, should be ignored
            'standing' => 'probation', // presentation filter, should be ignored
            'page' => 2                // presentation filter, should be ignored
        ];

        $scopeB = [
            'entry_mode' => 'all',
            'cohort' => '2021',
            'basis' => 'published',
            'level' => 'all',
            'programme_id' => '8732138',
            'semester_id' => 'fced79f6-dacf-46a2-9756-897ecd090a29',
            'session_id' => 'sess-uuid-2021',
        ];

        $resA = $this->model->canonicalize_scope($scopeA);
        $resB = $this->model->canonicalize_scope($scopeB);

        $hashA = $resA['scope_hash'];
        $hashB = $resB['scope_hash'];

        $this->assert(!empty($hashA) && strlen($hashA) === 64, "Canonical hash produces 64-char SHA-256 with UUID scope");
        $this->assert($hashA === $hashB, "Identical UUID scope produces matching hash regardless of key order & presentation filters");
    }

    public function testResolveOrCreateAndCacheHit() {
        echo "\n--- 2. Testing resolve_or_create (First Request vs Cache Hit) ---\n";
        $scope = [
            'session_id' => 1,
            'semester_id' => 2, // Contact 2
            'programme_id' => 1,
            'level' => 'all',
            'basis' => 'published',
            'cohort' => 'all',
            'entry_mode' => 'all',
        ];

        // 1st request -> generates new snapshot
        $res1 = $this->model->resolve_or_create($scope, ['created_by' => 1]);
        $this->assert($res1['source'] === 'generated', "First request resolves to 'generated'");
        $this->assert(!empty($res1['snapshot']['id']), "Generated snapshot has ID: " . $res1['snapshot']['id']);
        $this->assert($res1['snapshot']['version'] === 1, "Snapshot starts at version 1");
        $this->assert(strpos($res1['snapshot']['verification_code'], 'BRD-') === 0, "Verification code formatted with BRD- prefix: " . $res1['snapshot']['verification_code']);

        // Check normalized broadsheet_snapshot_students
        $saved_students = $this->db->tables['broadsheet_snapshot_students'];
        $this->assert(count($saved_students) === 2, "Normalized broadsheet_snapshot_students populated with 2 students");
        $this->assert($saved_students[0]['cumulative_registered_credits'] === 20, "Student 1 cumulative registered units stored as 20");

        // 2nd request -> cache hit
        $res2 = $this->model->resolve_or_create($scope, ['created_by' => 1]);
        $this->assert($res2['source'] === 'snapshot', "Second request resolves to 'snapshot' (cache hit)");
        $this->assert($res2['snapshot']['id'] === $res1['snapshot']['id'], "Second request returns identical snapshot ID without regeneration");
    }

    public function testMultiContactProgressionChaining() {
        echo "\n--- 3. Testing Multi-Contact Progression Chaining ---\n";
        // Contact 2 was generated in test 2: Student 101 had cumulative 20 TCR, 20 TCE, 70 QP, 3.50 CGPA
        // Now generate Contact 3
        $scopeC3 = [
            'session_id' => 2,
            'semester_id' => 3, // Contact 3
            'programme_id' => 1,
            'level' => 'all',
            'basis' => 'published',
            'cohort' => 'all',
            'entry_mode' => 'all',
        ];

        $resC3 = $this->model->resolve_or_create($scopeC3, ['created_by' => 1]);
        $this->assert($resC3['source'] === 'generated', "Contact 3 snapshot generated");
        $this->assert(!empty($resC3['snapshot']['previous_snapshot_id']), "Contact 3 linked to preceding snapshot ID: " . $resC3['snapshot']['previous_snapshot_id']);

        $st101 = $resC3['broadsheet']['students'][0];
        $this->assert($st101['previous']['registered_credits'] === 20, "Contact 3 Student 101 previous CCR matches Contact 2 cumulative (20)");
        $this->assert($st101['previous']['earned_credits'] === 20, "Contact 3 Student 101 previous CCE matches Contact 2 cumulative (20)");
        $this->assert($st101['previous']['quality_points'] === 70.0, "Contact 3 Student 101 previous CGP matches Contact 2 cumulative (70)");
        $this->assert($st101['previous']['cgpa'] === '3.50', "Contact 3 Student 101 previous CGPA matches Contact 2 cumulative (3.50)");

        // Cumulative additive verification: Previous (20) + Current (20) = Cumulative (40)
        $this->assert($st101['cumulative']['registered_credits'] === 40, "Contact 3 Cumulative TCR is exactly additive: 20 + 20 = 40");
        $this->assert($st101['cumulative']['earned_credits'] === 40, "Contact 3 Cumulative TCE is exactly additive: 20 + 20 = 40");
        $this->assert($st101['cumulative']['quality_points'] === 140.0, "Contact 3 Cumulative QP is exactly additive: 70 + 70 = 140");
        $this->assert($st101['cumulative']['cgpa'] === '3.50', "Contact 3 Cumulative CGPA correctly calculated: 140 / 40 = 3.50");
    }

    public function testInvalidationAndForwardPropagation() {
        echo "\n--- 4. Testing Invalidation Engine & Forward Dependency Traversal ---\n";
        // Modifying Contact 2 results:
        $count = $this->model->invalidate_for_result_change([
            'session_id' => 1,
            'semester_id' => 2,
            'programme_id' => 1
        ], 'score_update', 'CA score amended for EAP211');

        $this->assert($count >= 2, "Invalidation affected Contact 2 snapshot and propagated forward to Contact 3 (Total affected: {$count})");

        // Verify Contact 2 snapshot is marked stale
        $snapC2 = $this->db->tables['broadsheet_snapshots'][0];
        $this->assert(!empty($snapC2['stale_at']), "Contact 2 snapshot marked stale (stale_at populated)");
        $this->assert($snapC2['stale_reason'] === 'score_update', "Contact 2 stale_reason matches trigger reason ('score_update')");

        // Verify Contact 3 snapshot (dependent) is marked stale automatically
        $snapC3 = $this->db->tables['broadsheet_snapshots'][1];
        $this->assert(!empty($snapC3['stale_at']), "Contact 3 dependent snapshot marked stale via forward traversal (stale_at populated)");
        $this->assert($snapC3['stale_reason'] === 'preceding_snapshot_invalidated', "Contact 3 stale_reason reflects dependency chain ('preceding_snapshot_invalidated')");
    }

    public function testSignOffAndImmutability() {
        echo "\n--- 5. Testing Sign-Off Governance, Lock, and Approved Immutability ---\n";
        // Stale snapshot approval must be blocked
        $snapC2 = $this->db->tables['broadsheet_snapshots'][0];
        $blockRes = $this->model->sign_off($snapC2['id'], 'hod', 1, 'approve', 'Approved by HOD');
        $this->assert($blockRes['status'] === false, "Approval of stale snapshot is strictly blocked");

        // Refresh Contact 2 snapshot to clear stale state
        $scope = [
            'session_id' => 1,
            'semester_id' => 2,
            'programme_id' => 1,
            'level' => 'all',
            'basis' => 'published',
            'cohort' => 'all',
            'entry_mode' => 'all',
        ];
        $refreshed = $this->model->resolve_or_create($scope, ['force_refresh' => true, 'created_by' => 1]);
        $this->assert($refreshed['snapshot']['is_stale'] === false, "Refreshed snapshot is no longer stale");

        $freshSnapId = $refreshed['snapshot']['id'];

        // HOD signs off
        $sign1 = $this->model->sign_off($freshSnapId, 'hod', 1, 'approve', 'HOD confirmed results');
        $this->assert($sign1['status'] === true, "HOD sign-off accepted");

        // Dean signs off -> locks and marks approved
        $sign2 = $this->model->sign_off($freshSnapId, 'dean', 2, 'approve', 'Dean senate approval');
        $this->assert($sign2['status'] === true, "Dean sign-off accepted");

        $approvedSnap = $this->db->get_where('broadsheet_snapshots', ['id' => $freshSnapId])->row_array();
        $this->assert($approvedSnap['status'] === 'approved', "Snapshot status escalated to 'approved'");
        $this->assert(!empty($approvedSnap['locked_at']), "Snapshot is locked (locked_at populated)");

        // Approved Immutability: When a new refresh occurs on an approved snapshot, it creates version 2 with supersedes_snapshot_id
        $resV2 = $this->model->resolve_or_create($scope, ['force_refresh' => true, 'created_by' => 1, 'revision_reason' => 'Post-approval Senate adjustment']);
        $this->assert($resV2['snapshot']['version'] === 2, "Re-generating approved snapshot creates Version 2");
        $this->assert($resV2['snapshot']['supersedes_snapshot_id'] === $freshSnapId, "Version 2 links supersedes_snapshot_id to Version 1");

        // Verify Version 1 is marked superseded
        $v1After = $this->db->get_where('broadsheet_snapshots', ['id' => $freshSnapId])->row_array();
        $this->assert($v1After['status'] === 'superseded', "Version 1 is preserved and marked 'superseded'");
    }
}

// Execute tests
$test = new SnapshotSystemTest();
$test->run();

<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Outstanding_course_model extends CI_Model {

    public function __construct() {
        parent::__construct();
    }

    /**
     * Determines whether Period A is strictly BEFORE Period B chronologically.
     * Supports Contact-based numbering (Contact 1..6) as well as session/semester ordering.
     */
    public function is_before($session_name_a, $semester_name_a, $session_name_b, $semester_name_b) {
        // 1. Compare sessions by 4-digit start year first
        $y_a = preg_match('/(\d{4})/', (string)$session_name_a, $ma) ? (int)$ma[1] : null;
        $y_b = preg_match('/(\d{4})/', (string)$session_name_b, $mb) ? (int)$mb[1] : null;
        if ($y_a !== null && $y_b !== null && $y_a !== $y_b) {
            return $y_a < $y_b;
        }

        // 2. If same session (or missing years), compare Contact numbers if both have contacts
        $c_a = $this->_extract_contact_number($semester_name_a);
        $c_b = $this->_extract_contact_number($semester_name_b);
        if ($c_a !== null && $c_b !== null && $c_a !== $c_b) {
            return $c_a < $c_b;
        }

        // 3. If same session, compare semesters by known order
        if ($y_a !== null && $y_b !== null && $y_a === $y_b) {
            $s_a = $this->_semester_sort_order($semester_name_a);
            $s_b = $this->_semester_sort_order($semester_name_b);
            if ($s_a !== null && $s_b !== null && $s_a !== $s_b) {
                return $s_a < $s_b;
            }
        }

        // 4. Fallback: if session_name strings differ and can be compared
        if (!empty($session_name_a) && !empty($session_name_b) && $session_name_a !== $session_name_b) {
            return strcmp($session_name_a, $session_name_b) < 0;
        }

        return false;
    }

    private function _semester_sort_order($label) {
        $str = strtolower(trim((string)$label));
        if ($str === '') return null;
        if (strpos($str, 'first') !== false || strpos($str, '1st') !== false) return 1;
        if (strpos($str, 'second') !== false || strpos($str, '2nd') !== false) return 2;
        if (preg_match('/contact\s*(\d+)/i', $str, $m)) return (int)$m[1];
        if (preg_match('/^(\d)00$/', $str, $m)) return (int)$m[1];
        if (preg_match('/^(\d)$/', $str, $m)) return (int)$m[1];
        return null;
    }

    private function _extract_contact_number($label) {
        $str = trim((string)$label);
        if ($str === '') return null;
        if (preg_match('/contact\s*(\d+)/i', $str, $m)) {
            return (int)$m[1];
        }
        if (preg_match('/^(\d)00$/', $str, $m)) {
            return (int)$m[1];
        }
        return null;
    }

    private function _is_de_student($entry_mode, $matric_number) {
        $em = strtolower(trim((string)$entry_mode));
        $mat = trim((string)$matric_number);
        return strpos($em, 'direct') !== false
            || $em === 'de'
            || (bool)preg_match('/[A-Za-z]+2\/\d+\/\d+/', $mat);
    }

    private function _is_contact_1_period($sem_name, $level = null) {
        $s = strtolower(trim((string)$sem_name));
        $l = strtolower(trim((string)$level));
        return strpos($s, 'contact 1') !== false
            || strpos($l, 'contact 1') !== false
            || $l === '100'
            || $s === '100';
    }

    public function get_outstanding_students_for_course_before($course_id, $target_session_id, $target_semester_id) {
        $students_by_course = $this->get_outstanding_students_for_courses_before(
            [$course_id],
            $target_session_id,
            $target_semester_id
        );
        return $students_by_course[$course_id] ?? [];
    }

    public function get_outstanding_students_for_courses_before($course_ids, $target_session_id, $target_semester_id, $programme_id = null, $department_id = null) {
        $session = $this->db->get_where('academic_sessions', ['id' => $target_session_id])->row_array();
        if (!$session) {
            $session = $this->db->get_where('academic_sessions', ['name' => $target_session_id])->row_array();
        }
        $semester = $this->db->get_where('semesters', ['id' => $target_semester_id])->row_array();
        if (!$semester) {
            $semester = $this->db->get_where('semesters', ['name' => $target_semester_id])->row_array();
        }
        $target_session_name = $session['name'] ?? '';
        $target_semester_name = $semester['name'] ?? '';

        if ($target_session_name === '' || $target_semester_name === '') {
            return [];
        }

        $course_filter = '';
        $params = [];
        if (!empty($course_ids)) {
            $course_placeholders = implode(', ', array_fill(0, count($course_ids), '?'));
            $course_filter = " AND b.course_id IN ($course_placeholders)";
            $params = array_values($course_ids);
        }
        $sql = "
            SELECT a.id, a.student_id, a.total_score, a.grade, a.updated_at, a.created_at,
                   b.course_id, b.session_id, b.semester_id, b.level,
                   sess.name as session_name, sem.name as semester_name,
                   s.entry_mode, adm.matric_number
            FROM result_attempts a
            JOIN result_batches b ON b.id = a.batch_id
            JOIN students s ON s.id = a.student_id
            LEFT JOIN admissions adm ON adm.id = s.admission_id
            LEFT JOIN academic_sessions sess ON (sess.id = COALESCE(NULLIF(b.academic_session_id, ''), b.session_id) OR sess.name = b.session_id)
            LEFT JOIN semesters sem ON (sem.id = b.semester_id OR sem.name = b.semester_id OR sem.name = b.level)
            WHERE (a.status = 'active' OR a.status IS NULL) $course_filter
              AND EXISTS (
                  SELECT 1
                  FROM course_registration_items cri
                  JOIN course_registrations cr ON cr.id = cri.registration_id
                  WHERE cr.student_id = a.student_id
                    AND cri.course_id = b.course_id
                    AND (cri.status = 'active' OR cri.status IS NULL)
                    AND cr.status IN ('approved', 'submitted', 'draft')
              )
        ";
        if ($programme_id && $programme_id !== 'all') {
            $sql .= ' AND s.programme_id = ?';
            $params[] = $programme_id;
        }
        if ($department_id && $department_id !== 'all') {
            $sql .= ' AND s.department_id = ?';
            $params[] = $department_id;
        }
        $sql .= ' ORDER BY sess.name ASC, sem.name ASC, COALESCE(a.updated_at, a.created_at) ASC, a.id ASC';
        $attempts = $this->db->query($sql, $params)->result_array();

        $latest_by_course_and_student = [];
        foreach ($attempts as $attempt) {
            if ($this->_is_de_student($attempt['entry_mode'] ?? '', $attempt['matric_number'] ?? '')
                && $this->_is_contact_1_period($attempt['semester_name'] ?? '', $attempt['level'] ?? '')) {
                continue;
            }
            if ($this->is_before(
                $attempt['session_name'],
                $attempt['semester_name'],
                $target_session_name,
                $target_semester_name
            )) {
                $latest_by_course_and_student[$attempt['course_id']][$attempt['student_id']] = $attempt;
            }
        }

        // Also check carryover_corrections resolved before target period
        $target_contact_num = $this->_extract_contact_number($target_semester_name);
        if ($this->db->table_exists('carryover_corrections') && !empty($latest_by_course_and_student)) {
            $corr_sql = "
                SELECT cc.student_id, cc.course_id, cc.grade, sem.name as semester_name, source_sem.name as source_semester_name
                FROM carryover_corrections cc
                JOIN semesters sem ON sem.id = cc.semester_id
                JOIN result_attempts sa ON sa.id = cc.source_result_attempt_id
                JOIN result_batches sb ON sb.id = sa.batch_id
                JOIN semesters source_sem ON source_sem.id = sb.semester_id
            ";
            foreach ($this->db->query($corr_sql)->result_array() as $corr) {
                $c_grade = strtoupper(trim((string)($corr['grade'] ?? '')));
                if ($c_grade === '' || in_array($c_grade, ['F', 'ABS'], true)) {
                    continue;
                }
                $src_c = $this->_extract_contact_number($corr['source_semester_name']);
                $cor_c = $this->_extract_contact_number($corr['semester_name']);
                $eff_c = ($src_c !== null && $cor_c !== null)
                    ? (($cor_c > $src_c) ? $cor_c : ($src_c + 1))
                    : null;
                if ($target_contact_num !== null && $eff_c !== null && $eff_c < $target_contact_num) {
                    unset($latest_by_course_and_student[$corr['course_id']][$corr['student_id']]);
                }
            }
        }

        foreach ($latest_by_course_and_student as $course_id => $students) {
            foreach ($students as $student_id => $attempt) {
                $grade = strtoupper((string)($attempt['grade'] ?? ''));
                if (!in_array($grade, ['F', 'ABS'], true)) {
                    unset($latest_by_course_and_student[$course_id][$student_id]);
                }
            }
        }

        return $latest_by_course_and_student;
    }

    /**
     * Get unresolved outstanding courses for a student prior to the given period.
     *
     * @param string $student_id
     * @param string $target_session_id
     * @param string $target_semester_id
     * @return array List of outstanding course records
     */
    public function get_outstanding_courses_before($student_id, $target_session_id, $target_semester_id) {
        $this->db->where('id', $target_session_id);
        $session = $this->db->get('academic_sessions')->row_array();
        $target_session_name = $session['name'] ?? '';

        $this->db->where('id', $target_semester_id);
        $semester = $this->db->get('semesters')->row_array();
        $target_semester_name = $semester['name'] ?? '';

        $sql = "
            SELECT a.*, c.id as course_id, c.code as course_code, c.title as course_title, c.credit_units, 
                   b.session_id, b.semester_id, sess.name as session_name, sem.name as semester_name,
                   b.level, s.entry_mode, adm.matric_number
            FROM result_attempts a
            JOIN result_batches b ON b.id = a.batch_id
            JOIN courses c ON c.id = b.course_id
            JOIN students s ON s.id = a.student_id
            LEFT JOIN admissions adm ON adm.id = s.admission_id
            LEFT JOIN academic_sessions sess ON sess.id = COALESCE(NULLIF(b.academic_session_id, ''), b.session_id)
            LEFT JOIN semesters sem ON sem.id = b.semester_id
            WHERE a.student_id = ?
              AND EXISTS (
                  SELECT 1
                  FROM course_registration_items cri
                  JOIN course_registrations cr ON cr.id = cri.registration_id
                  WHERE cr.student_id = a.student_id
                    AND cri.course_id = b.course_id
                    AND (cri.status = 'active' OR cri.status IS NULL)
                    AND cr.status IN ('approved', 'submitted', 'draft')
              )
            ORDER BY sess.name ASC, sem.name ASC
        ";
        
        $all_history = $this->db->query($sql, [$student_id])->result_array();
        
        $previous_attempts = [];
        foreach ($all_history as $att) {
            if ($this->_is_de_student($att['entry_mode'] ?? '', $att['matric_number'] ?? '')
                && $this->_is_contact_1_period($att['semester_name'] ?? '', $att['level'] ?? '')) {
                continue;
            }
            if ($this->is_before($att['session_name'], $att['semester_name'], $target_session_name, $target_semester_name)) {
                $previous_attempts[] = $att;
            }
        }

        $latest_attempts = [];
        foreach ($previous_attempts as $att) {
            $latest_attempts[$att['course_id']] = $att;
        }

        $target_contact_num = $this->_extract_contact_number($target_semester_name);
        if ($this->db->table_exists('carryover_corrections') && !empty($latest_attempts)) {
            $corr_sql = "
                SELECT cc.course_id, cc.grade, sem.name as semester_name, source_sem.name as source_semester_name
                FROM carryover_corrections cc
                JOIN semesters sem ON sem.id = cc.semester_id
                JOIN result_attempts sa ON sa.id = cc.source_result_attempt_id
                JOIN result_batches sb ON sb.id = sa.batch_id
                JOIN semesters source_sem ON source_sem.id = sb.semester_id
                WHERE cc.student_id = ?
            ";
            foreach ($this->db->query($corr_sql, [$student_id])->result_array() as $corr) {
                $c_grade = strtoupper(trim((string)($corr['grade'] ?? '')));
                if ($c_grade === '' || in_array($c_grade, ['F', 'ABS'], true)) {
                    continue;
                }
                $src_c = $this->_extract_contact_number($corr['source_semester_name']);
                $cor_c = $this->_extract_contact_number($corr['semester_name']);
                $eff_c = ($src_c !== null && $cor_c !== null)
                    ? (($cor_c > $src_c) ? $cor_c : ($src_c + 1))
                    : null;
                if ($target_contact_num !== null && $eff_c !== null && $eff_c < $target_contact_num) {
                    unset($latest_attempts[$corr['course_id']]);
                }
            }
        }

        $outstanding_courses = [];
        foreach ($latest_attempts as $cid => $att) {
            $grade = strtoupper((string)($att['grade'] ?? ''));
            if (in_array($grade, ['F', 'ABS'], true)) {
                $outstanding_courses[$cid] = $att;
            }
        }

        return $outstanding_courses;
    }
}


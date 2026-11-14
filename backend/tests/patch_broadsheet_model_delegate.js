const fs = require('fs');
const file = 'c:/DEV/Reatjs/maslaha/backend/application/models/Broadsheet_model.php';
let content = fs.readFileSync(file, 'utf8');

// Target 1: beginning of generate()
const target1 = "        // 1. Resolve Academic Context (supporting both UUID and Name)\r\n" +
"        $session = $this->db->get_where('academic_sessions', ['id' => $session_id])->row_array();\r\n" +
"        if (!$session) {\r\n" +
"            $session = $this->db->get_where('academic_sessions', ['name' => $session_id])->row_array();\r\n" +
"        }\r\n" +
"        if (!$session && $session_id) {\r\n" +
"            $session = ['id' => $session_id, 'name' => $session_id];\r\n" +
"        }\r\n" +
"\r\n" +
"        $semester = $this->db->get_where('semesters', ['id' => $semester_id])->row_array();\r\n" +
"        if (!$semester) {\r\n" +
"            $semester = $this->db->get_where('semesters', ['name' => $semester_id])->row_array();\r\n" +
"        }\r\n" +
"        if (!$semester && $semester_id) {\r\n" +
"            $semester = ['id' => $semester_id, 'name' => $semester_id];\r\n" +
"        }\r\n" +
"\r\n" +
"        $programme = $this->db->get_where('programmes', ['id' => $programme_id])->row_array();\r\n" +
"\r\n" +
"        $target_session_ids = array_values(array_filter(array_unique([\r\n" +
"            $session_id,\r\n" +
"            $session['id'] ?? null,\r\n" +
"            $session['name'] ?? null\r\n" +
"        ])));\r\n" +
"\r\n" +
"        $current_session_name = $session['name'] ?? '';\r\n" +
"        $current_semester_name = $semester['name'] ?? '';\r\n" +
"        $current_contact_num = $this->_extract_contact_number($current_semester_name ?: $level);\r\n" +
"        $is_contact_1 = $this->_is_contact_1_period($current_semester_name, $level) || ($current_contact_num === 1);\r\n" +
"\r\n" +
"        $sem_variants = [\r\n" +
"            $semester_id,\r\n" +
"            $semester['id'] ?? null,\r\n" +
"            $semester['name'] ?? null,\r\n" +
"            $level\r\n" +
"        ];\r\n" +
"        if ($current_contact_num !== null) {\r\n" +
"            $sem_variants[] = 'Contact ' . $current_contact_num;\r\n" +
"            $sem_variants[] = 'Contact' . $current_contact_num;\r\n" +
"            $sem_variants[] = (string)($current_contact_num * 100);\r\n" +
"            $sem_variants[] = (string)$current_contact_num;\r\n" +
"        }\r\n" +
"        $target_semester_ids = array_values(array_filter(array_unique($sem_variants)));";

const replace1 = "        // 1. Resolve Academic Context via Period_resolver\r\n" +
"        if (!$this->load->is_loaded('period_resolver')) {\r\n" +
"            $this->load->library('period_resolver');\r\n" +
"        }\r\n" +
"        if (!$this->load->is_loaded('academic_policy')) {\r\n" +
"            $this->load->library('academic_policy');\r\n" +
"        }\r\n" +
"        if (!$this->load->is_loaded('academic_calculator')) {\r\n" +
"            $this->load->library('academic_calculator');\r\n" +
"        }\r\n\r\n" +
"        $context_res = $this->period_resolver->resolve($session_id, $semester_id, $level);\r\n" +
"        $session = $context_res['session'];\r\n" +
"        $semester = $context_res['semester'];\r\n" +
"        $programme = $this->db->get_where('programmes', ['id' => $programme_id])->row_array();\r\n\r\n" +
"        $target_session_ids = $context_res['session_ids'];\r\n" +
"        $current_session_name = $context_res['session_name'];\r\n" +
"        $current_semester_name = $context_res['semester_name'];\r\n" +
"        $current_contact_num = $context_res['contact_number'];\r\n" +
"        $is_contact_1 = $context_res['is_contact_1'];\r\n" +
"        $target_semester_ids = $context_res['semester_ids'];";

if (!content.includes(target1)) {
    console.error("Target 1 not found in Broadsheet_model.php!");
    process.exit(1);
}

content = content.replace(target1, replace1);

// Target 2: helper methods at bottom
const target2 = "    private function _extract_contact_number($label, $course_code = null)\r\n" +
"    {\r\n" +
"        $this->_init_semester_map();\r\n" +
"        $str = trim((string)$label);\r\n" +
"        if ($str !== '' && isset($this->_semester_name_map[$str])) {\r\n" +
"            $str = $this->_semester_name_map[$str];\r\n" +
"        }\r\n" +
"        if ($str !== '') {\r\n" +
"            if (preg_match('/contact\\s*(\\d+)/i', $str, $m)) {\r\n" +
"                return (int)$m[1];\r\n" +
"            }\r\n" +
"            if (preg_match('/^(\\d)00$/', $str, $m)) {\r\n" +
"                return (int)$m[1];\r\n" +
"            }\r\n" +
"            if (preg_match('/^(\\d)$/', $str, $m)) {\r\n" +
"                return (int)$m[1];\r\n" +
"            }\r\n" +
"        }\r\n" +
"        if ($course_code) {\r\n" +
"            $cc = trim((string)$course_code);\r\n" +
"            if (preg_match('/^[A-Za-z]+(\\d)/', $cc, $m)) {\r\n" +
"                return (int)$m[1];\r\n" +
"            }\r\n" +
"        }\r\n" +
"        return null;\r\n" +
"    }\r\n" +
"\r\n" +
"    private function _is_contact_1_period($sem_name, $level = null)\r\n" +
"    {\r\n" +
"        $this->_init_semester_map();\r\n" +
"        $s = strtolower(trim((string)$sem_name));\r\n" +
"        if ($s !== '' && isset($this->_semester_name_map[$sem_name])) {\r\n" +
"            $s = strtolower(trim((string)$this->_semester_name_map[$sem_name]));\r\n" +
"        }\r\n" +
"        $l = strtolower(trim((string)$level));\r\n" +
"        return strpos($s, 'contact 1') !== false\r\n" +
"            || strpos($l, 'contact 1') !== false\r\n" +
"            || $l === '100'\r\n" +
"            || $s === '100'\r\n" +
"            || $l === '1'\r\n" +
"            || $s === '1';\r\n" +
"    }\r\n" +
"\r\n" +
"    private function _is_period_before($sess_a, $sem_a, $sess_b, $sem_b, $course_code_a = null)\r\n" +
"    {\r\n" +
"        $c_a = $this->_extract_contact_number($sem_a, $course_code_a);\r\n" +
"        $c_b = $this->_extract_contact_number($sem_b);\r\n" +
"        if ($c_a !== null && $c_b !== null && $c_a !== $c_b) {\r\n" +
"            return $c_a < $c_b;\r\n" +
"        }\r\n" +
"        return $this->Outstanding_course_model->is_before($sess_a, $sem_a, $sess_b, $sem_b);\r\n" +
"    }\r\n" +
"\r\n" +
"    private function _correction_to_attempt($correction)\r\n" +
"    {\r\n" +
"        $cu = (int)($correction['credit_units'] ?? 0);\r\n" +
"        $gp = (float)($correction['grade_point'] ?? 0);\r\n" +
"        $qp = isset($correction['quality_point']) && $correction['quality_point'] !== null\r\n" +
"            ? (float)$correction['quality_point']\r\n" +
"            : ($cu * $gp);\r\n" +
"\r\n" +
"        return [\r\n" +
"            'id' => $correction['result_attempt_id'] ?? $correction['id'],\r\n" +
"            'student_id' => $correction['student_id'],\r\n" +
"            'course_id' => $correction['course_id'],\r\n" +
"            'course_code' => $correction['course_code'] ?? '',\r\n" +
"            'course_title' => $correction['course_title'] ?? '',\r\n" +
"            'credit_units' => $cu,\r\n" +
"            'ca_score' => $correction['ca_score'] ?? null,\r\n" +
"            'exam_score' => $correction['exam_score'] ?? null,\r\n" +
"            'total_score' => $correction['total_score'],\r\n" +
"            'grade' => $correction['grade'],\r\n" +
"            'grade_point' => $gp,\r\n" +
"            'quality_point' => $qp,\r\n" +
"            'session_id' => $correction['session_id'],\r\n" +
"            'semester_id' => $correction['semester_id'],\r\n" +
"            'session_name' => $correction['session_name'] ?? '',\r\n" +
"            'semester_name' => $correction['semester_name'] ?? '',\r\n" +
"            'created_at' => $correction['created_at'] ?? '',\r\n" +
"            'updated_at' => $correction['updated_at'] ?? '',\r\n" +
"            '_from_carryover_correction' => true\r\n" +
"        ];\r\n" +
"    }";

const replace2 = "    private function _extract_contact_number($label, $course_code = null)\r\n" +
"    {\r\n" +
"        return $this->period_resolver->extract_contact_number($label, $course_code);\r\n" +
"    }\r\n" +
"\r\n" +
"    private function _is_contact_1_period($sem_name, $level = null)\r\n" +
"    {\r\n" +
"        return $this->period_resolver->is_contact_1_period($sem_name, $level);\r\n" +
"    }\r\n" +
"\r\n" +
"    private function _is_period_before($sess_a, $sem_a, $sess_b, $sem_b, $course_code_a = null)\r\n" +
"    {\r\n" +
"        return $this->period_resolver->is_period_before($sess_a, $sem_a, $sess_b, $sem_b, $course_code_a);\r\n" +
"    }\r\n" +
"\r\n" +
"    private function _correction_to_attempt($correction)\r\n" +
"    {\r\n" +
"        return $this->academic_calculator->correction_to_attempt($correction);\r\n" +
"    }";

if (!content.includes(target2)) {
    console.error("Target 2 not found in Broadsheet_model.php!");
    process.exit(1);
}

content = content.replace(target2, replace2);

// Target 3: _calculate_metrics and _format_score_grade
const target3 = "    private function _calculate_metrics($attempts, $raw_sum = false)\r\n" +
"    {\r\n" +
"        if ($raw_sum) {\r\n" +
"            $best_attempts = $attempts;\r\n" +
"        } else {\r\n" +
"            // Handle repeat/carryover courses by taking the LATEST attempt per course_id\r\n" +
"            $best_attempts = [];\r\n" +
"            foreach ($attempts as $att) {\r\n" +
"                $best_attempts[$att['course_id']] = $att;\r\n" +
"            }\r\n" +
"        }\r\n" +
"        \r\n" +
"        $tcr = 0; // Total Credit Registered\r\n" +
"        $tce = 0; // Total Credit Earned\r\n" +
"        $tqp = 0; // Total Quality Points\r\n" +
"        \r\n" +
"        foreach ($best_attempts as $att) {\r\n" +
"            $grade = strtoupper(trim((string)($att['grade'] ?? '')));\r\n" +
"            $has_valid_score = ($att['total_score'] !== null && $att['total_score'] !== '') || ($grade !== '');\r\n" +
"            \r\n" +
"            if (!$has_valid_score) {\r\n" +
"                continue; // Unscored or placeholder attempts must not contribute to credits or quality points\r\n" +
"            }\r\n" +
"\r\n" +
"            $cu = (int)$att['credit_units'];\r\n" +
"            $tcr += $cu;\r\n" +
"            $tqp += (float)($att['quality_point'] ?? 0);\r\n" +
"            \r\n" +
"            // Earned credit: ONLY if passed with valid passing grade\r\n" +
"            if ($grade !== '' && $grade !== 'F' && $grade !== 'ABS' && $grade !== 'NR' && $grade !== '-' && $grade !== '—') {\r\n" +
"                $tce += $cu;\r\n" +
"            }\r\n" +
"        }\r\n" +
"        \r\n" +
"        $gpa = ($tcr > 0) ? round($tqp / $tcr, 2) : 0.00;\r\n" +
"        \r\n" +
"        return [\r\n" +
"            'registered_credits' => $tcr,\r\n" +
"            'earned_credits' => $tce,\r\n" +
"            'quality_points' => $tqp,\r\n" +
"            'gpa' => number_format($gpa, 2, '.', ''),\r\n" +
"            'cgpa' => number_format($gpa, 2, '.', '') // Output as CGPA for cumulative block\r\n" +
"        ];\r\n" +
"    }\r\n" +
"\r\n" +
"    private function _format_score_grade($score, $grade)\r\n" +
"    {\r\n" +
"        $grade_upper = strtoupper(trim((string)$grade));\r\n" +
"        if ($grade_upper === 'ABS') {\r\n" +
"            return 'ABS';\r\n" +
"        }\r\n" +
"        if ($grade_upper === 'NR') {\r\n" +
"            return 'NR';\r\n" +
"        }\r\n" +
"        if ($score === null || $score === '') {\r\n" +
"            return $grade ?: '-';\r\n" +
"        }\r\n" +
"        $val = (float)$score;\r\n" +
"        $score_str = ((float)(int)$val === $val) ? (string)(int)$val : number_format($val, 1);\r\n" +
"        return $score_str . ($grade ?: '');\r\n" +
"    }";

const replace3 = "    private function _calculate_metrics($attempts, $raw_sum = false)\r\n" +
"    {\r\n" +
"        $res = $this->academic_calculator->calculate($attempts, [], 'reported');\r\n" +
"        return [\r\n" +
"            'registered_credits' => $res['registered_credits'],\r\n" +
"            'earned_credits'     => $res['earned_credits'],\r\n" +
"            'quality_points'     => $res['quality_points'],\r\n" +
"            'gpa'                => $res['gpa'],\r\n" +
"            'cgpa'               => $res['cgpa'],\r\n" +
"        ];\r\n" +
"    }\r\n" +
"\r\n" +
"    private function _format_score_grade($score, $grade)\r\n" +
"    {\r\n" +
"        return $this->academic_calculator->format_score_grade($score, $grade);\r\n" +
"    }";

if (!content.includes(target3)) {
    console.error("Target 3 not found in Broadsheet_model.php!");
    process.exit(1);
}

content = content.replace(target3, replace3);
fs.writeFileSync(file, content, 'utf8');
console.log("Broadsheet_model.php successfully patched!");

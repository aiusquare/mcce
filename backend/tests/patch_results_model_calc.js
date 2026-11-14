const fs = require('fs');
const file = 'c:/DEV/Reatjs/maslaha/backend/application/models/Results_model.php';
let content = fs.readFileSync(file, 'utf8');

const target = "    public function calculate_gpa($student_id, $session_id, $semester_id)\r\n" +
"    {\r\n" +
"        $this->db->select('a.*, c.credit_units');\r\n" +
"        $this->db->from('result_attempts a');\r\n" +
"        $this->db->join('result_batches b', 'b.id = a.batch_id');\r\n" +
"        $this->db->join('courses c', 'c.id = b.course_id');\r\n" +
"        $this->db->where('a.student_id', $student_id);\r\n" +
"        $this->db->where('b.session_id', $session_id);\r\n" +
"        $this->db->where('b.semester_id', $semester_id);\r\n" +
"        $this->db->where('b.status', 'published'); // Only consider published results for students\r\n" +
"        $this->db->where('a.status', 'active');\r\n" +
"        \r\n" +
"        $attempts = $this->db->get()->result_array();\r\n" +
"        \r\n" +
"        $total_cu = 0;\r\n" +
"        $total_qp = 0;\r\n" +
"\r\n" +
"        foreach ($attempts as $att) {\r\n" +
"            $cu = (int)$att['credit_units'];\r\n" +
"            $total_cu += $cu;\r\n" +
"            $total_qp += (float)$att['quality_point'];\r\n" +
"        }\r\n" +
"\r\n" +
"        if ($total_cu == 0) return 0.00;\r\n" +
"        return round($total_qp / $total_cu, 2);\r\n" +
"    }\r\n" +
"\r\n" +
"    /**\r\n" +
"     * Calculates CGPA considering all published results.\r\n" +
"     * Simple implementation: considers all attempts. Advanced repeat rules can be added here.\r\n" +
"     */\r\n" +
"    public function calculate_cgpa($student_id)\r\n" +
"    {\r\n" +
"        $this->db->select('a.*, c.id as course_id, c.credit_units');\r\n" +
"        $this->db->from('result_attempts a');\r\n" +
"        $this->db->join('result_batches b', 'b.id = a.batch_id');\r\n" +
"        $this->db->join('courses c', 'c.id = b.course_id');\r\n" +
"        $this->db->where('a.student_id', $student_id);\r\n" +
"        $this->db->where('b.status', 'published');\r\n" +
"        $this->db->where('a.status', 'active');\r\n" +
"        $this->db->order_by('a.created_at', 'ASC');\r\n" +
"        \r\n" +
"        $attempts = $this->db->get()->result_array();\r\n" +
"\r\n" +
"        // Under NUC BMAS regulations: All scored attempts contribute to Cumulative Credits Registered (CCR)\r\n" +
"        // and Cumulative Quality Points (CQP). Repeat attempts are added to registered credit load.\r\n" +
"        $total_cu = 0;\r\n" +
"        $total_qp = 0;\r\n" +
"\r\n" +
"        foreach ($attempts as $att) {\r\n" +
"            $grade = strtoupper(trim((string)($att['grade'] ?? '')));\r\n" +
"            if ($grade === '' && $att['total_score'] === null) {\r\n" +
"                continue; // Skip unscored/placeholder rows\r\n" +
"            }\r\n" +
"            $cu = (int)$att['credit_units'];\r\n" +
"            $total_cu += $cu;\r\n" +
"            $total_qp += (float)$att['quality_point'];\r\n" +
"        }\r\n" +
"\r\n" +
"        if ($total_cu == 0) return 0.00;\r\n" +
"        return round($total_qp / $total_cu, 2);\r\n" +
"    }";

const replacement = "    public function calculate_gpa($student_id, $session_id, $semester_id)\r\n" +
"    {\r\n" +
"        $this->load->library('academic_calculator');\r\n" +
"        $this->db->select('a.*, c.credit_units');\r\n" +
"        $this->db->from('result_attempts a');\r\n" +
"        $this->db->join('result_batches b', 'b.id = a.batch_id');\r\n" +
"        $this->db->join('courses c', 'c.id = b.course_id');\r\n" +
"        $this->db->where('a.student_id', $student_id);\r\n" +
"        $this->db->where('b.session_id', $session_id);\r\n" +
"        $this->db->where('b.semester_id', $semester_id);\r\n" +
"        $this->db->where('b.status', 'published'); // Only consider published results for students\r\n" +
"        $this->db->where('a.status', 'active');\r\n" +
"        \r\n" +
"        $attempts = $this->db->get()->result_array();\r\n" +
"        if (empty($attempts)) return 0.00;\r\n\r\n" +
"        $metrics = $this->academic_calculator->calculate($attempts, [], 'reported');\r\n" +
"        return (float)$metrics['gpa'];\r\n" +
"    }\r\n" +
"\r\n" +
"    /**\r\n" +
"     * Calculates CGPA considering all published results.\r\n" +
"     * Standard implementation using shared Academic_calculator.\r\n" +
"     */\r\n" +
"    public function calculate_cgpa($student_id)\r\n" +
"    {\r\n" +
"        $this->load->library('academic_calculator');\r\n" +
"        $this->db->select('a.*, c.id as course_id, c.credit_units');\r\n" +
"        $this->db->from('result_attempts a');\r\n" +
"        $this->db->join('result_batches b', 'b.id = a.batch_id');\r\n" +
"        $this->db->join('courses c', 'c.id = b.course_id');\r\n" +
"        $this->db->where('a.student_id', $student_id);\r\n" +
"        $this->db->where('b.status', 'published');\r\n" +
"        $this->db->where('a.status', 'active');\r\n" +
"        $this->db->order_by('a.created_at', 'ASC');\r\n" +
"        \r\n" +
"        $attempts = $this->db->get()->result_array();\r\n" +
"        if (empty($attempts)) return 0.00;\r\n\r\n" +
"        $metrics = $this->academic_calculator->calculate($attempts, [], 'reported');\r\n" +
"        return (float)$metrics['cgpa'];\r\n" +
"    }";

if (!content.includes(target)) {
    console.error("Target not found in Results_model.php!");
    process.exit(1);
}

content = content.replace(target, replacement);
fs.writeFileSync(file, content, 'utf8');
console.log("Results_model.php successfully patched!");

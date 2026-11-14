const fs = require("fs");
const file = "../backend/application/controllers/Admin_carryover_sync.php";
let content = fs.readFileSync(file, "utf8");

const resolvers = `
    private function resolve_session_id($session_input)
    {
        if (preg_match("/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i", $session_input)) {
            return $session_input;
        }
        $session = $this->db->get_where("academic_sessions", ["name" => $session_input])->row();
        return $session ? $session->id : null;
    }

    private function resolve_semester_id($semester_input)
    {
        if (preg_match("/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i", $semester_input)) {
            return $semester_input;
        }
        $semester = $this->db->get_where("semesters", ["name" => $semester_input])->row();
        return $semester ? $semester->id : null;
    }

    public function preview()`;

if (!content.includes("resolve_session_id")) {
    content = content.replace("    public function preview()", resolvers);
    content = content.replace(
        /\$session_id = \$payload\[.session_id.\] \?\? null;\n\s+\$semester_id = \$payload\[.semester_id.\] \?\? null;/g,
        "\$session_id = isset(\$payload[\"session_id\"]) ? \$this->resolve_session_id(\$payload[\"session_id\"]) : null;\n        \$semester_id = isset(\$payload[\"semester_id\"]) ? \$this->resolve_semester_id(\$payload[\"semester_id\"]) : null;"
    );
    fs.writeFileSync(file, content);
    console.log("Patched");
} else {
    console.log("Already patched");
}


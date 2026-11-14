import re

with open('application/models/Results_model.php', 'r', encoding='utf-8') as f:
    text = f.read()

new_text = text.replace(
    "return array('grade' => 'F', 'grade_point' => 0.0); // Fallback",
    "return array('grade' => empty() ? 'EMP' : 'MIS', 'grade_point' => 0.0); // Fallback"
)

with open('application/models/Results_model.php', 'w', encoding='utf-8') as f:
    f.write(new_text)

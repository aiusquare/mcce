import json
import re

with open('C:/Users/OWNER/.gemini/antigravity/brain/fc3b66dc-f520-4f96-8d39-90a46cc24af1/.system_generated/logs/transcript_full.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        if '"class Results_model extends CI_Model"' in line:
            obj = json.loads(line)
            # Depending on if it's in content, output, etc.
            # Usually it's in obj['content'] for GENERIC / run_command output
            if 'content' in obj and '<?php' in obj['content']:
                content = obj['content']
                # extract from <?php to end
                match = re.search(r'(<\?php.*)', content, re.DOTALL)
                if match:
                    with open('application/models/Results_model.php', 'w', encoding='utf-8') as out:
                        out.write(match.group(1))
                        print("RECOVERED")
                        break

import json
import re

found = []
with open('C:/Users/OWNER/.gemini/antigravity/brain/fc3b66dc-f520-4f96-8d39-90a46cc24af1/.system_generated/logs/transcript_full.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        if 'class Results_model extends CI_Model' in line:
            obj = json.loads(line)
            content = ""
            if 'content' in obj: content = obj['content']
            elif 'tool_calls' in obj: continue
            
            match = re.search(r'(<\?php\s+.*)', content, re.DOTALL)
            if match:
                code = match.group(1)
                # Strip trailing stuff if it ends abruptly
                code = re.sub(r'\\r\\n\"\}$', '', code)
                found.append(code)

if found:
    # Get the longest one
    best = max(found, key=len)
    with open('application/models/Results_model.php', 'w', encoding='utf-8') as out:
        out.write(best)
        print(f"RECOVERED longest: {len(best)} bytes")
else:
    print("Not found")

import json
import re

with open('C:/Users/OWNER/.gemini/antigravity/brain/fc3b66dc-f520-4f96-8d39-90a46cc24af1/.system_generated/logs/transcript_full.jsonl', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for line in lines[:4000]: # Look early in the transcript
    if 'get_cgpa_list' in line:
        obj = json.loads(line)
        content = obj.get('content', '')
        if 'public function get_cgpa_list' in content:
            with open('reconstruct5.txt', 'w', encoding='utf-8') as out:
                out.write(content)
            print("Found!")
            break

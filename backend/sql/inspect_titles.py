import json, re

with open(r'C:\Users\OWNER\.gemini\antigravity\brain\fc3b66dc-f520-4f96-8d39-90a46cc24af1\.system_generated\logs\transcript_full.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        if data.get('step_index') == 18064:
            content = data.get('content', '')
            break

# find lines for ENG111, ENG131, BIO111, EAP111, EAP121
for c in ['ENG111', 'ENG131', 'BIO111', 'BIO112', 'EDU111', 'EDU112', 'GST111', 'GST121', 'GST122', 'GST131', 'POL111']:
    pattern = rf'{c}\n([0-9a-f\-]+)\n([^\n]+)\n(\d+)\n\[([0-9a-f\-]+)\]'
    m = re.findall(pattern, content)
    print(f'=== {c} ===')
    for cid, title, units, prog in m:
        print(f'  cid={cid[:8]} | title={title} | units={units} | prog={prog[:8]}')


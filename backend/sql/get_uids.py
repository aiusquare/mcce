import json, re

with open(r'C:\Users\OWNER\.gemini\antigravity\brain\fc3b66dc-f520-4f96-8d39-90a46cc24af1\.system_generated\logs\transcript_full.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        content = data.get('content', '')
        if 'good analysis but before we move to implement the fix' in content:
            req_content = content
            break

blocks = re.findall(r'danger\s+unregistered_score\s+([^\n\r]+)\s+([0-9a-f\-]+)\s+([A-Z]{3}\d{3})\s+Student has recorded score \(([^)]+)\) in \3, but is not registered', req_content)

for name, uid, course, score in blocks:
    if any(k in name for k in ['Sama', 'MURTALA', 'SULAIMAN', 'MUBARAK', 'ADAMU Aminu']):
        clean_name = name.encode('ascii', 'replace').decode('ascii')
        print(f'{clean_name} | uid={uid} | course={course} | score={score}')


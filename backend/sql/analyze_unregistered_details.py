import json, re

with open(r'C:\Users\OWNER\.gemini\antigravity\brain\fc3b66dc-f520-4f96-8d39-90a46cc24af1\.system_generated\logs\transcript_full.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        content = data.get('content', '')
        if 'good analysis but before we move to implement the fix' in content:
            req_content = content
            break

blocks = re.findall(r'danger\s+unregistered_score\s+([^\n\r]+)\s+([0-9a-f\-]+)\s+([A-Z]{3}\d{3})\s+Student has recorded score \(([^)]+)\) in \3, but is not registered', req_content)
print(f'Total parsed unregistered_score rows: {len(blocks)}')

courses = {}
for name, uid, course, score in blocks:
    if course not in courses:
        courses[course] = []
    courses[course].append((name, uid, score))

for c in sorted(courses.keys()):
    print(f'=== {c}: {len(courses[c])} students ===')
    for name, uid, score in courses[c][:5]:
        clean_name = name.encode('ascii', 'replace').decode('ascii')
        print(f'   {clean_name} ({uid[:8]}...): {score}')


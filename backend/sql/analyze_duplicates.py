import json, re
from collections import Counter

with open(r'C:\Users\OWNER\.gemini\antigravity\brain\fc3b66dc-f520-4f96-8d39-90a46cc24af1\.system_generated\logs\transcript_full.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        if data.get('step_index') == 18064:
            content = data.get('content', '')
            break

lines = [l.strip() for l in content.split('\n') if l.strip()]

start_idx = 0
for idx, l in enumerate(lines):
    if l == 'BIO111':
        start_idx = idx
        break

records = []
i = start_idx
while i < len(lines):
    if i + 8 >= len(lines):
        break
    code = lines[i]
    if not re.match(r'^[A-Z]{2,4}\d{3}', code):
        i += 1
        continue
    cid = lines[i+1]
    title = lines[i+2]
    units = lines[i+3]
    prog = lines[i+4]
    created = lines[i+5]
    reg = lines[i+6]
    batch = lines[i+7]
    scored = lines[i+8]
    
    m = re.search(r'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', prog)
    prog_uuid = m.group(1) if m else prog
    
    records.append({
        'code': code,
        'course_id': cid,
        'title': title,
        'units': units,
        'prog': prog_uuid,
        'created': created,
        'reg': int(reg) if reg.isdigit() else reg,
        'batch': int(batch) if batch.isdigit() else batch,
        'scored': int(scored) if scored.isdigit() else scored
    })
    i += 9

print(f'Total parsed records: {len(records)}')

# Summary of programme UUIDs
prog_counter = Counter(r['prog'] for r in records)
print('\nProgramme UUID distribution across duplicates:')
for p, count in prog_counter.most_common():
    print(f'{p}: {count} duplicate courses')

# Courses of interest
print('\nKey courses breakdown:')
for code in ['ENG111', 'ENG131', 'BIO111', 'BIO112', 'EDU111', 'EDU112', 'GST111', 'GST121', 'GST122', 'GST131', 'POL111']:
    c_recs = [r for r in records if r['code'] == code]
    print(f'=== {code} ({len(c_recs)} records) ===')
    for r in c_recs:
        print(f"  id: {r['course_id']} | prog: {r['prog']} | reg: {r['reg']}, batch: {r['batch']}, scored: {r['scored']}")


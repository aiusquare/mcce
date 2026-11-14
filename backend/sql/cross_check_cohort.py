import openpyxl, json, re

# 1. Load broadsheet student list from Contact 2 excel
wb = openpyxl.load_workbook(r'C:\Users\OWNER\.gemini\antigravity\brain\fc3b66dc-f520-4f96-8d39-90a46cc24af1\.user_uploaded\media_1792779695702_7cb8d387.xlsx')
ws = wb.active

cohort_students = {}
for r in range(13, ws.max_row+1):
    sn = ws.cell(r, 1).value
    val = str(ws.cell(r, 2).value or '').strip()
    if not val or not sn:
        continue
    parts = val.split('\n')
    name = parts[0].strip()
    mat = parts[1].strip() if len(parts) > 1 else ''
    cohort_students[name] = mat

print(f'Total cohort students extracted from Contact 2 Excel: {len(cohort_students)}')

# 2. Load 306 reconciliation students
with open(r'C:\Users\OWNER\.gemini\antigravity\brain\fc3b66dc-f520-4f96-8d39-90a46cc24af1\.system_generated\logs\transcript_full.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        content = data.get('content', '')
        if 'good analysis but before we move to implement the fix' in content:
            req_content = content
            break

blocks = re.findall(r'danger\s+unregistered_score\s+([^\n\r]+)\s+([0-9a-f\-]+)\s+([A-Z]{3}\d{3})\s+Student has recorded score \(([^)]+)\) in \3, but is not registered', req_content)

reconcil_students = {}
for name, uid, course, score in blocks:
    name_clean = name.strip()
    if name_clean not in reconcil_students:
        reconcil_students[name_clean] = {'uid': uid, 'courses': []}
    reconcil_students[name_clean]['courses'].append((course, score))

print(f'Total unique students in reconciliation list: {len(reconcil_students)}')

# 3. Match cohort students with reconciliation students by name
matches = {}
for c_name, mat in cohort_students.items():
    norm_c = re.sub(r'[^a-zA-Z]', '', c_name).lower()
    for r_name, data in reconcil_students.items():
        norm_r = re.sub(r'[^a-zA-Z]', '', r_name).lower()
        if norm_c == norm_r or (len(norm_c) > 5 and norm_c in norm_r) or (len(norm_r) > 5 and norm_r in norm_c):
            matches[c_name] = {'matric': mat, 'r_name': r_name, 'uid': data['uid'], 'courses': data['courses']}

print(f'\nMatched cohort students in reconciliation report: {len(matches)} out of {len(cohort_students)}')
for name, info in sorted(matches.items()):
    c_list = [f"{c}:{s}" for c, s in info['courses']]
    print(f"[{info['matric']}] {name} ({len(info['courses'])} unreg): {', '.join(c_list)}")


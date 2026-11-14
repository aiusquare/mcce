import openpyxl, glob

files = [
    (2, r'C:\Users\OWNER\.gemini\antigravity\brain\fc3b66dc-f520-4f96-8d39-90a46cc24af1\.user_uploaded\media_1792779695702_7cb8d387.xlsx'),
    (3, r'C:\Users\OWNER\.gemini\antigravity\brain\fc3b66dc-f520-4f96-8d39-90a46cc24af1\.user_uploaded\media_1792779695702_df435d50.xlsx'),
    (4, r'C:\Users\OWNER\.gemini\antigravity\brain\fc3b66dc-f520-4f96-8d39-90a46cc24af1\.user_uploaded\media_1792779695702_fad0bcb8.xlsx'),
    (5, r'C:\Users\OWNER\.gemini\antigravity\brain\fc3b66dc-f520-4f96-8d39-90a46cc24af1\.user_uploaded\media_1792779695789_014c8040.xlsx'),
    (6, r'C:\Users\OWNER\.gemini\antigravity\brain\fc3b66dc-f520-4f96-8d39-90a46cc24af1\.user_uploaded\media_1792779695702_f0bb0812.xlsx'),
]

contact_data = {}

for c_num, fpath in files:
    wb = openpyxl.load_workbook(fpath)
    ws = wb.active
    
    # map header columns
    # Find row 12 headers
    headers = {}
    prev_cols = {}
    cum_cols = {}
    for col in range(1, ws.max_column+1):
        g = str(ws.cell(7, col).value or '')
        h = str(ws.cell(12, col).value or '')
        if 'PREVIOUS' in g:
            prev_cols[h] = col
        elif 'CUMULATIVE' in g:
            cum_cols[h] = col
            
    # print headers found
    students = {}
    for r in range(13, ws.max_row+1):
        name_cell = str(ws.cell(r, 2).value or '').strip()
        if not name_cell: continue
        parts = name_cell.split('\n')
        name = parts[0].strip()
        
        prev = {k: ws.cell(r, col).value for k, col in prev_cols.items()}
        cum = {k: ws.cell(r, col).value for k, col in cum_cols.items()}
        students[name] = {'prev': prev, 'cum': cum}
        
    contact_data[c_num] = {'prev_cols': prev_cols, 'cum_cols': cum_cols, 'students': students}
    print(f"Contact {c_num}: prev_cols={prev_cols}, cum_cols={cum_cols}, students={len(students)}")

# Now test chaining: Contact N Previous vs Contact N-1 Cumulative
for c_curr in [3, 4, 5, 6]:
    c_prev = c_curr - 1
    st_curr = contact_data[c_curr]['students']
    st_prev = contact_data[c_prev]['students']
    
    mismatches = []
    for name, data_c in st_curr.items():
        if name in st_prev:
            data_p = st_prev[name]
            p_cum = data_p['cum']
            c_prev_val = data_c['prev']
            
            # Check CCR, CCE, CGP
            diffs = []
            for m in ['CCR', 'CCE', 'CGP']:
                val_cum = p_cum.get(m)
                val_prev = c_prev_val.get(m)
                if val_cum != val_prev:
                    diffs.append(f"{m}: Cum(C{c_prev})={val_cum} vs Prev(C{c_curr})={val_prev}")
            if diffs:
                mismatches.append(f"{name}: {', '.join(diffs)}")
                
    print(f"\n--- Checking C{c_prev} Cumulative vs C{c_curr} Previous ---")
    print(f"Total students checked: {len(st_curr)}")
    print(f"Mismatches found: {len(mismatches)}")
    for m in mismatches[:5]:
        print(f"  {m}")


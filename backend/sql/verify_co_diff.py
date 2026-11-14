import openpyxl, re

# Let's see: for each student in C2, what carryovers did they take in C2?
wb_c2 = openpyxl.load_workbook(r'C:\Users\OWNER\.gemini\antigravity\brain\fc3b66dc-f520-4f96-8d39-90a46cc24af1\.user_uploaded\media_1792779695702_7cb8d387.xlsx')
ws_c2 = wb_c2.active

wb_c3 = openpyxl.load_workbook(r'C:\Users\OWNER\.gemini\antigravity\brain\fc3b66dc-f520-4f96-8d39-90a46cc24af1\.user_uploaded\media_1792779695702_df435d50.xlsx')
ws_c3 = wb_c3.active

# In C2, carryover columns are 19 to 29
# Col 19: EAP111 (2), Col 20: EAP121 (2), Col 21: EAP131 (2), Col 22: EDU111 (2), Col 23: EDU112 (2), Col 24: ENG131 (2), Col 25: GST111 (2), Col 26: GST121 (2), Col 27: GST122 (2), Col 28: GST131 (2), Col 29: POL111 (3)
co_cols = {}
for c in range(19, 30):
    code = ws_c2.cell(12, c).value
    unit = int(re.search(r'\d+', str(ws_c2.cell(11, c).value or '0')).group(0))
    co_cols[c] = (code, unit)

print('C2 Carryover Columns:')
for c, (code, unit) in co_cols.items():
    print(f'  Col {c}: {code} ({unit} units)')

# For each student, calculate their C2 registered carryover units
differences = []
for r in range(13, ws_c2.max_row+1):
    name = str(ws_c2.cell(r, 2).value or '').split('\n')[0].strip()
    if not name: continue
    
    c2_cum_ccr = ws_c2.cell(r, 38).value
    # Find student in C3
    for r3 in range(13, ws_c3.max_row+1):
        name3 = str(ws_c3.cell(r3, 2).value or '').split('\n')[0].strip()
        if name == name3:
            c3_prev_ccr = ws_c3.cell(r3, 33).value
            if c2_cum_ccr != c3_prev_ccr:
                diff = c2_cum_ccr - c3_prev_ccr
                # Check sum of active carryover cells in C2
                co_sum = 0
                co_taken = []
                for col_idx, (code, unit) in co_cols.items():
                    val = str(ws_c2.cell(r, col_idx).value or '').strip()
                    if val and val != '-' and val != 'NR':
                        co_sum += unit
                        co_taken.append(f'{code}({unit})')
                differences.append((name, c2_cum_ccr, c3_prev_ccr, diff, co_sum, co_taken))
            break

print(f'\nTotal differences in C2 Cum vs C3 Prev: {len(differences)}')
for name, cum2, prev3, diff, co_sum, co_taken in differences[:10]:
    match = (diff == co_sum)
    print(f'{name}: Cum(C2)={cum2}, Prev(C3)={prev3}, Diff={diff} | C2 Carryovers: {co_sum} {co_taken} | Exactly matches carryovers? {match}')


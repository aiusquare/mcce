import openpyxl, glob

files = glob.glob(r'C:\Users\OWNER\.gemini\antigravity\brain\fc3b66dc-f520-4f96-8d39-90a46cc24af1\.user_uploaded\*.xlsx')

for f in sorted(files):
    wb = openpyxl.load_workbook(f)
    ws = wb.active
    contact = ws.cell(5, 5).value
    # find ABDULKADIR Sama'ila
    found = False
    for r in range(13, ws.max_row+1):
        name_cell = str(ws.cell(r, 2).value or '')
        if "ABDULKADIR Sama'ila" in name_cell:
            prev_ccr = ws.cell(r, 34).value if ws.max_column >= 34 else ''
            prev_cce = ws.cell(r, 35).value if ws.max_column >= 35 else ''
            prev_cgp = ws.cell(r, 36).value if ws.max_column >= 36 else ''
            cum_ccr = ws.cell(r, 38).value if ws.max_column >= 38 else ''
            cum_cce = ws.cell(r, 39).value if ws.max_column >= 39 else ''
            cum_cgp = ws.cell(r, 40).value if ws.max_column >= 40 else ''
            rem = ws.cell(r, 42).value if ws.max_column >= 42 else ''
            print(f'{contact}: Prev(CCR={prev_ccr}, CCE={prev_cce}, CGP={prev_cgp}) | Cum(CCR={cum_ccr}, CCE={cum_cce}, CGP={cum_cgp}) | Rem: {rem}')
            found = True
            break
    if not found:
        print(f'{contact}: Not found')


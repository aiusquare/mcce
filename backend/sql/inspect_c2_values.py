import openpyxl

wb = openpyxl.load_workbook(r'C:\Users\OWNER\.gemini\antigravity\brain\fc3b66dc-f520-4f96-8d39-90a46cc24af1\.user_uploaded\media_1792779695702_7cb8d387.xlsx')
ws = wb.active

# Let's inspect column headers in row 12
headers = [str(ws.cell(12, c).value or '') for c in range(1, ws.max_column+1)]
print('Row 12 headers:')
for c_idx, h in enumerate(headers, 1):
    if h:
        print(f'Col {c_idx}: {h}')

# Let's find Previous TCR/TCE/TGPE or CCR/CCE/CGPE columns
# Let's check row 13 ABDULKADIR Sama'ila
print('\nRow 13 values across columns:')
for c_idx in range(1, ws.max_column+1):
    val = ws.cell(13, c_idx).value
    h12 = ws.cell(12, c_idx).value
    h7 = ws.cell(7, c_idx).value
    if val is not None:
        print(f'Col {c_idx} [h7={h7}, h12={h12}]: {val}')


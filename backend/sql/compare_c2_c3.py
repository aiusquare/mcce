import openpyxl

wb_c2 = openpyxl.load_workbook(r'C:\Users\OWNER\.gemini\antigravity\brain\fc3b66dc-f520-4f96-8d39-90a46cc24af1\.user_uploaded\media_1792779695702_7cb8d387.xlsx')
ws_c2 = wb_c2.active

wb_c3 = openpyxl.load_workbook(r'C:\Users\OWNER\.gemini\antigravity\brain\fc3b66dc-f520-4f96-8d39-90a46cc24af1\.user_uploaded\media_1792779695702_df435d50.xlsx')
ws_c3 = wb_c3.active

# Let's inspect Student 1 (ABDULKADIR Sama'ila) in C2 vs C3
print("=== Contact 2 Broadsheet for Student 1 ===")
for c in range(30, 42):
    h = ws_c2.cell(12, c).value
    g = ws_c2.cell(7, c).value
    val = ws_c2.cell(13, c).value
    print(f"Col {c} [{g} - {h}]: {val}")

print("\n=== Contact 3 Broadsheet for Student 1 ===")
for c in range(1, ws_c3.max_column+1):
    val = ws_c3.cell(13, c).value
    h12 = ws_c3.cell(12, c).value
    h7 = ws_c3.cell(7, c).value
    if val is not None and ('CCR' in str(h12) or 'CCE' in str(h12) or 'CGP' in str(h12) or 'TCR' in str(h12) or 'TCE' in str(h12) or 'TGP' in str(h12)):
        print(f"Col {c} [{h7} - {h12}]: {val}")


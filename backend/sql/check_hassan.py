import openpyxl

wb_c2 = openpyxl.load_workbook(r'C:\Users\OWNER\.gemini\antigravity\brain\fc3b66dc-f520-4f96-8d39-90a46cc24af1\.user_uploaded\media_1792779695702_7cb8d387.xlsx')
ws_c2 = wb_c2.active

wb_c3 = openpyxl.load_workbook(r'C:\Users\OWNER\.gemini\antigravity\brain\fc3b66dc-f520-4f96-8d39-90a46cc24af1\.user_uploaded\media_1792779695702_df435d50.xlsx')
ws_c3 = wb_c3.active

def print_student(ws, title):
    print(f"=== {title} ===")
    for r in range(13, ws.max_row+1):
        name = str(ws.cell(r, 2).value or '')
        if "ABDULLAHI Hassan" in name:
            for c in range(5, ws.max_column+1):
                h12 = ws.cell(12, c).value
                h7 = ws.cell(7, c).value
                unit = ws.cell(11, c).value
                val = ws.cell(r, c).value
                if val is not None and val != '-' and val != '':
                    print(f"  Col {c} [g={h7}, h={h12}, unit={unit}]: {val}")
            break

print_student(ws_c2, "ABDULLAHI Hassan in Contact 2")
print_student(ws_c3, "ABDULLAHI Hassan in Contact 3")


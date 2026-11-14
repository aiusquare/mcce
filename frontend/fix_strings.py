with open('src/components/admin/results/excelExport.ts', 'r', encoding='utf-8') as f:
    text = f.read()
text = text.replace('saveAs(blob, \MCCE_Broadsheet_\_\_\.xlsx\);', 'saveAs(blob, MCCE_Broadsheet___.xlsx);')
with open('src/components/admin/results/excelExport.ts', 'w', encoding='utf-8') as f:
    f.write(text)

with open('src/components/admin/results/wordExport.ts', 'r', encoding='utf-8') as f:
    text = f.read()
text = text.replace('saveAs(blob, \MCCE_Broadsheet_\_\_\.docx\);', 'saveAs(blob, MCCE_Broadsheet___.docx);')
with open('src/components/admin/results/wordExport.ts', 'w', encoding='utf-8') as f:
    f.write(text)

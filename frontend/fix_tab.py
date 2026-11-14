import re

with open('src/components/admin/results/BroadsheetTab.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix the broken import injection
text = text.replace("import { generateExcelBroadsheet } from './excelExport';\nimport { generateWordBroadsheet } from './wordExport';\n\n// ... (in the component)\n\n", "")

if "import { generateExcelBroadsheet }" not in text:
    text = "import { generateExcelBroadsheet } from './excelExport';\nimport { generateWordBroadsheet } from './wordExport';\n" + text

with open('src/components/admin/results/BroadsheetTab.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

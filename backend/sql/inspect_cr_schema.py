import json, re

# Let's inspect course_registrations structure from schema
with open(r'c:\DEV\Reatjs\maslaha\frontend\db\mcchst_new_schema.sql', 'r', encoding='utf-8') as f:
    schema = f.read()

m = re.search(r'CREATE TABLE `?course_registrations`?\s*\((.*?)\)\s*ENGINE', schema, re.DOTALL)
if m:
    print('course_registrations schema:')
    print(m.group(1))


import re

with open('application/models/Results_model.php', 'r', encoding='utf-8') as f:
    lines = f.readlines()

with open('application/models/Results_model.php', 'w', encoding='utf-8') as f:
    for line in lines:
        if re.match(r'^\d+:\s', line):
            f.write(re.sub(r'^\d+:\s', '', line))
        else:
            f.write(line)

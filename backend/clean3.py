import re

with open('reconstruct6.txt', 'r', encoding='utf-8') as f:
    text = f.read()

# Find <?php and slice
idx = text.find('<?php')
if idx != -1:
    text = text[idx:]

# Remove trailing string like "The above content does NOT show..."
text = re.sub(r'The above content does NOT show.*', '', text, flags=re.DOTALL)

# Strip line numbers if they exist \d+: 
text = re.sub(r'(?m)^\d+:\s', '', text)

# Clean double newlines
text = text.replace('\n\n', '\n')

with open('application/models/Results_model.php', 'w', encoding='utf-8') as f:
    f.write(text)

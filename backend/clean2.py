with open('application/models/Results_model.php', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('\n\n', '\n')

with open('application/models/Results_model.php', 'w', encoding='utf-8') as f:
    f.write(text)

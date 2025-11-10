# -*- coding: utf-8 -*-
from pathlib import Path
text = Path('src/components/GmEditorPage.tsx').read_text(encoding='utf-8')
start = text.index('Владения навыками')
print(text[start-200:start+800])

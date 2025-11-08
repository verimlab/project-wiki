# -*- coding: utf-8 -*-
from pathlib import Path
path = Path("src/components/GmEditorPage.tsx")
text = path.read_text(encoding="utf-8")
bad = "aria-label={\������� ����� \}>"
if bad in text:
    text = text.replace(bad, "aria-label={`Удалить навык ${skill}`}")
else:
    text = text.replace("aria-label={\\`Удалить навык ${skill}\\`}", "aria-label={`Удалить навык ${skill}`}")
path.write_text(text, encoding="utf-8")

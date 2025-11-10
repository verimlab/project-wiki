# -*- coding: utf-8 -*-
from pathlib import Path
lines = Path("src/components/GmEditorPage.tsx").read_text(encoding="utf-8").splitlines()
for idx,line in enumerate(lines):
    if "const currentArticle = useMemo(() =>" in line:
        print(idx)
        break

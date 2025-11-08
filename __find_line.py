# -*- coding: utf-8 -*-
from pathlib import Path
lines = Path("src/components/GmEditorPage.tsx").read_text(encoding="utf-8").splitlines()
for idx,line in enumerate(lines, start=1):
    if "const { initialArticles, loaded } = useLore();" in line:
        print(idx)
        break

# -*- coding: utf-8 -*-
from pathlib import Path
text = Path("src/components/LoreSectionPage.tsx").read_text(encoding="utf-8")
start = text.index('        <div className="lore-grid"')
end = text.index('      {modalArticle &&', start)
print(text[start:end])

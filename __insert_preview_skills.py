# -*- coding: utf-8 -*-
from pathlib import Path
path = Path('src/components/GmEditorPage.tsx')
text = path.read_text(encoding='utf-8')
marker = "                </div>\n\n\n              {section === 'creatures' && (\n                <div className=\"ge-preview-stats\">"
if marker not in text:
    raise SystemExit('preview marker not found')
replacement = "                </div>\n                  {currentArticle.skillProficiencies?.length ? (\n                    <div className=\"ge-preview-skills\">\n                      {currentArticle.skillProficiencies.map((skill) => (\n                        <span key={skill} className=\"ge-preview-skill-chip\">\n                          <i className=\"fa-solid fa-star\" /> {skill}\n                        </span>\n                      ))}\n                    </div>\n                  ) : null}\n\n\n              {section === 'creatures' && (\n                <div className=\"ge-preview-stats\">"
text = text.replace(marker, replacement, 1)
path.write_text(text, encoding='utf-8')

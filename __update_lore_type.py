# -*- coding: utf-8 -*-
from pathlib import Path
path = Path("src/types/lore.ts")
text = path.read_text(encoding="utf-8")
old = "  baseStats?: BaseStats; // ДЛЯ 'races'\n  ac?: string;           // ДЛЯ 'creatures'\n  attacks?: string;      // ДЛЯ 'creatures'\n"
if old not in text:
    raise SystemExit('pattern not found')
new = old + "  skillProficiencies?: string[]; // Владения навыками (для существ)\n"
path.write_text(text.replace(old, new, 1), encoding="utf-8")

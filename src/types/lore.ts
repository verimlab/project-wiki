// в файле src/types/lore.ts (или похожем)

export type SectionId = 'characters' | 'races' | 'worlds' | 'creatures';

export type BaseStats = Record<string, number>;

export interface Article {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  coverColor: string;
  icon?: string;
  content: string;
  updatedAt: number;

  // --- ДОБАВЬ ЭТИ СТРОКИ ---
  baseStats?: BaseStats; // Для 'races'
  ac?: string;           // Для 'creatures'
  attacks?: string;      // Для 'creatures'
  skillProficiencies?: string[]; // Владения навыками (для существ)
  category?: string;     // Группа существа
  // --------------------------
}

export type ArticlesMap = Record<SectionId, Article[]>;

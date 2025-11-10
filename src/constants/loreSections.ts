import type { SectionId } from '../types/lore';

export const LORE_SECTIONS: Array<{
  id: SectionId;
  label: string;
  icon: string;
  hint: string;
  path: string;
}> = [
  { id: 'characters', label: 'Персонажи', icon: 'fa-solid fa-user-astronaut', hint: 'Герои, NPC, заметки, биографии', path: '/lore/characters' },
  { id: 'races', label: 'Расы', icon: 'fa-solid fa-dna', hint: 'Черты, происхождение, особенности', path: '/lore/races' },
  { id: 'worlds', label: 'Миры', icon: 'fa-solid fa-globe', hint: 'Локации, регионы, тайны мира', path: '/lore/worlds' },
  { id: 'creatures', label: 'Существа', icon: 'fa-solid fa-dragon', hint: 'Монстры, статы, повадки', path: '/lore/creatures' },
];

export const SECTION_IDS = LORE_SECTIONS.map((meta) => meta.id);
export const SECTION_BY_ID = Object.fromEntries(LORE_SECTIONS.map((meta) => [meta.id, meta] as const)) as Record<SectionId, typeof LORE_SECTIONS[number]>;

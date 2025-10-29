import type { StatKey } from './types/sheet';

export const STAT_META: Array<{ key: StatKey; icon: string; label: string; hideWhenNoMagic?: boolean; subskills?: string[] }> = [
  { key: 'strength', icon: 'fa-solid fa-fist-raised', label: 'Сила', subskills: ['Атлетика', 'Запугивание'] },
  { key: 'dexterity', icon: 'fa-solid fa-person-running', label: 'Ловкость', subskills: ['Акробатика', 'Ловкость рук', 'Скрытность', 'Инициатива'] },
  { key: 'intellect', icon: 'fa-solid fa-brain', label: 'Интеллект', subskills: ['История', 'Природа', 'Религия', 'Уход за животными', 'Медицина'] },
  { key: 'constitution', icon: 'fa-solid fa-shield-heart', label: 'Телосложение' },
  { key: 'charisma', icon: 'fa-solid fa-face-smile-beam', label: 'Харизма', subskills: ['Обман', 'Запугивание', 'Убеждение', 'Выступление'] },
  { key: 'perception', icon: 'fa-solid fa-eye', label: 'Восприятие', subskills: ['Анализ', 'Проницательность', 'Выживание'] },
  { key: 'wisdom', icon: 'fa-solid fa-feather', label: 'Мудрость', hideWhenNoMagic: true },
  { key: 'luck', icon: 'fa-solid fa-clover', label: 'Удача' },
];
import type { SkillCategory } from '../types/sheet';
import { SKILL_CATEGORY_VALUES } from '../types/sheet';

export const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> = {
  proficiency: 'Мастерство',
  magic: 'Магия',
  passive: 'Пассивные',
  ritual: 'Ритуалы',
  gift: 'Дары',
  technique: 'Техники',
  support: 'Поддержка',
  misc: 'Разное',
};

export const SKILL_CATEGORY_OPTIONS = SKILL_CATEGORY_VALUES.map((value) => ({
  value,
  label: SKILL_CATEGORY_LABELS[value],
}));

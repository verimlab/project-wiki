import type { AttackFields } from '../types/sheet';

// Naive heuristics to prefill attack fields based on item name.
// Note: Original static page used RU keywords; here we add basic EN fallbacks.
export function defaultAttackFor(nameRaw: string): AttackFields {
  const name = (nameRaw || '').toLowerCase();
  const any = (...words: string[]) => words.some((w) => name.includes(w));

  // Ranged
  if (any('crossbow')) return { damage: '1d8', type: 'piercing', range: '100/400 ft', properties: 'loading, two-handed' };
  if (any('longbow')) return { damage: '1d8', type: 'piercing', range: '150/600 ft', properties: 'heavy, two-handed' };
  if (any('shortbow', 'bow')) return { damage: '1d6', type: 'piercing', range: '80/320 ft', properties: 'two-handed' };
  if (any('javelin', 'sling')) return { damage: '1d6', type: 'piercing', range: '30/120 ft' };

  // Melee finesse
  if (any('dagger', 'knife')) return { damage: '1d4', type: 'piercing', range: '5 ft', properties: 'finesse, light, thrown (20/60)' };
  if (any('rapier')) return { damage: '1d8', type: 'piercing', range: '5 ft', properties: 'finesse' };
  if (any('scimitar')) return { damage: '1d6', type: 'slashing', range: '5 ft', properties: 'finesse, light' };

  // Melee strength
  if (any('spear')) return { damage: '1d6', type: 'piercing', range: '5 ft', properties: 'versatile (1d8)' };
  if (any('mace')) return { damage: '1d6', type: 'bludgeoning', range: '5 ft' };
  if (any('maul', 'warhammer')) return { damage: '1d8', type: 'bludgeoning', range: '5 ft' };
  if (any('axe', 'battleaxe')) return { damage: '1d8', type: 'slashing', range: '5 ft', properties: 'versatile (1d10)' };
  if (any('sword', 'longsword')) return { damage: '1d8', type: 'slashing', range: '5 ft', properties: 'versatile (1d10)' };
  if (any('club')) return { damage: '1d4', type: 'bludgeoning', range: '5 ft' };

  // Default
  return { damage: '1d4', type: '-', range: '5 ft' };
}


import { collection, onSnapshot, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebase';
import type { SkillCatalogEntry, SkillAttackData, SkillStatMod, SkillStatModTarget } from '../types/sheet';
import { SKILL_CATEGORY_VALUES, type SkillCategory } from '../types/sheet';

const readString = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim().length) {
    return value;
  }
  return undefined;
};

const readNumber = (value: unknown): number | undefined => {
  return typeof value === 'number' && !Number.isNaN(value) ? value : undefined;
};

const readArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item).trim())
    .filter(Boolean);
};

const readBool = (value: unknown): boolean | undefined => {
  return typeof value === 'boolean' ? value : undefined;
};

const readAttack = (value: unknown): SkillAttackData | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  const get = (k: string) => (typeof v[k] === 'string' ? String(v[k]) : '');
  const candidate: SkillAttackData = {
    damage: get('damage'),
    damageType: get('damageType'),
    range: get('range'),
    saveType: get('saveType'),
    castingTime: get('castingTime'),
    manaCost: get('manaCost'),
    effect: get('effect'),
  };
  const hasAny = Object.values(candidate).some((s) => typeof s === 'string' && s.trim().length > 0);
  return hasAny ? candidate : undefined;
};

const readCategory = (value: unknown): SkillCategory | undefined => {
  if (typeof value !== 'string') return undefined;
  return (SKILL_CATEGORY_VALUES as string[]).includes(value) ? (value as SkillCategory) : undefined;
};

const readTimestamp = (value: unknown, fallback: number): number => {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis: () => number }).toMillis === 'function') {
    try {
      return (value as { toMillis: () => number }).toMillis();
    } catch {}
  }
  return fallback;
};

const mapDocToSkill = (id: string, data: Record<string, unknown>): SkillCatalogEntry => {
  const now = Date.now();
  const readStatMods = (value: unknown): SkillStatMod[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const allowed: SkillStatModTarget[] = [
      'strength','dexterity','intellect','constitution','charisma','perception','wisdom','luck','manaMax','healthMax','speed','ac'
    ];
    const mods = (value as any[])
      .map((m) => ({ target: String((m as any)?.target ?? ''), delta: Number((m as any)?.delta) }))
      .filter((m) => allowed.includes(m.target as SkillStatModTarget) && Number.isFinite(m.delta));
    return mods.length ? mods as SkillStatMod[] : [];
  };
  return {
    id,
    name: readString(data.name) ?? '���?����?��� �����',
    description: readString(data.description),
    icon: readString(data.icon),
    requiredExp: readNumber(data.requiredExp),
    perks: readArray(data.perks),
    keywords: readArray(data.keywords),
    aspects: readArray((data as any).aspects),
    rank: readString(data.rank),
    order: readNumber(data.order),
    createdAt: readTimestamp(data.createdAt, now),
    updatedAt: readTimestamp(data.updatedAt, now),
    branches: [],
    category: readCategory((data as any).category),
    hasAttack: readBool((data as any).hasAttack),
    attack: readAttack((data as any).attack),
    manaCost: readString((data as any).manaCost),
    statMods: readStatMods((data as any).statMods),
  };
};

export function useSkillsCatalog() {
  const [catalog, setCatalog] = useState<SkillCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const skillsQuery = query(collection(db, 'skillsCatalog'));
    const unsubscribe = onSnapshot(
      skillsQuery,
      (snapshot) => {
        const mapped = snapshot.docs.map((docSnap) => mapDocToSkill(docSnap.id, docSnap.data()));
        mapped.sort((a, b) => {
          const orderDiff = (a.order ?? 0) - (b.order ?? 0);
          if (orderDiff !== 0) return orderDiff;
          return a.name.localeCompare(b.name);
        });
        setCatalog(mapped);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('skills catalog snapshot failed', err);
        setCatalog([]);
        setError(err);
        setLoading(false);
      },
    );

    return () => {
      unsubscribe();
    };
  }, []);

  return { catalog, loading, error } as const;
}

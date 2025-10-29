import { collection, onSnapshot, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebase';
import type { SkillCatalogEntry } from '../types/sheet';

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
  return {
    id,
    name: readString(data.name) ?? '���?����?��� �����',
    description: readString(data.description),
    icon: readString(data.icon),
    requiredExp: readNumber(data.requiredExp),
    perks: readArray(data.perks),
    keywords: readArray(data.keywords),
    rank: readString(data.rank),
    order: readNumber(data.order),
    createdAt: readTimestamp(data.createdAt, now),
    updatedAt: readTimestamp(data.updatedAt, now),
    branches: [],
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

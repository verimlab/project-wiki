import { collection, deleteDoc, doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import type { SkillCatalogEntry } from '../types/sheet';
import { createId } from '../utils/id';

export type SkillEditorDraft = {
  id?: string;
  name: string;
  description?: string;
  icon?: string;
  requiredExp?: number;
  keywords?: string[];
  perks?: string[];
  rank?: string;
  order?: number;
  createdAt?: number;
};

const collectionRef = collection(db, 'skillsCatalog');

const normalizeArray = (value?: string[], toLower = false): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const next = String(item).trim();
      return toLower ? next.toLowerCase() : next;
    })
    .filter(Boolean);
};

const buildPayload = (input: SkillEditorDraft, now: number) => {
  const name = input.name?.trim();
  if (!name) throw new Error('Название навыка обязательно');

  const payload: Record<string, unknown> = {
    name,
    requiredExp: typeof input.requiredExp === 'number' && !Number.isNaN(input.requiredExp) ? input.requiredExp : 100,
    keywords: normalizeArray(input.keywords),
    perks: normalizeArray(input.perks),
    order: typeof input.order === 'number' && !Number.isNaN(input.order) ? input.order : 0,
    updatedAt: now,
    createdAt: typeof input.createdAt === 'number' ? input.createdAt : now,
  };

  if (typeof input.description === 'string') {
    payload.description = input.description.trim();
  }
  if (typeof input.icon === 'string') {
    payload.icon = input.icon.trim();
  }
  if (typeof input.rank === 'string') {
    const rank = input.rank.trim();
    if (rank) payload.rank = rank;
    else payload.rank = null;
  }

  return payload;
};

export async function saveSkillDraft(draft: SkillEditorDraft): Promise<string> {
  const id = draft.id?.trim() || createId('skill');
  const payload = buildPayload(draft, Date.now());
  await setDoc(doc(collectionRef, id), payload, { merge: true });
  return id;
}

export async function deleteSkill(id: string) {
  await deleteDoc(doc(collectionRef, id));
}

export async function bulkUpsertSkills(entries: SkillEditorDraft[]) {
  if (!entries.length) return;
  const chunkSize = 400;
  for (let offset = 0; offset < entries.length; offset += chunkSize) {
    const slice = entries.slice(offset, offset + chunkSize);
    const batch = writeBatch(db);
    const now = Date.now();
    slice.forEach((entry, idx) => {
      const id = entry.id?.trim() || createId('skill');
      const payload = buildPayload(entry, now + idx);
      batch.set(doc(collectionRef, id), payload, { merge: true });
    });
    await batch.commit();
  }
}

export const skillDraftFromCatalog = (entry: SkillCatalogEntry): SkillEditorDraft => ({
  id: entry.id,
  name: entry.name,
  description: entry.description,
  icon: entry.icon,
  requiredExp: entry.requiredExp,
  keywords: entry.keywords ?? [],
  perks: entry.perks ?? [],
  rank: entry.rank,
  order: entry.order,
  createdAt: entry.createdAt,
});


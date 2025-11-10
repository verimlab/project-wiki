import { collection, deleteDoc, doc, setDoc, writeBatch, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
// [ИСПРАВЛЕНО] 1. Импортируем *настоящие* типы
import { SKILL_CATEGORY_VALUES, type SkillCatalogEntry, type SkillBranch, type SkillCategory, type SkillStatMod, type SkillStatModTarget } from '../types/sheet'; 
import { createId } from '../utils/id';

type AttackDetails = {
  damage: string;
  damageType: string;
  range: string;
  saveType: string;
  castingTime: string;
  manaCost: string;
  effect: string;
};

// [УДАЛЕНО] ❌ Локальный тип `SkillBranch`

// [ИСПРАВЛЕНО] 2. `branches` в DRAFT (локальный) - это string[]
export type SkillEditorDraft = {
  id?: string;
  name: string;
  description?: string;
  icon?: string;
  requiredExp?: number;
  keywords?: string[];
  perks?: string[];
  aspects?: string[];
  branches?: string[]; // 👈 string[] (для формы)
  rank?: string;
  order?: number;
  createdAt?: number;
  category?: SkillCategory;
  manaCost?: string;
  hasAttack?: boolean;
  attack?: AttackDetails;
  statMods?: SkillStatMod[];
};

const collectionRef = collection(db, 'skillsCatalog');
const ALLOWED_CATEGORIES = SKILL_CATEGORY_VALUES;

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
    aspects: normalizeArray(input.aspects),
    
    // [ИСПРАВЛЕНО] 3. Конвертируем string[] (из формы) в SkillBranch[] (для Firebase)
    //    Предполагаем, что у SkillBranch есть поле `name`
    branches: Array.isArray(input.branches) 
                ? input.branches.map(str => ({ name: str })) // 👈 Конвертация в [{ name: "..." }]
                : [], 
    
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
  if (typeof input.manaCost === 'string') {
    const mana = input.manaCost.trim();
    payload.manaCost = mana.length ? mana : null;
  } else {
    payload.manaCost = null;
  }
  if (typeof input.category === 'string') {
    const value = input.category as SkillCategory;
    payload.category = ALLOWED_CATEGORIES.includes(value) ? value : 'misc';
  }
  
  payload.hasAttack = typeof input.hasAttack === 'boolean' ? input.hasAttack : false;

  if (payload.hasAttack && typeof input.attack === 'object' && input.attack !== null) {
    payload.attack = {
      damage: String(input.attack.damage ?? ''),
      damageType: String(input.attack.damageType ?? ''),
      range: String(input.attack.range ?? ''),
      saveType: String(input.attack.saveType ?? ''),
      castingTime: String(input.attack.castingTime ?? ''),
      manaCost: String(input.attack.manaCost ?? ''),
      effect: String(input.attack.effect ?? ''),
    };
  } else {
    payload.attack = null;
  }

  // Persist stat modifiers (validated)
  const allowedTargets: SkillStatModTarget[] = [
    'strength','dexterity','intellect','constitution','charisma','perception','wisdom','luck','manaMax','healthMax','speed','ac'
  ];
  if (Array.isArray(input.statMods)) {
    const mods: SkillStatMod[] = input.statMods
      .map((m) => ({
        target: (m?.target as SkillStatModTarget),
        delta: Number((m as any)?.delta),
      }))
      .filter((m) => allowedTargets.includes(m.target) && Number.isFinite(m.delta));
    (payload as any).statMods = mods;
  } else {
    (payload as any).statMods = [];
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

export async function fetchSkills(): Promise<SkillCatalogEntry[]> {
  const querySnapshot = await getDocs(collectionRef);
  return querySnapshot.docs.map((doc) => ({
    ...doc.data(),
    id: doc.id,
  } as SkillCatalogEntry));
}

export const skillDraftFromCatalog = (entry: SkillCatalogEntry): SkillEditorDraft => ({
  id: entry.id,
  name: entry.name,
  description: entry.description,
  icon: entry.icon,
  requiredExp: entry.requiredExp,
  keywords: entry.keywords ?? [],
  perks: entry.perks ?? [],
  
  // [ИСПРАВЛЕНО] 4. Конвертируем SkillBranch[] (из Firebase) в string[] (для формы)
  //    Предполагаем, что у SkillBranch есть поле `name`
  branches: Array.isArray(entry.branches) 
              ? (entry.branches as SkillBranch[]).map(b => (b as any).name ?? String(b)) // 👈 Конвертация в ["...", "..."]
              : [],
  
  rank: entry.rank,
  order: entry.order,
  createdAt: entry.createdAt,
  category: entry.category,
  manaCost: entry.manaCost,
  hasAttack: entry.hasAttack,
  attack: entry.attack,
  statMods: Array.isArray((entry as any).statMods) ? (entry as any).statMods as SkillStatMod[] : [],
  aspects: normalizeArray(entry.aspects),
});

export type StatKey =
  | 'strength'
  | 'dexterity'
  | 'intellect'
  | 'constitution'
  | 'charisma'
  | 'perception'
  | 'wisdom'
  | 'luck';

export type StatsState = Record<StatKey, boolean[]>; // arrays of length up to 10

export type SkillBranch = {
  title: string;
  note: string;
  perksState?: boolean[]; // align to perks length if present
};

export type Skill = {
  id?: string;
  name: string;
  description?: string;
  icon?: string; // FA icon class, e.g. 'fa-wand-magic-sparkles'
  requiredExp?: number; // threshold to unlock perks
  expCurrent?: number;
  expMax?: number;
  perks?: string[];
  keywords?: string[];
  rank?: string;
  order?: number;
  createdAt?: number;
  updatedAt?: number;
  branches: SkillBranch[];
};

export type SkillCatalogEntry = Skill & { id: string };

export type InventoryCategoryId =
  | 'gear'
  | 'weapon'
  | 'consumable'
  | 'magic'
  | 'tools'
  | 'quest'
  | 'misc'
  | 'currency';

export type InventoryItem = {
  id: string;
  name: string;
  category: InventoryCategoryId;
  quantity: number;
  note?: string;
  system?: boolean;
  hasAttack?: boolean;
};

export type AttackFields = {
  bonus?: string;
  damage?: string;
  type?: string;
  range?: string;
  properties?: string;
};

export type AttacksState = Record<string, AttackFields>; // keyed by InventoryItem.id

export type CharacterSheet = {
  statPoints: number;
  name?: string;
  age?: string;
  race?: string;
  type?: 'normal' | 'initiated';
  charLevel?: number;
  speed?: number;
  ac?: number;
  inspiration?: number;
  coinsMM?: number; // copper (legacy naming kept to match sheet.html keys)
  coinsSM?: number; // silver
  coinsZM?: number; // gold
  expCurrent?: number;
  expMax?: number;
  healthCurrent?: number;
  healthMax?: number;
  manaCurrent?: number;
  manaMax?: number;
  notes?: string;
  stats?: Partial<StatsState>;
  skills?: Skill[];
  inventory?: InventoryItem[];
  attacks?: AttacksState;
};

export const SHEET_KEY = 'character_sheet_v1';
export const SKILLS_KEY = 'character_skills_v1';
export const INVENTORY_KEY = 'character_inventory_v1';
export const ATTACKS_KEY = 'character_attacks_v1';
export const STATS_KEY = 'character_stats_v1';

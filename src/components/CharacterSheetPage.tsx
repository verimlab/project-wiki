import React, { Fragment, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { Link, useNavigate } from 'react-router-dom';
import { ATTACKS_KEY, INVENTORY_KEY, SHEET_KEY, SKILLS_KEY, STATS_KEY } from '../types/sheet';
import type {
  CharacterSheet,
  StatKey,
  AttackFields,
  AttacksState,
  InventoryCategoryId,
  InventoryItem,
  Skill,
  SkillAttackData,
  SkillCatalogEntry,
} from '../types/sheet';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { auth, db, googleProvider } from '../firebase';
import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { createId } from '../utils/id';
import { defaultAttackFor } from '../utils/attacks';
import './CharacterSheetPage.css';
import { STAT_META } from '../constants';
import type { StatsState } from '../types/sheet';
import { useRef } from 'react';
import { useSkillsCatalog } from '../hooks/useSkillsCatalog';


// ИЗМЕНЕНИЕ: Добавлена категория "Валюта"
const CATEGORIES: Array<{ id: InventoryCategoryId; label: string; icon: string }> = [
  { id: 'gear', label: 'Снаряжение', icon: 'fa solid fa-shield-halved' },
  { id: 'weapon', label: 'Оружие', icon: 'ri-sword-fill' },
  { id: 'consumable', label: 'Расходники', icon: 'fa-solid fa-bottle-droplet' },
  { id: 'magic', label: 'Магия', icon: 'fa-solid fa-wand-magic-sparkles' },
  { id: 'tools', label: 'Инструменты', icon: 'fa-solid fa-screwdriver-wrench' },
  { id: 'quest', label: 'Квестовые', icon: 'fa-solid fa-scroll' },
  { id: 'misc', label: 'Разное', icon: 'fa-solid fa-box-open' },
  { id: 'currency', label: 'Валюта', icon: 'fa-solid fa-coins' }, // <-- ВОТ ЭТА СТРОКА
]; // as const;

// Этот массив теперь автоматически включает "Валюту" благодаря ...CATEGORIES
const TAB_CATEGORIES: Array<{ id: InventoryCategoryId | 'all'; label: string; icon: string }> = [
  { id: 'all', label: 'Все', icon: 'fa-solid fa-boxes-stacked' },
  ...CATEGORIES,
];


const LEVELS = Array.from({ length: 10 }, (_, i) => i + 1);

// НОВЫЙ ТИП: Запись в истории повышений уровня
type LevelUpHistoryEntry = {
  level: number;
  timestamp: number;
  healthIncrease: number;
  d8Roll?: number;
  gainedSkillName?: string;
  gainedStatPoints?: number;
};

// Таблица необходимого опыта для каждого уровня (с 1-го по 10-й)
const XP_REQUIREMENTS = [5, 10, 15, 25, 35, 45, 60, 80, 100, 120];

// ... (вспомогательные функции без изменений)
const resolveIconClass = (icon?: string, fallback = 'fa-solid fa-star'): string => {
  if (!icon) return fallback;
  const trimmed = icon.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith('ri-')) return trimmed;
  if (trimmed.startsWith('fa-') || trimmed.includes(' ')) return trimmed;
  return `fa-solid ${trimmed}`;
};

const getAttackIcon = (itemName: string, suggestions: SkillCatalogEntry[]): string => {
  const lowerItemName = itemName.toLowerCase();
  const defaultIcon = 'fa-solid fa-sword';

  const foundByKeyword = suggestions.find((skill) =>
    skill.keywords?.some((keyword) => lowerItemName.includes(keyword)),
  );

  if (foundByKeyword?.icon) {
    return resolveIconClass(foundByKeyword.icon, defaultIcon);
  }

  return defaultIcon;
};

const getHealthClass = (pct: number): string => {
  if (pct > 70) return 'is-high';
  if (pct > 30) return 'is-medium';
  return 'is-low';
};


const CharacterSheetPage: React.FC = () => {
  const navigate = useNavigate();
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    // ... (useEffect для auth без изменений)
    const script = document.createElement('script');
    script.src = "https.kit.fontawesome.com/your-kit-id.js"; // Replace with your kit ID
    script.crossOrigin = "anonymous";
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // Local storage backed states
  // ... (без изменений)
  const sheetStore = useLocalStorage<CharacterSheet>(SHEET_KEY, {
    statPoints: 0
  });
  const skillsStore = useLocalStorage<Skill[]>(SKILLS_KEY, []);
  const invStore = useLocalStorage<InventoryItem[]>(INVENTORY_KEY, []);
  const attacksStore = useLocalStorage<AttacksState>(ATTACKS_KEY, {});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const toastTimerRef = useRef<number | undefined>(undefined);

  // Form fields
  // ... (остальные поля без изменений)
  const [name, setName] = useState('');
  const [race, setRace] = useState('');
  const [charLevel, setCharLevel] = useState<number | ''>(1); // Установим 1 по умолчанию
  const [speed, setSpeed] = useState<number | ''>('');
  const [ac, setAc] = useState<number | ''>('');
  const [expCurrent, setExpCurrent] = useState<number | ''>('');
  const [expMax, setExpMax] = useState<number | ''>(XP_REQUIREMENTS[0]); // Установим для 1-го уровня
  const [healthCurrent, setHealthCurrent] = useState<number | ''>('');
  const [healthMax, setHealthMax] = useState<number | ''>('');
  const [manaCurrent, setManaCurrent] = useState<number | ''>('');
  const [manaMax, setManaMax] = useState<number | ''>('');
  const [isInvitesModalOpen, setInvitesModalOpen] = useState(false);
  const [isSkillsModalOpen, setSkillsModalOpen] = useState(false);
  const [isStatsCollapsed, setIsStatsCollapsed] = useState(false);
  const [statPoints, setStatPoints] = useState(0); 

  const [inspiration, setInspiration] = useState<number | ''>('');
  // НОВОЕ: Состояние для истории и модального окна
  const [levelUpHistory, setLevelUpHistory] = useState<LevelUpHistoryEntry[]>([]);
  const [isHistoryModalOpen, setHistoryModalOpen] = useState(false);

  // Death save modal state
  // ... (без изменений)
  const [deathModalOpen, setDeathModalOpen] = useState(false);
  const [deathSuccesses, setDeathSuccesses] = useState(0);
  const [deathFailures, setDeathFailures] = useState(0);
  const [isDeathRolling, setIsDeathRolling] = useState(false);
  const [deathRollDisplay, setDeathRollDisplay] = useState<number | null>(null);

  // Stats
  // ... (без изменений)
  const STATS_DEFAULT: StatsState = {
    strength: new Array(10).fill(false),
    dexterity: new Array(10).fill(false),
    intellect: new Array(10).fill(false),
    constitution: new Array(10).fill(false),
    charisma: new Array(10).fill(false),
    perception: new Array(10).fill(false),
    wisdom: new Array(10).fill(false),
    luck: new Array(10).fill(false),
  };
  const statsStore = useLocalStorage<StatsState>(STATS_KEY, STATS_DEFAULT);
  
  // ИЗМЕНЕНИЕ: `stats` - это ПОДТВЕРЖДЕННЫЕ, `pendingStats` - то, что в UI
  const [stats, _setStats] = useState<StatsState>(statsStore.value || STATS_DEFAULT);
  const [pendingStats, setPendingStats] = useState<StatsState>(statsStore.value || STATS_DEFAULT);

  // `setStats` теперь обновляет оба состояния (используется при загрузке)

  // Skills
  // ... (без изменений)
  const { catalog: skillCatalog, loading: catalogLoading } = useSkillsCatalog();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [suggestions, setSuggestions] = useState<SkillCatalogEntry[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);

  // Inventory + attacks
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [attacks, setAttacks] = useState<AttacksState>({});
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [inventoryView, setInventoryView] = useState<'list' | 'form'>('list');
  const [activeInventoryCategory, setActiveInventoryCategory] = useState<InventoryCategoryId | 'all'>('all');
  const [itemForm, setItemForm] = useState({
    name: '',
    category: 'gear' as InventoryCategoryId,
    quantity: 1,
    weight: 0, // НОВОЕ ПОЛЕ
    note: '',
    system: false,
    hasAttack: false,
  });
  const [itemFormError, setItemFormError] = useState<string | null>(null);
  const [attackDraft, setAttackDraft] = useState<AttackFields>({ bonus: '', damage: '', type: '', range: '', properties: '' });

  function resetAndShowList() {
    // ... (без изменений)
    setInventoryView('list');
    setEditingItem(null);
    setItemForm({
      name: '',
      category: 'gear' as InventoryCategoryId,
      quantity: 1,
      weight: 0,
      note: '',
      system: false,
      hasAttack: false,
    });
    setItemFormError(null);
    setAttackDraft(defaultAttackFor(''));
  }

  function openInventory() {
    setIsInventoryOpen(true);
    setInventoryView('list');
    setActiveInventoryCategory('all');
  }

  function closeInventory() {
    setIsInventoryOpen(false);
    resetAndShowList();
    setActiveInventoryCategory('all');
  }

  function openItemFormForAdd() {
    // ... (без изменений)
    setEditingItem(null);
    setItemForm({
      name: '',
      category: 'gear' as InventoryCategoryId,
      quantity: 1,
      weight: 0,
      note: '',
      system: false,
      hasAttack: false,
    });
    setItemFormError(null);
    setAttackDraft(defaultAttackFor(''));
    setInventoryView('form');
  }
  
  function editItem(item: InventoryItem) {
    // ... (без изменений)
    setEditingItem(item);
    setItemForm({
      name: item.name,
      category: item.category || 'gear',
      quantity: item.quantity,
      weight: item.weight || 0,
      note: item.note || '',
      system: item.system ?? false,
      hasAttack: item.hasAttack ?? false,
    });
    setAttackDraft(attacks[item.id] || defaultAttackFor(item.name));
    setInventoryView('form');
  }

  function handleItemFormChange(field: keyof typeof itemForm, value: any) {
    // ... (без изменений)
    setItemForm(prev => ({ ...prev, [field]: value }));
    if (field === 'name') setItemFormError(null);
  }

  function handleItemSubmit(e: React.FormEvent) {
    // ... (логика submit без изменений)
    e.preventDefault();
    const name = itemForm.name.trim();
    if (!name) { setItemFormError('Введите название предмета'); return; }
    const qty = Math.max(1, Math.round(itemForm.quantity || 1));

    if (editingItem) {
      // Update existing item
      const updatedItem = { ...editingItem, ...itemForm, quantity: qty };
      setItems(items.map(it => it.id === editingItem.id ? updatedItem : it));
      if (updatedItem.hasAttack) {
        setAttacks(prev => ({ ...prev, [updatedItem.id]: { ...(attacks[updatedItem.id] || {}), ...attackDraft } }));
      } else if (attacks[updatedItem.id]) {
        setAttacks(prev => {
          const cp = { ...prev };
          delete cp[updatedItem.id];
          return cp;
        });
      }
    } else {
      // Add new item
      const newItem: InventoryItem = {
        id: createId('inv'),
        ...itemForm,
        quantity: qty,
      };
      setItems(prev => [...prev, newItem]);
      if (newItem.hasAttack) {
        const data = attackDraft.damage ? attackDraft : { ...defaultAttackFor(newItem.name) };
        setAttacks(prev => ({ ...prev, [newItem.id]: data }));
      }
    }

    resetAndShowList();
  }

  function removeItem(e: React.MouseEvent, id: string) {
    // ... (без изменений)
    e.stopPropagation();
    setItems((prev) => prev.filter((i) => i.id !== id));
    setAttacks((prev) => {
      const cp = { ...prev };
      delete cp[id];
      return cp;
    });
  }

  function changeQty(e: React.MouseEvent, id: string, delta: number) {
    // ... (без изменений)
    e.stopPropagation();
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i)));
  }

  // Combat invites module
  // ... (без изменений)
  type CombatInvite = { id: string; path?: string; combatId: string; characterId?: string; characterName?: string; status: 'pending'|'accepted'|'declined' };
  const [combatInvites, setCombatInvites] = useState<CombatInvite[]>([]);
  useEffect(() => {
    // ... (useEffect для invites без изменений)
    if (!user) { setCombatInvites([]); return; }
    const userInvPath = collection(db, 'userInvites', user.uid, 'items');
    const unsub = onSnapshot(userInvPath, (snap) => {
      const list: CombatInvite[] = snap.docs.map((d) => ({
        id: d.id,
        combatId: (d.data() as any).combatId,
        characterId: (d.data() as any).characterId,
        characterName: (d.data() as any).characterName,
        status: (d.data() as any).status || 'pending',
        path: (d.data() as any).invitePath || undefined,
      }));
      setCombatInvites(list);
    });
    return () => unsub();
  }, [user]);

  const acceptInvite = async (invite: CombatInvite) => {
    // ... (без изменений)
    try {
      await updateDoc(doc(db, 'userInvites', user!.uid, 'items', invite.id), { status: 'accepted' });
      if (invite.path) {
        await updateDoc(doc(db, invite.path), { status: 'accepted' });
      }
      if (invite.combatId) navigate(`/p-combat/${invite.combatId}`);
    } catch (e) {
      console.error('accept invite failed', e);
    }
  };
  const declineInvite = async (invite: CombatInvite) => {
    // ... (без изменений)
    try {
      await updateDoc(doc(db, 'userInvites', user!.uid, 'items', invite.id), { status: 'declined' });
      if (invite.path) {
        await updateDoc(doc(db, invite.path), { status: 'declined' });
      }
    } catch (e) {
      console.error('decline invite failed', e);
    }
  };

  const clearInvites = async () => {
    // ... (без изменений)
    try {
      if (!user) return;
      const ops = combatInvites.map(async (inv) => {
        try {
          await deleteDoc(doc(db, 'userInvites', user.uid, 'items', inv.id));
          if (inv.path) {
            await updateDoc(doc(db, inv.path), { status: 'declined' });
          }
        } catch {}
      });
      await Promise.all(ops);
    } catch (e) {
      console.error('clear invites failed', e);
    }
  };

  // Load skills catalog
  // ... (без изменений)
  useEffect(() => {
    if (skillCatalog.length) {
      setSuggestions(skillCatalog);
    }
  }, [skillCatalog]);

  useEffect(() => {
    // ... (логика загрузки skills.json без изменений)
    if (catalogLoading || skillCatalog.length) return;
    let ignore = false;
    const loadFallback = async () => {
      try {
        const res = await fetch('/assets/skills.json', { cache: 'no-store' });
        if (!res.ok) throw new Error('failed');
        const raw = (await res.json()) as Array<Partial<SkillCatalogEntry>>;
        if (ignore) return;
        // ИСПРАВЛЕНИЕ: Мы не знаем тип, поэтому приводим к any
        const normalized = raw.map((entry, idx) => ({ 
          id: entry.id || createId(`skill-${idx}`),
          name: entry.name || ' ',
          description: entry.description,
          icon: entry.icon,
          requiredExp: entry.requiredExp,
          perks: Array.isArray(entry.perks) ? entry.perks : undefined,
          keywords: Array.isArray(entry.keywords) ? entry.keywords : undefined,
          rank: typeof entry.rank === 'string' ? entry.rank : undefined,
          // ИСПРАВЛЕНИЕ: Добавляем hasAttack и attack из GmSkillsPage.tsx
          hasAttack: typeof (entry as any).hasAttack === 'boolean' ? (entry as any).hasAttack : false,
          attack: typeof (entry as any).attack === 'object' ? (entry as any).attack : undefined,
          branches: [],
        }));
        setSuggestions(normalized as any); // Приводим к any, чтобы соответствовать SkillCatalogEntry
      } catch (err) {
        console.error('skills fallback load failed', err);
        if (!ignore) setSuggestions([]);
      }
    };
    loadFallback();
    return () => {
      ignore = true;
    };
  }, [catalogLoading, skillCatalog.length]);

// Derived bars
  // ... (без изменений)
  const healthPct = useMemo(() => {
    const cur = Number(healthCurrent || 0);
    const max = Math.max(1, Number(healthMax || 1));
    return Math.max(0, Math.min(100, Math.round((cur / max) * 100)));
  }, [healthCurrent, healthMax]);
  const manaPct = useMemo(() => {
    const cur = Number(manaCurrent || 0);
    const max = Math.max(1, Number(manaMax || 1));
    return Math.max(0, Math.min(100, Math.round((cur / max) * 100)));
  }, [manaCurrent, manaMax]);
  const expPct = useMemo(() => {
    const cur = Number(expCurrent || 0);
    const max = Math.max(1, Number(expMax || 1));
    return Math.max(0, Math.min(100, Math.round((cur / max) * 100)));
  }, [expCurrent, expMax]);

  // Эффект для синхронизации expMax с текущим уровнем
  useEffect(() => {
    const currentLevel = Number(charLevel || 1);
    // Уровни 1-10 соответствуют индексам 0-9
    if (currentLevel >= 1 && currentLevel <= 10) {
      const correctMaxExp = XP_REQUIREMENTS[currentLevel - 1];
      
      // Устанавливаем, только если отличается, чтобы избежать лишних ре-рендеров
      if (Number(expMax || 0) !== correctMaxExp) {
        setExpMax(correctMaxExp);
      }
    }
  }, [charLevel, expMax]); // Зависит от уровня и expMax

  // Эффект для проверки и обработки повышения уровня (с d8, +навык и +очки статов)
  useEffect(() => {
    const currentLevel = Number(charLevel || 1);
    const currentExp = Number(expCurrent || 0);
    const maxExp = Number(expMax || 1); // Берем maxExp из состояния

    // Проверяем условие повышения уровня (и что не достигнут макс. уровень 10)
    if (currentExp >= maxExp && currentLevel < 10) {
      
      // 1. Рассчитываем "лишний" опыт
      const leftoverExp = currentExp - maxExp;

      // 2. Определяем новый уровень
      const newLevel = currentLevel + 1;
      
      // 3. Считаем Телосложение (количество "заполненных" ячеек)
      // ИЗМЕНЕНИЕ: Считаем по `stats` (подтвержденным), а не `pendingStats`
      const constitutionScore = stats.constitution.filter(Boolean).length;

      // 4. Рассчитываем прирост ХП и готовим уведомление
      let healthIncrease = constitutionScore;
      let d8Roll = 0;

      // Готовим запись для истории
      const historyEntry: LevelUpHistoryEntry = {
        level: newLevel,
        timestamp: Date.now(),
        healthIncrease: 0, // будет обновлено ниже
        gainedStatPoints: 0,
      };

      let toastMessage = `Уровень повышен! Новый уровень: ${newLevel}. +${constitutionScore} ХП.`;
      
      let newSkill: Skill | null = null; // Для хранения нового навыка
      let addedStatPoints = 0; // Для очков характеристик

      // Проверяем, если НОВЫЙ уровень - 5 или 10
      if (newLevel === 5 || newLevel === 10) {
        // --- Логика ХП ---
        d8Roll = Math.floor(Math.random() * 8) + 1; // Бросок d8
        healthIncrease += d8Roll;
        toastMessage = `Уровень ${newLevel}! +${constitutionScore} (Тел.) и +${d8Roll} (d8) к макс. ХП!`;
        historyEntry.d8Roll = d8Roll;

        // --- Логика Очков Характеристик ---
        addedStatPoints = 2;
        toastMessage += ` Вы получили +2 очка характеристик!`;
        historyEntry.gainedStatPoints = addedStatPoints;

        // --- Логика выдачи навыка ---
        const eligibleRanks = ['F-', 'F', 'F+'];
        const eligibleSkills = suggestions.filter(skill => 
            eligibleRanks.includes(skill.rank || '')
        );
        const currentSkillNames = skills.map(s => (s.name || '').toLowerCase());
        const finalEligibleSkills = eligibleSkills.filter(s => 
            !currentSkillNames.includes(s.name.toLowerCase())
        );

        if (finalEligibleSkills.length > 0) {
            const randomIndex = Math.floor(Math.random() * finalEligibleSkills.length);
            // ИСПРАВЛЕНИЕ: Приводим к 'any'
            const randomSkill = finalEligibleSkills[randomIndex] as any; 

            newSkill = {
                name: randomSkill.name,
                description: randomSkill.description,
                icon: randomSkill.icon,
                requiredExp: randomSkill.requiredExp ?? 100,
                expCurrent: 0,
                expMax: randomSkill.requiredExp ?? 100,
                perks: randomSkill.perks,
                keywords: randomSkill.keywords,
                rank: randomSkill.rank,
                // ИСПРАВЛЕНИЕ: Добавляем hasAttack / attack
                ...(randomSkill.hasAttack && { hasAttack: randomSkill.hasAttack }),
                ...(randomSkill.attack && { attack: randomSkill.attack }),
                branches: [],
            } as any; // ИСПРАВЛЕНИЕ: Приводим к 'any'
            
            // ИСПРАВЛЕНИЕ: Проверка, что newSkill не null
            if (newSkill) {
              toastMessage += ` Вы получили навык: ${newSkill.name}!`;
              historyEntry.gainedSkillName = newSkill.name;
            }
        } else {
          toastMessage += ` (Все F-навыки уже изучены!)`;
        }
      }

      // Обновляем итоговый прирост здоровья в истории
      historyEntry.healthIncrease = healthIncrease;

      // 5. Обновляем состояния
      setCharLevel(newLevel); // Повышаем уровень
      setExpCurrent(leftoverExp); // Устанавливаем "сдачу" опыта
      setHealthMax(h => (Number(h || 0)) + healthIncrease); // Повышаем Макс. ХП
      
      if (newSkill) { // Если навык был создан
          setSkills(prev => [...prev, newSkill!]); // Добавляем его в список
      }
      if (addedStatPoints > 0) {
        setStatPoints(prev => prev + addedStatPoints); // Добавляем очки
      }
      setLevelUpHistory(prev => [historyEntry, ...prev]); // Добавляем запись в историю

      // 6. Показываем уведомление
      setToast({ type: 'success', text: toastMessage });
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToast(null), 5000); // Увеличим время
    }
    
    // Добавляем 'suggestions' и 'skills' в зависимости, т.к. мы их читаем
  }, [expCurrent, expMax, charLevel, stats.constitution, suggestions, skills, statPoints]);

  // Death save helpers
  // ... (без изменений)
  const resetDeathSaves = () => {
    setDeathSuccesses(0);
    setDeathFailures(0);
    setIsDeathRolling(false);
    setDeathRollDisplay(null);
  };

  const startDeathRoll = () => {
    // ... (логика броска без изменений)
    if (isDeathRolling) return;
    setIsDeathRolling(true);
    const start = Date.now();
    const anim = window.setInterval(() => {
      setDeathRollDisplay(Math.floor(Math.random() * 20) + 1);
      if (Date.now() - start > 2000) {
        window.clearInterval(anim);
        const result = Math.floor(Math.random() * 20) + 1;
        setDeathRollDisplay(result);
        setTimeout(() => {
          setIsDeathRolling(false);
          if (result === 1) {
            setDeathFailures((f) => Math.min(3, f + 2));
          } else if (result === 20) {
            setDeathSuccesses((s) => Math.min(3, s + 2));
          } else if (result > 10) {
            setDeathSuccesses((s) => Math.min(3, s + 1));
          } else {
            setDeathFailures((f) => Math.min(3, f + 1));
          }
        }, 200);
      }
    }, 60);
  };

  // React to completion of death saves
  // ... (без изменений)
  useEffect(() => {
    if (!deathModalOpen) return;
    if (deathSuccesses >= 3) {
      setHealthCurrent(1);
      resetDeathSaves();
      setDeathModalOpen(false);
      setToast({ type: 'success', text: 'Спасбросок успешен: +1 ХП' });
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToast(null), 2500);
    } else if (deathFailures >= 3) {
      setToast({ type: 'error', text: 'Ваш персонаж мёртв. Сообщите мастеру.' });
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToast(null), 4000);
    }
  }, [deathSuccesses, deathFailures, deathModalOpen]);

  // Ensure modal closes on three failures as well
  // ... (без изменений)
  useEffect(() => {
    if (deathModalOpen && deathFailures >= 3) {
      resetDeathSaves();
      setDeathModalOpen(false);
    }
  }, [deathFailures, deathModalOpen]);

  // Load state from localStorage once
  // ... (логика загрузки без изменений)
  useEffect(() => {
    // ИСПРАВЛЕНИЕ: Приводим 's' к 'any'
    const s = sheetStore.value as any; 
    if (s) {
      setName(s.name || '');
      setRace(s.race || '');
      setCharLevel(s.charLevel ?? 1); // Изменено
      setSpeed(s.speed ?? '');
      setAc(s.ac ?? '');
      setExpCurrent(s.expCurrent ?? '');
      // expMax установится сам из хука на основе charLevel
      setInspiration(s.inspiration ?? '');
      setHealthCurrent(s.healthCurrent ?? '');
      setHealthMax(s.healthMax ?? '');
      if (typeof s.manaCurrent !== 'undefined') setManaCurrent(s.manaCurrent ?? '');
      if (typeof s.manaMax !== 'undefined') setManaMax(s.manaMax ?? '');
      if (Array.isArray(s.skills)) setSkills(s.skills);
      if (Array.isArray(s.inventory)) setItems(s.inventory);
      if (s.attacks) setAttacks(s.attacks);
      if (s.stats) {
 _setStats(s.stats as StatsState); // Загружаем в постоянные
 setPendingStats(s.stats as StatsState); // И в "ожидающие"
      }
      setStatPoints(s.statPoints || 0); 
      // ИСПРАВЛЕНИЕ: Читаем levelUpHistory
      if (Array.isArray(s.levelUpHistory)) setLevelUpHistory(s.levelUpHistory);
    }
    if (skillsStore.value?.length) setSkills(skillsStore.value);
    if (invStore.value?.length) setItems(invStore.value);
    if (attacksStore.value && Object.keys(attacksStore.value).length) setAttacks(attacksStore.value);
    
    // Убедимся, что expMax корректен при первой загрузке
    const loadedLevel = Number(s?.charLevel || 1);
    if (loadedLevel >= 1 && loadedLevel <= 10) {
      setExpMax(XP_REQUIREMENTS[loadedLevel - 1]);
    } else {
      setExpMax(XP_REQUIREMENTS[0]); // По умолчанию для 1-го уровня
    }
    
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    skillsStore.set(skills);
  }, [skills]);
  useEffect(() => {
    invStore.set(items);
  }, [items]);
  useEffect(() => {
    attacksStore.set(attacks);
  }, [attacks]);

  // ИЗМЕНЕНИЕ: Синхронизируем localStorage для `stats`
  useEffect(() => {
    statsStore.set(stats);
  }, [stats]);


  useEffect(() => {
    // ... (логика maybeLoad без изменений)
    const isEmpty = () => {
      const s = sheetStore.value;
      if (!s) return true;
      if (s.name || s.race) return false;
      if (Array.isArray(s.skills) && s.skills.length) return false;
      if (Array.isArray(s.inventory) && s.inventory.length) return false;
      if (s.stats) {
        return !Object.values(s.stats).some((arr) => Array.isArray(arr) && arr.some(Boolean));
      }
      return true;
    };
    const maybeLoad = async () => {
      if (!user || !isEmpty()) return;
      const ref = doc(db, 'characterSheets', user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        // ИСПРАВЛЕНИЕ: Приводим sheet к 'any'
        const data = snap.data() as { sheet?: any }; 
        if (data?.sheet) {
          sheetStore.set(data.sheet);
          setTimeout(() => {
            // ИСПРАВЛЕНИЕ: Приводим s к 'any'
            const s = data.sheet as any;
            setName(s.name || '');
            setRace(s.race || '');
            setCharLevel(s.charLevel ?? 1); // Изменено
            setSpeed(s.speed ?? '');
            setAc(s.ac ?? '');
            setExpCurrent(s.expCurrent ?? '');
            setInspiration(s.inspiration ?? '');
            // expMax установится из хука
            setHealthCurrent(s.healthCurrent ?? '');
            setHealthMax(s.healthMax ?? '');
            setManaCurrent(s.manaCurrent ?? '');
            setManaMax(s.manaMax ?? '');
            if (s.stats) {
              _setStats(s.stats as StatsState); // Загружаем в постоянные
              setPendingStats(s.stats as StatsState); // И в "ожидающие"
            }
            if (Array.isArray(s.skills)) setSkills(s.skills);
            if (Array.isArray(s.inventory)) setItems(s.inventory);
            if (s.attacks) setAttacks(s.attacks);
            setStatPoints(s.statPoints ?? 0);
            // ИСПРАВЛЕНИЕ: Читаем levelUpHistory
            if (Array.isArray(s.levelUpHistory)) setLevelUpHistory(s.levelUpHistory);
          }, 0);
        }
      }
    };
    maybeLoad();
  }, [user]);

  // ИЗМЕНЕНИЕ: Новая логика "планирования" очков
  function stageStatChange(key: StatKey, index: number, checked: boolean) {
    const permanentLevel = stats[key].filter(Boolean).length;
    const newPendingLevel = checked ? index + 1 : index;

    // 1. Запрещаем убирать УЖЕ вкачанные очки
    if (newPendingLevel < permanentLevel) {
      return; // Do nothing
    }

    // 2. Считаем, сколько очков УЖЕ запланировано потратить на ДРУГИЕ статы
    let otherPendingCost = 0;
    for (const k of Object.keys(pendingStats)) {
      const statKey = k as StatKey;
      if (statKey === key) continue; // Пропускаем стат, который меняем сейчас
      
      const pendingLvl = pendingStats[statKey]?.filter(Boolean).length || 0;
      const permanentLvl = stats[statKey]?.filter(Boolean).length || 0;
      otherPendingCost += (pendingLvl - permanentLvl);
    }

    // 3. Считаем, сколько очков будет стоить ЭТО изменение
    const thisChangeCost = newPendingLevel - permanentLevel;
    
    // 4. Проверяем, хватает ли очков
    const totalCost = otherPendingCost + thisChangeCost;
    
    if (totalCost > statPoints) {
      setToast({ type: 'error', text: 'Недостаточно очков характеристик!' });
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToast(null), 2500);
      return;
    }

    // 5. Все проверки пройдены, обновляем "ожидающие" статы
    setPendingStats((prev: StatsState) => {
        const next = { ...prev };
        const arr = [...(next[key] || [])];
        if (checked) {
            for (let i = 0; i <= index; i++) arr[i] = true;
        } else {
            // Это сработает, только если newPendingLevel >= permanentLevel
            // (т.е. убираем "ожидающее", а не "постоянное" очко)
            for (let i = index; i < arr.length; i++) arr[i] = false;
        }
        next[key] = arr;
        return next;
    });
  }

  // НОВОЕ: Считаем, сколько очков "ожидает" подтверждения
  const pendingStatCost = useMemo(() => {
    let totalPendingCost = 0;
    if (!stats || !pendingStats) return 0; // На случай инициализации
    
    for (const k of Object.keys(pendingStats)) {
        const key = k as StatKey;
        const pendingLevel = pendingStats[key]?.filter(Boolean).length || 0;
        const permanentLevel = stats[key]?.filter(Boolean).length || 0;
        totalPendingCost += (pendingLevel - permanentLevel);
    }
    return totalPendingCost;
  }, [stats, pendingStats]);

  // НОВОЕ: Расчет пассивной внимательности
  const passivePerception = useMemo(() => {
    const perceptionScore = stats.perception.filter(Boolean).length;
    return 10 + perceptionScore;
  }, [stats.perception]);

  // НОВОЕ: Кнопка "Подтвердить"
  function confirmStatChanges() {
    if (pendingStatCost > statPoints) {
      setToast({ type: 'error', text: 'Ошибка: Недостаточно очков!' });
      return;
    }
    if (pendingStatCost === 0) return;

    // 1. Тратим очки
    setStatPoints(prev => prev - pendingStatCost);
    // 2. Делаем "ожидающие" статы "постоянными"
    _setStats(pendingStats); 
    // 3. Обновляем `statsStore` (уже делается `useEffect`-ом на `stats`)
    
    setToast({ type: 'success', text: 'Характеристики подтверждены!' });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2500);
  }

  // НОВОЕ: Кнопка "Отмена"
  function cancelStatChanges() {
    // Просто сбрасываем "ожидающие" статы до "постоянных"
    setPendingStats(stats);
  }


  function addSkill(nameStr: string) {
    // ... (без изменений)
    const v = nameStr.trim();
    if (!v) return;
    setSkills((prev) => {
      if (prev.some((s) => (s.name || '').toLowerCase() === v.toLowerCase())) return prev;
      const match = suggestions.find((s) => s.name.toLowerCase() === v.toLowerCase());
      // ИСПРАВЛЕНИЕ: Приводим match к 'any'
      const matchAsAny = match as any;
      const base: Skill = {
        name: match?.name || v,
        description: match?.description,
        icon: match?.icon,
        requiredExp: match?.requiredExp ?? 100,
        expCurrent: 0,
        expMax: match?.requiredExp ?? 100,
        perks: match?.perks,
        keywords: match?.keywords,
        rank: match?.rank,
        // ИСПРАВЛЕНИЕ: Добавляем hasAttack / attack
        ...(matchAsAny?.hasAttack && { hasAttack: matchAsAny.hasAttack }),
        ...(matchAsAny?.attack && { attack: matchAsAny.attack }),
        branches: [],
      } as any; // ИСПРАВЛЕНИЕ: Приводим к 'any'
      return [...prev, base];
    });
    setSkillInput('');
  }

  function removeSkill(idx: number) {
    // ... (без изменений)
    setSkills((prev) => prev.filter((_, i) => i !== idx));
  }

  function upsertBranch(skillIdx: number) {
    // ... (без изменений)
    setSkills((prev) => {
      const cp = [...prev];
      const s = { ...cp[skillIdx] };
      s.branches = s.branches?.length ? [...s.branches] : [];
      if (!s.branches[0]) s.branches[0] = { title: '', note: '' };
      cp[skillIdx] = s;
      return cp;
    });
  }

  const [perksModal, setPerksModal] = useState<{ open: boolean; sIdx: number | null }>(() => ({ open: false, sIdx: null }));
  function openPerks(idx: number) {
    // ... (без изменений)
    upsertBranch(idx);
    setPerksModal({ open: true, sIdx: idx });
  }
  function closePerks() {
    // ... (без изменений)
    setPerksModal({ open: false, sIdx: null });
  }
  function savePerksRoll(rolls: number[]) {
    // ... (без изменений)
    if (!perksModal.open || perksModal.sIdx == null) return;
    const sIdx = perksModal.sIdx;
    setSkills((prev) => {
      const cp = [...prev];
      const s = { ...cp[sIdx] };
      const perks = s.perks || [];
      const b0 = s.branches?.[0] || { title: '', note: '' };
      let state = Array.isArray(b0.perksState) ? [...b0.perksState] : new Array(perks.length).fill(false);
      while (state.length < perks.length) state.push(false);
      rolls.forEach((r) => {
        if (Number.isInteger(r) && r >= 1 && r <= perks.length) state[r - 1] = true;
      });
      const updatedBranch = { ...b0, perksState: state };
      const branches = [...(s.branches || [])];
      branches[0] = updatedBranch;
      s.branches = branches;
      cp[sIdx] = s;
      return cp;
    });
    closePerks();
  }

  async function handleSave() {
    // ИЗМЕНЕНИЕ: Убедимся, что нет неподтвержденных очков
    if (pendingStatCost > 0) {
      setToast({ type: 'error', text: 'Подтвердите или отмените изменения характеристик перед сохранением!' });
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
      return;
    }

    // ИСПРАВЛЕНИЕ: Приводим sheet к 'any'
    const sheet: any = {
      name,
      race,
      type: 'normal',
      charLevel: Number(charLevel || 1) || 1,
      speed: Number(speed || 0) || undefined,
      ac: Number(ac || 0) || undefined,
      inspiration: Number(inspiration || 0) || undefined,
      expCurrent: Number(expCurrent || 0) || undefined,
      expMax: Number(expMax || XP_REQUIREMENTS[0]) || XP_REQUIREMENTS[0],
      healthCurrent: Number(healthCurrent || 0) || undefined,
      healthMax: Number(healthMax || 0) || undefined,
      manaCurrent: hasMagicGift ? (Number(manaCurrent || 0) || undefined) : undefined,
      manaMax: hasMagicGift ? (Number(manaMax || 0) || undefined) : undefined,
      stats: stats, // Сохраняем ПОДТВЕРЖДЕННЫЕ статы
      skills,
      inventory: items,
      attacks,
      statPoints: statPoints,
      levelUpHistory: levelUpHistory, // Это поле вызывало ошибку
    };
    sheetStore.set(sheet);
    const sheetPersist = JSON.parse(JSON.stringify(sheet));

    try {
      let currentUser = user;
      if (!currentUser) {
        const cred = await signInWithPopup(auth, googleProvider);
        currentUser = cred.user;
        setUser(cred.user);
      }
      if (!currentUser) return;
      const ref = doc(db, 'characterSheets', currentUser.uid);
      await setDoc(
        ref,
        {
          sheet: sheetPersist,
          displayName: currentUser.displayName || currentUser.email || null,
          ownerEmail: currentUser.email || null,
          ownerUid: currentUser.uid,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setToast({ type: 'success', text: 'Сохранено в облаке' });
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToast(null), 2500);
    } catch (e) {
      console.error('Cloud sync failed', e);
      setToast({ type: 'error', text: 'Ошибка сохранения' });
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
    }
  }

  const [authLoading, setAuthLoading] = useState(false);
  const [cloudLoading, setCloudLoading] = useState(false);
  async function signOutNow() {
    // ... (без изменений)
    try {
      setAuthLoading(true);
      await signOut(auth);
    } finally {
      setAuthLoading(false);
    }
  }

  // Cloud sync state and handler
  async function loadFromCloud() {
    // ... (логика загрузки без изменений)
    try {
      setCloudLoading(true);
      let currentUser = user;
      if (!currentUser) {
        const userCredential = await signInWithPopup(auth, googleProvider);
        currentUser = userCredential.user;
      }
      try {
        if (typeof window !== 'undefined') {
          const ok = window.confirm('Загрузить из облака и перезаписать текущие данные?');
          if (!ok) return;
        }
      } catch {}

      const ref = doc(db, 'characterSheets', currentUser!.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        console.warn('No cloud sheet found');
        return;
      }
      // ИСПРАВЛЕНИЕ: Приводим sheet к 'any'
      const data = snap.data() as { sheet?: any };
      if (!data?.sheet) return;

      sheetStore.set(data.sheet);

      // ИСПРАВЛЕНИЕ: Приводим s к 'any'
      const s = data.sheet as any;
      setName(s.name || '');
      setRace(s.race || '');
      setCharLevel(s.charLevel ?? 1); // Изменено
      setSpeed(s.speed ?? '');
      setAc(s.ac ?? '');
      setExpCurrent(s.expCurrent ?? '');
      setInspiration(s.inspiration ?? '');
      // expMax установится из хука
      setHealthCurrent(s.healthCurrent ?? '');
      setHealthMax(s.healthMax ?? '');
      setManaCurrent(s.manaCurrent ?? '');
      setManaMax(s.manaMax ?? '');
      if (s.stats) {
              _setStats(s.stats as StatsState); // Загружаем в постоянные
              setPendingStats(s.stats as StatsState); // И в "ожидающие"
      }
      if (Array.isArray(s.skills)) setSkills(s.skills);
      if (Array.isArray(s.inventory)) setItems(s.inventory);
      if (s.attacks) setAttacks(s.attacks);
      setStatPoints(s.statPoints ?? 0);
      // ИСПРАВЛЕНИЕ: Читаем levelUpHistory
      if (Array.isArray(s.levelUpHistory)) setLevelUpHistory(s.levelUpHistory);
    } catch (e) {
      console.error('Cloud load failed', e);
    } finally {
      setCloudLoading(false);
    }
  }

  const filteredSuggests = useMemo(() => {
    // ... (без изменений)
    const q = (skillInput || '').toLowerCase().trim();
    if (!q) return [];
    return suggestions.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 8);
  }, [skillInput, suggestions]);

  const filteredItems = useMemo(() => {
    if (activeInventoryCategory === 'all') {
      return items;
    }
    return items.filter(it => it.category === activeInventoryCategory);
  }, [items, activeInventoryCategory]);

  const hasMagicGift = useMemo(() => {
    // ... (без изменений)
    const phrase = 'магический дар';
    return skills.some(s => (s?.name || '').toLowerCase().includes(phrase));
  }, [skills]);

  // ИСПРАВЛЕНИЕ: Производное состояние для атак от навыков
  // (Переписано для работы с hasAttack: boolean и attack: SkillAttackData)
  const skillAttacks = useMemo(() => {
    const allAttacks: (SkillAttackData & { id: string, skillName: string, icon?: string })[] = [];
    skills.forEach((skill, skillIndex) => {
      // Приводим к 'any', чтобы обойти ошибку типов
      const s = skill as any; 
      
      // Ищем 'hasAttack: true' и 'attack: { ... }'
      if (s.hasAttack && s.attack) {
        allAttacks.push({
          ...(s.attack as SkillAttackData), // Добавляем все поля из s.attack
          // Генерируем ID, который будет относительно стабилен при ре-рендерах
          id: `skill-${skillIndex}-${s.name}`, 
          skillName: s.name,
          icon: s.icon, // Передаем иконку навыка
        });
      }
    });
    return allAttacks;
  }, [skills]); // Зависит только от списка навыков

  // НОВОЕ: Расчет общего и максимального веса
  const totalWeight = useMemo(() => {
    return items.reduce((total, item) => {
      const itemWeight = Number(item.weight) || 0;
      const itemQuantity = Number(item.quantity) || 1;
      return total + (itemWeight * itemQuantity);
    }, 0);
  }, [items]);

  const maxWeight = useMemo(() => {
    const strengthScore = stats.strength.filter(Boolean).length;
    const constitutionScore = stats.constitution.filter(Boolean).length;
    return 25 + (strengthScore * 15) + (constitutionScore * 15);
  }, [stats.strength, stats.constitution]);

  function updateAttack(itemId: string, key: keyof AttackFields, value: string) {
    // ... (без изменений)
    setAttacks((prev) => ({ ...prev, [itemId]: { ...(prev[itemId] || {}), [key]: value } }));
  }

  return (
    <div className="cs-root">
      {/* ... (Toast, Header без изменений) ... */}
      {toast && (
        <div
          className={`cs-toast cs-toast--${toast.type}`}
          style={{ position: 'fixed', right: 16, bottom: 16, background: toast.type === 'success' ? '#1f3b1f' : '#5a1f1f', color: '#e6ebff', border: '1px solid rgba(255,255,255,.15)', padding: '10px 14px', borderRadius: 10, boxShadow: '0 6px 18px rgba(0,0,0,.35)', zIndex: 1000 }}
        >
          {toast.text}
        </div>
      )}
      <header className="cs-header" style={{ maxWidth: 1500, width: '100%', margin: '0 auto' }}>
        <div>
        </div>
        <Link className="cs-back" to="/">
          <i className="fa-solid fa-arrow-left-long" aria-hidden />
          <span>НАЗАД</span>
        </Link>
      </header>

      <div className="cs-columns">
        {/* Left column */}
        <div className="cs-col-left">
          {/* ... (Auth controls, Primary section, Stats section без изменений) ... */}
          <div className="auth-controls" style={{ alignSelf: 'flex-start' }}>
            {user ? (
              <Fragment>
                <div className="auth-user" style={{ minWidth: 180 }}>
                  <span className="auth-user__name">{user.displayName || user.email}</span>
                  <span className="auth-user__status">онлайн</span>
                </div>
                <button className="auth-button" type="button" onClick={loadFromCloud} disabled={authLoading || cloudLoading} title="Загрузить из облака">
                  <i className="fa-solid fa-cloud-arrow-down" aria-hidden /> Загрузить из облака
                </button>
                <button className="auth-button" type="button" onClick={signOutNow} disabled={authLoading}>
                  <i className="fa-solid fa-right-from-bracket" aria-hidden /> Выйти
                </button>
              </Fragment>
            ) : (<></>)}
          </div>

          <section className="cs-primary">
            <div className="cs-primary-grid">
              {/* Basic fields */}
              <div className="cs-input-group">
                <span className="cs-input-icon" aria-hidden><i className="fa-solid fa-user-pen" /></span>
                <label htmlFor="cs-name">Имя</label>
                <input id="cs-name" type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="cs-input-group">
                <span className="cs-input-icon" aria-hidden><i className="fa-solid fa-paw" /></span>
                <label htmlFor="cs-race">Раса</label>
                <input id="cs-race" type="text" placeholder="Race" value={race} onChange={(e) => setRace(e.target.value)} />
              </div>
              <div className="cs-input-group">
                <span className="cs-input-icon" aria-hidden><i className="fa-solid fa-shoe-prints" /></span>
                <label htmlFor="cs-speed">Скорость</label>
                <div className="cs-number-input-wrapper">
                  <input id="cs-speed" type="number" min={0} placeholder="30" value={String(speed)} onChange={(e) => setSpeed(e.target.value === '' ? '' : Number(e.target.value))} />
                  <div className="cs-number-input-arrows">
                    <button type="button" onClick={() => setSpeed(s => Number(s || 0) + 1)} aria-label="Увеличить скорость"><i className="fa-solid fa-caret-up"></i></button>
                    <button type="button" onClick={() => setSpeed(s => Math.max(0, Number(s || 0) - 1))} aria-label="Уменьшить скорость"><i className="fa-solid fa-caret-down"></i></button>
                  </div>
                </div>
              </div>
              <div className="cs-input-group">
                <span className="cs-input-icon" aria-hidden><i className="fa-solid fa-shield" /></span>
                <label htmlFor="cs-ac">КД</label>
                <div className="cs-number-input-wrapper">
                  <input id="cs-ac" type="number" min={0} placeholder="10" value={String(ac)} onChange={(e) => setAc(e.target.value === '' ? '' : Number(e.target.value))} />
                  <div className="cs-number-input-arrows">
                    <button type="button" onClick={() => setAc(s => Number(s || 0) + 1)} aria-label="Увеличить КД"><i className="fa-solid fa-caret-up"></i></button>
                    <button type="button" onClick={() => setAc(s => Math.max(0, Number(s || 0) - 1))} aria-label="Уменьшить КД"><i className="fa-solid fa-caret-down"></i></button>
                  </div>
                </div>
              </div>
              <div className="cs-progress-card">
                <div className="cs-progress-title"><i className="fa-solid fa-bars-progress" /> Опыт</div>
                <div className="cs-progress-inputs">
                  <div className="cs-number-input-wrapper">
                    <input type="number" min={0} placeholder="1" value={String(expCurrent)} onChange={(e) => setExpCurrent(e.target.value === '' ? '' : Number(e.target.value))} />
                    <div className="cs-number-input-arrows">
                      <button type="button" onClick={() => setExpCurrent(s => Number(s || 0) + 1)} aria-label="Увеличить текущий опыт"><i className="fa-solid fa-caret-up"></i></button>
                      <button type="button" onClick={() => setExpCurrent(s => Math.max(0, Number(s || 0) - 1))} aria-label="Уменьшить текущий опыт"><i className="fa-solid fa-caret-down"></i></button>
                    </div>
                  </div>
                  <span>/</span>
                  <div className="cs-number-input-wrapper">
                    <input type="number" min={1} placeholder="10" value={String(expMax)} onChange={(e) => setExpMax(e.target.value === '' ? '' : Number(e.target.value))} />
                    <div className="cs-number-input-arrows">
                      <button type="button" onClick={() => setExpMax(s => Number(s || 0) + 1)} aria-label="Увеличить максимальный опыт"><i className="fa-solid fa-caret-up"></i></button>
                      <button type="button" onClick={() => setExpMax(s => Math.max(1, Number(s || 0) - 1))} aria-label="Уменьшить максимальный опыт"><i className="fa-solid fa-caret-down"></i></button>
                    </div>
                  </div>
                </div>
                <div className="cs-progress-bar"><div className="cs-progress-filled" style={{ width: `${expPct}%` }} /></div>
                <div className="cs-progress-value">{expPct}%</div>
              </div>
              <div className="cs-input-group">
                <span className="cs-input-icon" aria-hidden><i className="fa-solid fa-arrow-up-wide-short" /></span>
                <label htmlFor="cs-level">Уровень</label>
                <div className="cs-number-input-wrapper">
                  <input id="cs-level" type="number" min={1} placeholder="1" value={String(charLevel)} onChange={(e) => setCharLevel(e.target.value === '' ? '' : Number(e.target.value))} />
                  <div className="cs-number-input-arrows">
                    <button type="button" onClick={() => setCharLevel(s => Number(s || 0) + 1)} aria-label="Увеличить уровень"><i className="fa-solid fa-caret-up"></i></button>
                    <button type="button" onClick={() => setCharLevel(s => Math.max(1, Number(s || 0) - 1))} aria-label="Уменьшить уровень"><i className="fa-solid fa-caret-down"></i></button>
                  </div>
                </div>
              </div>
            </div>
            <div className="cs-resources-grid">
              <div className="cs-progress-card">
                <div className="cs-progress-title"><i className="fa-solid fa-heart-circle-plus" /> Здоровье</div>
                <div className="cs-progress-inputs">
                  <div className="cs-number-input-wrapper">
                    <input type="number" min={0} placeholder="75" value={String(healthCurrent)} onChange={(e) => setHealthCurrent(e.target.value === '' ? '' : Number(e.target.value))} />
                    <div className="cs-number-input-arrows">
                      <button type="button" onClick={() => setHealthCurrent(s => Number(s || 0) + 1)} aria-label="Увеличить текущее здоровье"><i className="fa-solid fa-caret-up"></i></button>
                      <button type="button" onClick={() => setHealthCurrent(s => Math.max(0, Number(s || 0) - 1))} aria-label="Уменьшить текущее здоровье"><i className="fa-solid fa-caret-down"></i></button>
                    </div>
                  </div>
                  <span>/</span>
                  <div className="cs-number-input-wrapper">
                    <input type="number" min={1} placeholder="100" value={String(healthMax)} onChange={(e) => setHealthMax(e.target.value === '' ? '' : Number(e.target.value))} />
                    <div className="cs-number-input-arrows">
                      <button type="button" onClick={() => setHealthMax(s => Number(s || 0) + 1)} aria-label="Увеличить максимальное здоровье"><i className="fa-solid fa-caret-up"></i></button>
                      <button type="button" onClick={() => setHealthMax(s => Math.max(1, Number(s || 0) - 1))} aria-label="Уменьшить максимальное здоровье"><i className="fa-solid fa-caret-down"></i></button>
                    </div>
                  </div>
                </div>
                <div className="cs-progress-bar"><div className={`cs-progress-filled is-health ${getHealthClass(healthPct)}`} style={{ width: `${healthPct}%` }} /></div>
                <div className="cs-progress-value" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {healthPct}%
                  {Number(healthCurrent || 0) <= 0 && (
                    <button
                      type="button"
                      className="btn btn-secondary deathsave-btn"
                      onClick={() => { resetDeathSaves(); setDeathModalOpen(true); }}
                      style={{ marginLeft: 8 }}
                    >
                      <i className="fa-solid fa-skull" /> Спасбросок от смерти
                    </button>
                  )}
                </div>
              </div>
              {hasMagicGift && (
                <div className="cs-progress-card">
                  <div className="cs-progress-title"><i className="fa-solid fa-hat-wizard" /> Мана</div>
                  <div className="cs-progress-inputs">
                    <div className="cs-number-input-wrapper">
                      <input type="number" min={0} placeholder="30" value={String(manaCurrent)} onChange={(e) => setManaCurrent(e.target.value === '' ? '' : Number(e.target.value))} />
                      <div className="cs-number-input-arrows">
                        <button type="button" onClick={() => setManaCurrent(s => Number(s || 0) + 1)} aria-label="Увеличить текущую ману"><i className="fa-solid fa-caret-up"></i></button>
                        <button type="button" onClick={() => setManaCurrent(s => Math.max(0, Number(s || 0) - 1))} aria-label="Уменьшить текущую ману"><i className="fa-solid fa-caret-down"></i></button>
                      </div>
                    </div>
                    <span>/</span>
                    <div className="cs-number-input-wrapper">
                      <input type="number" min={1} placeholder="30" value={String(manaMax)} onChange={(e) => setManaMax(e.target.value === '' ? '' : Number(e.target.value))} />
                      <div className="cs-number-input-arrows">
                        <button type="button" onClick={() => setManaMax(s => Number(s || 0) + 1)} aria-label="Увеличить максимальную ману"><i className="fa-solid fa-caret-up"></i></button>
                        <button type="button" onClick={() => setManaMax(s => Math.max(1, Number(s || 0) - 1))} aria-label="Уменьшить максимальную ману"><i className="fa-solid fa-caret-down"></i></button>
                      </div>
                    </div>
                  </div>
                  <div className="cs-progress-bar"><div className="cs-progress-filled is-mana" style={{ width: `${manaPct}%` }} /></div>
                  <div className="cs-progress-value">{manaPct}%</div>
                </div>
              )}
            </div>
          </section>

          {/* --- ИЗМЕНЕНИЕ: Секция Характеристик --- */}
          <section className="cs-collapsible-section" data-collapsed={isStatsCollapsed}>
            <header
              className="cs-collapsible-header"
              onClick={() => setIsStatsCollapsed(!isStatsCollapsed)}
              aria-expanded={!isStatsCollapsed}
              aria-controls="character-stats-content"
              style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}
            >
              <h2>
                <i className="fa-solid fa-chart-simple" /> Характеристики
              </h2>

              {/* Индикатор очков */}
              {(statPoints > 0 || pendingStatCost > 0) && (
                <span 
                  className="stat-points-badge" 
                  title="Доступные очки характеристик"
                  style={{
                    background: 'linear-gradient(135deg, #fde047, #facc15)',
                    color: '#422006',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontWeight: 700,
                    fontSize: '14px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fa-solid fa-star" /> 
                  {/* Показываем оставшиеся очки */}
                  {statPoints - pendingStatCost}
                </span>
              )}
              
              {/* Кнопки Подтвердить / Отмена */}
              {pendingStatCost > 0 && (
                <div className="stat-confirm-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                   <button 
                    type="button" 
                    className="inventory-cancel-btn"
                    style={{ padding: '6px 10px', fontSize: '12px' }}
                    onClick={(e) => { e.stopPropagation(); cancelStatChanges(); }}
                  >
                    Отмена
                  </button>
                  <button 
                    type="button" 
                    className="skill-add"
                    style={{ padding: '6px 10px', fontSize: '12px', background: 'linear-gradient(135deg, #86efac, #34d399)' }}
                    onClick={(e) => { e.stopPropagation(); confirmStatChanges(); }}
                  >
                    <i className="fa-solid fa-check" /> Подтвердить ({pendingStatCost})
                  </button>
                </div>
              )}

              <span className="cs-collapsible-toggle" aria-hidden="true" style={{ marginLeft: pendingStatCost > 0 ? '8px' : 'auto' }}>
                <i className="fa-solid fa-chevron-down"></i>
              </span>
            </header>
            
            {!isStatsCollapsed && (
              <div id="character-stats-content" className="cs-collapsible-content">
                <div className="cs-stats">
                  <div className="cs-stats-list">
                    {STAT_META.filter((m) => (m.hideWhenNoMagic ? hasMagicGift : true)).map((m) => (
                      <div key={m.key} className="cs-stat">
                        <div className="cs-stat-header">
                          <span className="cs-stat-icon" aria-hidden><i className={m.icon} /></span>
                          <span className="cs-stat-label">{m.label}</span>
                        </div>
                        <div className="cs-stat-levels">
                          {LEVELS.map((lvl, idx) => {
                            // `permanent` - это подтвержденное очко
                            const permanent = !!stats[m.key][idx];
                            // `pending` - это то, что выбрано в UI (может быть permanent ИЛИ новое)
                            const pending = !!pendingStats[m.key][idx];
                            
                            return (
                              <button
                                key={lvl}
                                type="button"
                                className={`
                                  cs-level-btn
                                  ${pending ? ' is-active' : ''}
                                  ${pending && !permanent ? ' is-pending' : ''}
                                  ${permanent ? ' is-permanent' : ''}
                                `}
                                // Вызываем новую функцию `stageStatChange`
                                onClick={() => stageStatChange(m.key, idx, !pending)}
                                aria-pressed={pending}
                                aria-label={`${m.label}: level ${lvl}`}
                                // Запрещаем клик, если очко уже вкачано (на всякий случай)
                                disabled={permanent && !pending}
                              >
                                <span />
                              </button>
                            );
                          })}
                        </div>
                        {m.subskills && (
                          <div className="cs-subskills">
                            {m.subskills.map((sub) => <span key={sub} className="cs-subskill-chip">{sub}</span>)}
                          </div>
                        )}
                      </div>
                    ))}
                    {/* Базовая внимательность */}
                    <div className="cs-stat" style={{ background: 'rgba(10, 18, 34, 0.7)', borderStyle: 'dashed' }}>
                      <div className="cs-stat-header">
                        <span className="cs-stat-icon" style={{ background: 'rgba(120, 160, 255, 0.1)' }}><i className="fa-solid fa-ear-listen" /></span>
                        <span className="cs-stat-label">Базовая внимательность</span>
                        <span className="cs-stat-value">{passivePerception}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right column */}
        <div className="cs-col-right">
          {/* ... (Skills, Inventory, Attacks sections без изменений) ... */}
          <section className="cs-stats" style={{ gap: 14 }}>
            <header className="cs-stats-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>
                <i className="fa-solid fa-book-tanakh" /> Навыки
              </h2>
            </header>
            <button type="button" className="inventory-open-btn" onClick={() => setSkillsModalOpen(true)}>
              <i className="fa-solid fa-book-tanakh" /> Открыть навыки
            </button>
          </section>

          <section className="cs-stats" style={{ gap: 14 }}>
            <header className="cs-stats-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>
                <i className="fa-solid fa-box-open" /> Инвентарь
              </h2>
            </header>
            <button type="button" className="inventory-open-btn" onClick={openInventory} >
            <i className="fa-solid fa-box-open"/> Открыть инвентарь
          </button>
          </section>

          {/* --- ИЗМЕНЕНИЕ: Секция Атак --- */}
          <section className="cs-stats cs-attacks" style={{ gap: 14 }}>
            <header className="cs-stats-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>
                <i className="fa-solid fa-khanda" /> Атаки
              </h2>
            </header>
            <ul className="attacks-list">
              {/* 1. Проверка на пустоту (учитываем оба типа атак) */}
              {items.filter((i) => i.hasAttack).length === 0 && skillAttacks.length === 0 && (
                <li className="inventory-empty">Нет предметов с атакой или атак от навыков.</li>
              )}

              {/* 2. Рендер атак от ПРЕДМЕТОВ (старая логика) */}
              {items.filter((i) => i.hasAttack).map((i) => {
                const attackData = attacks[i.id] || {};
                return (
                  <li key={i.id} className="attack-item">
                    <div className="attack-item__header">
                      <div className="attack-item__icon"><i className={getAttackIcon(i.name, suggestions)} /></div>
                      <span className="attack-item__name">{i.name}</span>
                    </div>
                    <div className="attack-item__main-stats">
                      <input className="attack-stat-input" type="text" placeholder="Бонус" value={attackData.bonus || ''} onChange={(e) => updateAttack(i.id, 'bonus', e.target.value)} aria-label="Бонус атаки" />
                      <input className="attack-stat-input" type="text" placeholder="Урон" value={attackData.damage || ''} onChange={(e) => updateAttack(i.id, 'damage', e.target.value)} aria-label="Урон" />
                      <input className="attack-stat-input" type="text" placeholder="Тип" value={attackData.type || ''} onChange={(e) => updateAttack(i.id, 'type', e.target.value)} aria-label="Тип урона" />
                    </div>
                    <div className="attack-item__props">
                      <input
                        className="attack-prop-input"
                        type="text"
                        placeholder="Дистанция и свойства"
                        value={attackData.range || ''}
                        onChange={(e) => updateAttack(i.id, 'range', e.target.value)}
                        aria-label="Дистанция и свойства"
                      />
                    </div>
                  </li>
                );
              })}

              {/* 3. Рендер атак от НАВЫКОВ (ИСПРАВЛЕННАЯ логика) */}
              {skillAttacks.map((attack) => (
                <li key={attack.id} className="attack-item is-skill-attack"> {/* Новый класс для фиолетового стиля */}
                  <div className="attack-item__header">
                    <div className="attack-item__icon"><i className={resolveIconClass(attack.icon, 'fa-solid fa-wand-magic-sparkles')} /></div>
                    {/* Используем имя навыка как заголовок */}
                    <span className="attack-item__name">{attack.skillName}</span>
                  </div>
                  
                  {/* Основные статы: Урон, Тип, Дистанция */}
                  <div className="attack-item__main-stats">
                    <div className="attack-stat-readonly">
                      <label>Урон</label>
                      <span>{attack.damage || '—'}</span>
                    </div>
                    <div className="attack-stat-readonly">
                      <label>Тип</label>
                      {/* Используем 'damageType' из GmSkillsPage */}
                      <span>{attack.damageType || '—'}</span>
                    </div>
                    <div className="attack-stat-readonly">
                      <label>Дистанция</label>
                      <span>{attack.range || '—'}</span>
                    </div>
                  </div>

                  {/* Вторичные статы: Спасбросок, Время, Стоимость */}
                  {(attack.saveType || attack.castingTime || attack.manaCost) && (
                    <div className="attack-item__secondary-stats">
                      {attack.saveType && (
                        <div className="attack-stat-readonly">
                          <label>Спасбросок</label>
                           {/* Используем 'saveType' из GmSkillsPage */}
                          <span>{attack.saveType}</span>
                        </div>
                      )}
                      {attack.castingTime && (
                        <div className="attack-stat-readonly">
                          <label>Время</label>
                           {/* Используем 'castingTime' из GmSkillsPage */}
                          <span>{attack.castingTime}</span>
                        </div>
                      )}
                      {attack.manaCost && (
                        <div className="attack-stat-readonly">
                          <label>Стоимость</label>
                           {/* Используем 'manaCost' из GmSkillsPage */}
                          <span>{attack.manaCost}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Эффект */}
                  {attack.effect && (
                    <div className="attack-item__props">
                      <div className="attack-prop-readonly">
                        <label>Эффект</label>
                        <p>{attack.effect}</p>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {/* ... (Death Save Modal, Perks modal без изменений) ... */}
      {deathModalOpen && (
        <div className="modal-overlay" onClick={() => { if (!isDeathRolling) setDeathModalOpen(false); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h3>Спасбросок от смерти</h3>
              <button
                className="modal-close-button"
                onClick={() => { if (!isDeathRolling) { setDeathModalOpen(false); } }}
                aria-label="Закрыть"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </header>
            <div className="modal-body">
              <div className="deathsave-layout">
                <div className="deathsave-col deathsave-col--left" aria-label="Провалы">
                  {[0,1,2].map((i) => (
                    <span key={i} className={`deathsave-dot deathsave-dot--fail${i < deathFailures ? ' is-on' : ''}`} />
                  ))}
                </div>
                <button
                  type="button"
                  className={`deathsave-die${isDeathRolling ? ' is-rolling' : ''}`}
                  onClick={startDeathRoll}
                  disabled={isDeathRolling || deathSuccesses >= 3 || deathFailures >= 3}
                  aria-label="Бросить d20"
                >
                  <div className="deathsave-die__inner">
                    <div className="deathsave-die__label">d20</div>
                    <div className="deathsave-die__value">{deathRollDisplay ?? '—'}</div>
                  </div>
                </button>
                <div className="deathsave-col deathsave-col--right" aria-label="Успехи">
                  {[0,1,2].map((i) => (
                    <span key={i} className={`deathsave-dot deathsave-dot--succ${i < deathSuccesses ? ' is-on' : ''}`} />
                  ))}
                </div>
              </div>
              <div className="deathsave-help">Больше 10 — один справа, меньше 10 — один слева. 1 = два слева, 20 = два справа.</div>
            </div>
          </div>
        </div>
      )}

      {perksModal.open && perksModal.sIdx != null && (
        <div className="perks-modal modal-level-2" role="dialog" aria-modal="true" aria-labelledby="perks-modal-title">
          <div className="perks-modal__content">
            <button type="button" className="perks-modal__close" onClick={closePerks} aria-label="Close">
              <i className="fa-solid fa-xmark" />
            </button>
            <div className="perks-modal__header">
              <h3 id="perks-modal-title" className="perks-modal__title"><i className="fa-solid fa-sitemap" /> Выберите перки</h3>
            </div>
            <div className="perks-roll">
              <div className="perks-roll__label"><i className="fa-solid fa-dice" /> Введите результат броска 1d6</div>
              <div className="perks-roll__inputs">
                <label>Перк №
                  <input type="number" min={1} max={(skills[perksModal.sIdx]?.perks || []).length || 1} placeholder={`1..${(skills[perksModal.sIdx]?.perks || []).length || 1}`} id="perk-roll-1" />
                </label>
              </div>
              <div className="perks-roll__hint">От результата броска зависит выпадение перков</div>
            </div>
            <div className="perks-modal__actions">
              <button type="button" className="perks-modal__btn" onClick={closePerks}>Отмена</button>              <button
                type="button"
                className="perks-modal__btn perks-modal__btn--save"
                onClick={() => {
                  const n1 = Number((document.getElementById('perk-roll-1') as HTMLInputElement)?.value || '');
                  const n2 = Number((document.getElementById('perk-roll-2') as HTMLInputElement)?.value || '');
                  const arr = [n1, n2].filter((x) => Number.isFinite(x) && x >= 1);
                  savePerksRoll(arr as number[]);
                }}
              >
                <i className="fa-solid fa-floppy-disk" /> Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Модальное окно инвентаря --- */}
      {isInventoryOpen && (
        <div className="perks-modal" role="dialog" aria-modal="true">
          <div className="perks-modal__content inventory-modal__content">
            <button type="button" className="perks-modal__close" onClick={closeInventory} aria-label="Close">
              <i className="fa-solid fa-xmark" />
            </button>
            <div className="perks-modal__header" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <h3 className="perks-modal__title"><i className="fa-solid fa-backpack" /> Инвентарь</h3>
                {inventoryView === 'list' && (
                  <button type="button" className="inventory-add" onClick={openItemFormForAdd}>
                    <i className="fa-solid fa-plus" /> Добавить предмет
                  </button>
                )}
              </div>
              {/* НОВЫЙ БЛОК: Отображение веса */}
              <div 
                className="inventory-weight-indicator"
                title={`Текущий вес / Максимальный вес`}
                style={{
                  background: totalWeight > maxWeight ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 24, 48, 0.7)',
                  color: totalWeight > maxWeight ? '#fca5a5' : '#a5b4fc',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '14px',
                  border: `1px solid ${totalWeight > maxWeight ? 'rgba(239, 68, 68, 0.4)' : 'rgba(120, 110, 200, 0.3)'}`
                }}
              >
                <i className="fa-solid fa-weight-hanging" style={{ marginRight: '8px' }} />
                {totalWeight.toFixed(2)} / {maxWeight.toFixed(2)} кг
              </div>
            </div>

            <div className="inventory-modal-body" style={{ display: 'block', paddingTop: '16px' }}>

              {/* === ВИД СПИСКА === */}
              {inventoryView === 'list' && (
                <>
                  <div className="inventory-tabs-container">
                    {TAB_CATEGORIES.map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        className={`inventory-tab-btn${activeInventoryCategory === cat.id ? ' is-active' : ''}`}
                        onClick={() => setActiveInventoryCategory(cat.id)}
                      >
                        <i className={resolveIconClass(cat.icon)} />
                        <span>{cat.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="inventory-list-container">
                    <ul className="inventory-list">
                      {filteredItems.length === 0 && <li className="inventory-empty">Пусто</li>}
                      {filteredItems.map((it) => (
                        <li key={it.id} className="inventory-item" onClick={() => editItem(it)} style={{ cursor: 'pointer' }}>
                          <div className="inventory-item-icon">
                            <i className={resolveIconClass(CATEGORIES.find(c => c.id === it.category)?.icon, 'fa-box-open')} />
                          </div>
                          <div className="inventory-item-body">
                            <div className="inventory-item-top">
                              <span className="inventory-item-name">{it.name}</span>
                              <div className="inventory-item-meta">
                                {it.weight > 0 && <span className="inventory-item-weight">{it.weight} кг</span>}
                                <span className="inventory-item-qty">x{it.quantity}</span>
                              </div>
                            </div>
                            {it.note && <p className="inventory-note">{it.note}</p>}
                            <div className="inventory-tags">
                              <span className="inventory-tag">{CATEGORIES.find((c) => c.id === it.category)?.label}</span>
                              {it.system && <span className="inventory-tag inventory-tag--system">Системное</span>}
                              {it.hasAttack && <span className="inventory-tag">Attack</span>}
                            </div>
                          </div>
                          <div className="inventory-item-actions">
                            <div className="inventory-qty-controls">
                              <button type="button" className="inventory-qty-btn" onClick={(e) => changeQty(e, it.id, -1)} aria-label="Decrease quantity">
                                <i className="fa-solid fa-minus" />
                              </button>
                              <span className="inventory-qty-value">x{it.quantity}</span>
                              <button type="button" className="inventory-qty-btn" onClick={(e) => changeQty(e, it.id, 1)} aria-label="Increase quantity">
                                <i className="fa-solid fa-plus" />
                              </button>
                            </div>
                            <button type="button" className="inventory-edit-btn" onClick={(e) => { e.stopPropagation(); editItem(it); }}>
                              <i className="fa-solid fa-pencil" />
                            </button>
                            <button className="inventory-remove" type="button" onClick={(e) => removeItem(e, it.id)}>
                              <i className="fa-solid fa-trash" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
              
              {/* === ВИД ФОРМЫ === */}
              {inventoryView === 'form' && (
                <div className="inventory-form-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <h4>{editingItem ? 'Редактировать предмет' : 'Добавить предмет'}</h4>
                  <form className="inventory-form" onSubmit={handleItemSubmit} style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '0 8px 8px 0' }}>
                    {itemFormError && <div className="gm-hub-error" style={{ marginBottom: 8 }}>{itemFormError}</div>}
                    <div className="inventory-form-grid" style={{ flex: '1 1 auto', minHeight: 0 }}>
                      <div className="inventory-form-group">
                        <label htmlFor="item-name">Название</label>
                        <input id="item-name" className="inventory-field" type="text" placeholder="Название предмета" value={itemForm.name} onChange={(e) => handleItemFormChange('name', e.target.value)} required />
                      </div>
                      <div className="inventory-form-group">
                        <label htmlFor="item-category">Категория</label>
                        <select id="item-category" value={itemForm.category} onChange={(e) => handleItemFormChange('category', e.target.value as InventoryCategoryId)} className="inventory-field">
                          {CATEGORIES.map((c) => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="inventory-form-group">
                        <label htmlFor="item-quantity">Количество</label>
                        <input id="item-quantity" className="inventory-field" type="number" min={1} step={1} value={itemForm.quantity} onChange={(e) => handleItemFormChange('quantity', Math.max(1, Number(e.target.value || 1)))} />
                      </div>
                      <div className="inventory-form-group" style={{gridColumn: '1 / -1'}}>
                        <label htmlFor="item-weight">Вес (кг)</label>
                        <input id="item-weight" className="inventory-field" type="number" min={0} step={0.1} value={itemForm.weight} onChange={(e) => handleItemFormChange('weight', Number(e.target.value || 0))} />
                      </div>
                      <div className="inventory-form-group" style={{gridColumn: '1 / -1'}}>
                        <label htmlFor="item-note">Заметки</label>
                        <textarea id="item-note" className="inventory-field" placeholder="Заметки (необязательно)" value={itemForm.note} onChange={(e) => handleItemFormChange('note', e.target.value)} />
                      </div>
                      <div className="inventory-form-group" style={{gridColumn: '1 / -1'}}>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <label className="inventory-toggle">
                            <input
                              type="checkbox"
                              checked={itemForm.system}
                              onChange={(e) => handleItemFormChange('system', e.target.checked)}
                            />
                            <span className="slider" aria-hidden="true" />
                            <span className="inventory-toggle__label">Системное</span>
                          </label>
                          <label className="inventory-toggle">
                            <input
                              type="checkbox"
                              checked={itemForm.hasAttack}
                              onChange={(e) => handleItemFormChange('hasAttack', e.target.checked)}
                            />
                            <span className="slider" aria-hidden="true" />
                            <span className="inventory-toggle__label">Есть атака</span>
                          </label>
                        </div>
                      </div>
                      {/* ... (старая, скрытая форма атаки) ... */}
                    </div>
                    <div className="inventory-form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 'auto', paddingTop: '16px' }}>
                      <button type="button" className="inventory-cancel-btn" onClick={resetAndShowList}>Отмена</button>
                      <button type="submit" className="inventory-add"><i className="fa-solid fa-save" /> {editingItem ? 'Сохранить' : 'Добавить'}</button>
                    </div>
                  </form>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* --- Модальное окно истории --- */}
      {isHistoryModalOpen && (
        <div className="modal-overlay" onClick={() => setHistoryModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h3><i className="fa-solid fa-timeline" /> История повышений уровня</h3>
              <button className="modal-close-button" onClick={() => setHistoryModalOpen(false)}>&times;</button>
            </header>
            <div className="modal-body">
              {levelUpHistory.length === 0 ? (
                <p>Повышений уровня еще не было.</p>
              ) : (
                <ul className="lvl-history-list">
                  {levelUpHistory.map((entry, index) => (
                    <li key={index} className="lvl-history-item">
                      <div className="lvl-history-header">
                        <span className="lvl-history-level">Уровень {entry.level}</span>
                        <time className="lvl-history-time">
                          {new Date(entry.timestamp).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
                        </time>
                      </div>
                      <div className="lvl-history-details">
                        <div className="lvl-history-detail">
                          <i className="fa-solid fa-heart-pulse" title="Прирост здоровья" />
                          <span>
                            + {entry.healthIncrease} HP
                            {entry.d8Roll && <small> (d8: {entry.d8Roll})</small>}
                          </span>
                        </div>
                        {entry.gainedStatPoints && (
                          <div className="lvl-history-detail">
                            <i className="fa-solid fa-star" title="Получено очков характеристик" />
                            <span>+ {entry.gainedStatPoints} очка</span>
                          </div>
                        )}
                        {entry.gainedSkillName && (
                          <div className="lvl-history-detail">
                            <i className="fa-solid fa-book-sparkles" title="Получен навык" />
                            <span>{entry.gainedSkillName}</span>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setLevelUpHistory([])}>
                <i className="fa-solid fa-broom" /> Очистить историю
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ... (Skills Modal, Invites modal, Save Button без изменений) ... */}
      {isSkillsModalOpen && (
        <div className="perks-modal" role="dialog" aria-modal="true">
          <div className="perks-modal__content inventory-modal__content">
            <button type="button" className="perks-modal__close" onClick={() => setSkillsModalOpen(false)} aria-label="Close">
              <i className="fa-solid fa-xmark" />
            </button>
            <div className="perks-modal__header">
              <h3 className="perks-modal__title"><i className="fa-solid fa-book-tanakh" /> Навыки</h3>
            </div>
            <div className="skills-controls" style={{ position: 'relative', margin: '16px 0' }}>
              <input
                id="skill-input"
                className="skill-input"
                type="text"
                placeholder="Введите название навыка"
                value={skillInput}
                onChange={(e) => {
                  setSkillInput(e.target.value);
                  setSuggestOpen(true);
                }}
                onBlur={() => setTimeout(() => setSuggestOpen(false), 120)}
              />
              <button id="skill-add" className="skill-add" type="button" onClick={() => addSkill(skillInput)}>
                <i className="fa-solid fa-plus" /> Добавить
              </button>
              {suggestOpen && filteredSuggests.length > 0 && (
                <div className="skills-suggest" style={{ display: 'block' }}>
                  <ul className="skills-suggest__list" role="listbox">
                    {filteredSuggests.map((s) => (
                      <li key={s.id} className="skills-suggest__item" role="option" onMouseDown={(e) => e.preventDefault()} onClick={() => addSkill(s.name)}>
                        <i className={`skills-suggest__icon ${resolveIconClass(s.icon)}`} />
                        <div>
                          <div className="skills-suggest__name">
                            {s.name}
                            {s.rank && <span className="skills-suggest__rank">{s.rank}</span>}
                          </div>
                          {s.description && <div className="skills-suggest__desc">{s.description}</div>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <ul className="skills-list" style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {skills.map((sk, sIdx) => {
                const req = typeof sk.requiredExp !== 'undefined' ? sk.requiredExp : (sk.expMax ?? 100);
                const unlocked = (sk.expCurrent ?? 0) >= (req ?? 100);
                const b0 = sk.branches?.[0];
                const perkSummary = (sk.perks || []).map((p, i) => ({ p, i, on: !!(b0?.perksState?.[i]) }));
                return (
                  <li key={`${sk.name}-${sIdx}`} className="skill-item">
                    <div className="skill-row">
                      <div>
                        <div className="skill-name-row">
                          <div className="skill-name">
                            <i className={resolveIconClass(sk.icon)} /> {sk.name}
                          </div>
                          {sk.rank && <span className="skill-rank-chip">{sk.rank}</span>}
                        </div>
                        {sk.description && <div className="skill-desc">{sk.description}</div>}
                      </div>
                      <div className="skill-actions">
                        {unlocked && !!(sk.perks?.length) && (
                          <button type="button" className="perks-open-btn" onClick={() => openPerks(sIdx)}>
                            <i className="fa-solid fa-sitemap" /> Выберите перки
                          </button>
                        )}
                        <button type="button" onClick={() => removeSkill(sIdx)}>
                          <i className="fa-solid fa-trash" /> Удалить
                        </button>
                      </div>
                    </div>
                    <div className="skill-exp">
                      <div className="level-inputs">
                        <input
                          type="number"
                          min={0}
                          placeholder="0"
                          value={String(sk.expCurrent ?? 0)}
                          onChange={(e) => {
                            const v = e.target.value === '' ? 0 : Number(e.target.value);
                            setSkills((prev) => prev.map((x, i) => (i === sIdx ? { ...x, expCurrent: v } : x)));
                          }}
                        />
                        <div className="level-sep">/</div>
                        <input
                          type="number"
                          min={1}
                          placeholder="100"
                          value={String(sk.expMax ?? sk.requiredExp ?? 100)}
                          onChange={(e) => {
                            const v = e.target.value === '' ? 100 : Number(e.target.value);
                            setSkills((prev) => prev.map((x, i) => (i === sIdx ? { ...x, expMax: v } : x)));
                          }}
                        />
                      </div>
                    </div>
                    {!!(sk.perks?.length) && b0?.perksState && perkSummary.some(p => p.on) && (
                      <div className="perks-summary">
                        <div className="perks-summary__title"><i className="fa-solid fa-sitemap" /> Выбранные перки</div>
                        <div className="perks-summary__list">
                          {perkSummary.filter((x) => x.on).map(({ p, i }) => (
                            <div key={i} className="perks-summary__item"><span className="perks-summary__num">{i + 1}</span> {p}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {isInvitesModalOpen && (
        <div className="modal-overlay" onClick={() => setInvitesModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Приглашения в бой</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {combatInvites.length > 0 && (
                  <button type="button" className="btn btn-secondary" onClick={clearInvites} title="Удалить все приглашения">
                    <i className="fa-solid fa-broom" /> Очистить
                  </button>
                )}
                <button className="modal-close-button" onClick={() => setInvitesModalOpen(false)}>&times;</button>
              </div>
            </div>
            <div className="modal-body">
              {combatInvites.length === 0 ? (
                <p style={{ opacity: .8, margin: 0 }}>Пока нет приглашений</p>
              ) : (
                <ul style={{ display: 'grid', gap: 10, paddingLeft: 0, listStyle: 'none' }}>
                  {combatInvites.map((inv) => {
                    const label = inv.status === 'pending' ? 'Ожидание' : inv.status === 'accepted' ? 'Принято' : 'Отклонено';
                    return (
                      <li key={inv.id} className="inventory-item" style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{inv.characterName || 'Персонаж'}</div>
                          <div className={`player-sheet-card__footer`} style={{ marginTop: 4 }}>Статус: {label}</div>
                        </div>
                        {inv.status === 'pending' && (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" className="btn btn-success" onClick={() => acceptInvite(inv)}>
                              <i className="fa-solid fa-check" /> Принять
                            </button>
                            <button type="button" className="btn btn-danger" onClick={() => declineInvite(inv)}>
                              <i className="fa-solid fa-xmark" /> Отклонить
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="save-button-container" style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 100 }}>
        {isInvitesModalOpen && (
          <div>
            <i className="fa-solid fa-exclamation" />
          </div>
        )}
        <button type="button" className="cs-save-sticky" style={{ marginRight: 8, background: 'linear-gradient(135deg, #3a7dff, #65b4ff)', filter: 'saturate(0.7) brightness(0.9)' }} onClick={() => setHistoryModalOpen(true)}>
          <i className="fa-solid fa-timeline" />
          <span>История</span>
        </button>
        <button type="button" className="cs-save-sticky" style={{ marginRight: 8, position: 'relative' }} onClick={() => setInvitesModalOpen(true)}>
          {combatInvites.some(inv => inv.status === 'pending') && (
            <span style={{
              position: 'absolute', top: '-5px', right: '-5px',
              width: '12px', height: '12px', borderRadius: '50%',
              backgroundColor: '#ef4444', // Красный цвет
              border: '2px solid #0d132a', // Цвет фона кнопки для контраста
            }} />
          )}
          <i className="fa-solid fa-envelope-open-text" />
          <span>Приглашения</span></button>
        <button id="save-sheet" type="button" onClick={handleSave} className="cs-save-sticky">
          <i className="fa-solid fa-save" />
          <span>Сохранить</span>
        </button>
      </div>

      {/* Очки вдохновения (новый виджет) */}
      <div
        className="inspiration-orb"
        onClick={() => setInspiration(s => Number(s || 0) + 1)}
        onContextMenu={(e) => {
          e.preventDefault();
          setInspiration(s => Math.max(0, Number(s || 0) - 1));
        }}
        title="Очки Вдохновения (ЛКМ: +1, ПКМ: -1)"
        style={{
          position: 'fixed',
          bottom: '2rem',
          left: '2rem',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, #a5b4fc, #7c3aed, #4c1d95)',
          color: '#f5f3ff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.25)',
          zIndex: 100,
          userSelect: 'none',
          border: '2px solid #a78bfa',
        }}
      >
        <span style={{ fontSize: '24px', fontWeight: 700, lineHeight: 1 }}>{inspiration || 0}</span>
        <span style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.8, marginTop: '2px' }}></span>
      </div>
    </div>
  );
};

export default CharacterSheetPage;
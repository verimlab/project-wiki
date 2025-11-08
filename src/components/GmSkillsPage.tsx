import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  bulkUpsertSkills,
  deleteSkill,
  saveSkillDraft,
  fetchSkills, 
  skillDraftFromCatalog,
  type SkillEditorDraft as ImportedSkillEditorDraft,
} from '../api/skills';
import { SKILL_CATEGORY_LABELS, SKILL_CATEGORY_OPTIONS } from '../constants/skills';
import { SKILL_CATEGORY_VALUES, type SkillCatalogEntry, type SkillCategory, type SkillStatMod, type SkillStatModTarget } from '../types/sheet';
import './GmSkillsPage.css';

const NEW_ID = '__new';

type AttackDetails = {
  damage: string;
  damageType: string;
  range: string;
  saveType: string;
  castingTime: string;
  manaCost: string;
  effect: string;
};

// [ИЗМЕНЕНО] Убрано `branches` из этого типа, т.к. поле ввода удалено
type SkillEditorDraft = Omit<ImportedSkillEditorDraft, 'order' | 'branches'> & {
  hasAttack: boolean;
  attack: AttackDetails;
  category?: SkillCategory;
  statMods?: SkillStatMod[];
};

const emptyAttackFields = (): AttackDetails => ({
  damage: '',
  damageType: '',
  range: '',
  saveType: '',
  castingTime: '',
  manaCost: '',
  effect: '',
});

const emptyDraft = (): SkillEditorDraft => ({
  name: '',
  description: '',
  icon: '',
  requiredExp: 100,
  keywords: [],
  perks: [],
  aspects: [],
  rank: '',
  manaCost: '',
  category: 'misc',
  hasAttack: false,
  attack: emptyAttackFields(),
  statMods: [],
});

const RANDOM_BLOCK_TEXT = {
  title: '\u0421\u043b\u0443\u0447\u0430\u0439\u043d\u044b\u0439 \u043d\u0430\u0432\u044b\u043a',
  subtitle: '\u041f\u043e\u0434\u0431\u0435\u0440\u0438\u0442\u0435 \u0444\u0438\u043b\u044c\u0442\u0440\u044b \u0438 \u043f\u043e\u043b\u0443\u0447\u0438\u0442\u0435 \u0438\u0434\u0435\u044e.',
  categoryLabel: '\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f',
  categoryAny: '\u041b\u044e\u0431\u0430\u044f',
  rankLabel: '\u0420\u0430\u043d\u0433',
  rankAny: '\u041b\u044e\u0431\u043e\u0439',
  aspectLabel: '\u0410\u0441\u043f\u0435\u043a\u0442',
  aspectAny: '\u041b\u044e\u0431\u043e\u0439',
  generate: '\u0421\u0433\u0435\u043d\u0435\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c',
  open: '\u041e\u0442\u043a\u0440\u044b\u0442\u044c',
  emptyCatalog: '\u041a\u0430\u0442\u0430\u043b\u043e\u0433 \u043f\u0443\u0441\u0442 \u2014 \u0438\u043c\u043f\u043e\u0440\u0442\u0438\u0440\u0443\u0439\u0442\u0435 \u043d\u0430\u0432\u044b\u043a\u0438.',
  noMatches: '\u041d\u0435\u0442 \u043d\u0430\u0432\u044b\u043a\u043e\u0432 \u0441 \u0442\u0430\u043a\u0438\u043c\u0438 \u0444\u0438\u043b\u044c\u0442\u0440\u0430\u043c\u0438.',
};

const toKeywords = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const toAspects = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const toPerks = (value: string) => 
  value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

const mapJsonToDraft = (raw: Record<string, unknown>, fallbackOrder: number): SkillEditorDraft => ({
  id: typeof raw.id === 'string' ? raw.id : undefined,
  name: typeof raw.name === 'string' ? raw.name : `Skill ${fallbackOrder + 1}`,
  description: typeof raw.description === 'string' ? raw.description : undefined,
  icon: typeof raw.icon === 'string' ? raw.icon : undefined,
  requiredExp: typeof raw.requiredExp === 'number' ? raw.requiredExp : undefined,
  keywords: Array.isArray(raw.keywords) ? raw.keywords.map((kw) => String(kw)) : [],
  perks: Array.isArray(raw.perks) ? raw.perks.map((perk) => String(perk)) : [],
  aspects: Array.isArray((raw as any).aspects) ? (raw as any).aspects.map((asp: unknown) => String(asp)) : [],
  // 'branches' не импортируем, т.к. поле удалено
  rank: typeof raw.rank === 'string' ? raw.rank : undefined,
  manaCost: typeof (raw as any).manaCost === 'string' ? (raw as any).manaCost : undefined,
  category: ((): SkillCategory | undefined => {
    const v = typeof (raw as any).category === 'string' ? (raw as any).category : undefined;
    return v && (SKILL_CATEGORY_VALUES as string[]).includes(v) ? (v as SkillCategory) : undefined;
  })(),
  
  hasAttack: typeof raw.hasAttack === 'boolean' ? raw.hasAttack : false,
  attack: typeof raw.attack === 'object' && raw.attack !== null ? 
    {
      damage: typeof (raw.attack as AttackDetails).damage === 'string' ? (raw.attack as AttackDetails).damage : '',
      damageType: typeof (raw.attack as AttackDetails).damageType === 'string' ? (raw.attack as AttackDetails).damageType : '',
      range: typeof (raw.attack as AttackDetails).range === 'string' ? (raw.attack as AttackDetails).range : '',
      saveType: typeof (raw.attack as AttackDetails).saveType === 'string' ? (raw.attack as AttackDetails).saveType : '',
      castingTime: typeof (raw.attack as AttackDetails).castingTime === 'string' ? (raw.attack as AttackDetails).castingTime : '',
      manaCost: typeof (raw.attack as AttackDetails).manaCost === 'string' ? (raw.attack as AttackDetails).manaCost : '',
      effect: typeof (raw.attack as AttackDetails).effect === 'string' ? (raw.attack as AttackDetails).effect : '',
    } : emptyAttackFields(),
  statMods: Array.isArray((raw as any).statMods)
    ? (raw as any).statMods.map((m: any) => ({ target: String(m?.target ?? 'wisdom') as SkillStatModTarget, delta: Number(m?.delta ?? 0) }))
    : [],
});

const resolveIconClass = (icon?: string) => {
  if (!icon) return 'fa-solid fa-star';
  const trimmed = icon.trim();
  if (!trimmed) return 'fa-solid fa-star';
  if (trimmed.startsWith('ri-')) return trimmed;
  if (trimmed.startsWith('fa-') || trimmed.includes(' ')) return trimmed;
  return `fa-solid ${trimmed}`;
};

const GmSkillsPage: React.FC = () => {
  const [catalog, setCatalog] = useState<SkillCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SkillEditorDraft | null>(null);
  const [keywordsValue, setKeywordsValue] = useState('');
  const [aspectsValue, setAspectsValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [randomCategoryFilter, setRandomCategoryFilter] = useState<'all' | SkillCategory>('all');
  const [randomRankFilter, setRandomRankFilter] = useState<'all' | string>('all');
  const [randomAspectFilter, setRandomAspectFilter] = useState<'all' | string>('all');
  const [randomSkill, setRandomSkill] = useState<SkillCatalogEntry | null>(null);
  const [randomMessage, setRandomMessage] = useState<string | null>(null);

  const updateStatMod = (index: number, patch: Partial<SkillStatMod>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const list = [...(prev.statMods ?? [])];
      const next = { ...(list[index] ?? { target: 'wisdom' as SkillStatModTarget, delta: 0 }), ...patch } as SkillStatMod;
      list[index] = next;
      return { ...prev, statMods: list };
    });
  };

  const addStatMod = () => {
    setDraft((prev) => prev ? { ...prev, statMods: [...(prev.statMods ?? []), { target: 'wisdom', delta: 1 }] } : prev);
  };

  const removeStatMod = (index: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const list = [...(prev.statMods ?? [])];
      list.splice(index, 1);
      return { ...prev, statMods: list };
    });
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const skills = await fetchSkills();
        setCatalog(skills);
      } catch (err) {
        console.error('Failed to fetch skills', err);
        setToast({ type: 'error', text: 'Ошибка загрузки навыков' });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (selectedId === NEW_ID) return;

    if (!selectedId && catalog.length > 0) {
      setSelectedId(catalog[0].id);
      return;
    }
    
    const match = catalog.find((item) => item.id === selectedId);
    
    if (match) {
      const newDraft = skillDraftFromCatalog(match) as SkillEditorDraft;
      
      // [ИСПРАВЛЕНО] 1. ГЛАВНЫЙ ФИКС
      // Если `attack` пришел как `undefined`, заменяем его пустым объектом
      if (!newDraft.attack) newDraft.attack = emptyAttackFields(); 
      
      setDraft(newDraft);
      setKeywordsValue((newDraft.keywords ?? []).join(', '));
      setAspectsValue((newDraft.aspects ?? []).join(', '));
    } else if (catalog.length > 0) {
      setSelectedId(catalog[0].id);
    } else {
      setDraft(null);
      setKeywordsValue('');
      setAspectsValue('');
      setAspectsValue('');
    }
  }, [catalog, selectedId]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const filtered = useMemo(() => {
    if (!search.trim()) return catalog;
    const needle = search.toLowerCase();
    return catalog.filter(
      (item) =>
        item.name.toLowerCase().includes(needle) ||
        (item.description || '').toLowerCase().includes(needle) ||
        (item.rank || '').toLowerCase().includes(needle) ||
        (item.keywords || []).some((kw) => kw.toLowerCase().includes(needle)),
    );
  }, [catalog, search]);

  const rankOptions = useMemo(() => {
    const unique = new Set<string>();
    catalog.forEach((skill) => {
      const rankValue = (skill.rank || '').trim();
      if (rankValue) unique.add(rankValue);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [catalog]);

  const aspectOptions = useMemo(() => {
    const unique = new Set<string>();
    catalog.forEach((skill) => {
      (skill.aspects || []).forEach((aspect) => {
        const normalized = aspect.trim();
        if (normalized) unique.add(normalized);
      });
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'ru', { sensitivity: 'base' }));
  }, [catalog]);

  useEffect(() => {
    setRandomMessage(null);
  }, [randomCategoryFilter, randomRankFilter, randomAspectFilter]);

  useEffect(() => {
    if (randomRankFilter !== 'all' && !rankOptions.includes(randomRankFilter)) {
      setRandomRankFilter('all');
    }
  }, [rankOptions, randomRankFilter]);

  useEffect(() => {
    if (randomAspectFilter !== 'all' && !aspectOptions.includes(randomAspectFilter)) {
      setRandomAspectFilter('all');
    }
  }, [aspectOptions, randomAspectFilter]);

  const startCreate = () => {
    const next = emptyDraft();
    setSelectedId(NEW_ID);
    setDraft(next);
    setKeywordsValue('');
    setAspectsValue('');
  };

  const resetDraft = () => {
    if (selectedId === NEW_ID) {
      startCreate();
      return;
    }
    
    const idToReset = selectedId ?? catalog[0]?.id;
    if (idToReset) {
      const match = catalog.find((item) => item.id === idToReset);
      if (match) {
        const newDraft = skillDraftFromCatalog(match) as SkillEditorDraft;
        
        // [ИСПРАВЛЕНО] 2. ГЛАВНЫЙ ФИКС (дублируем)
        // Гарантируем, что `attack` не `undefined`
        if (!newDraft.attack) newDraft.attack = emptyAttackFields(); 
        
        setDraft(newDraft);
        setKeywordsValue((newDraft.keywords ?? []).join(', '));
        setAspectsValue((newDraft.aspects ?? []).join(', '));
      }
    } else {
      setDraft(null);
      setKeywordsValue('');
      setAspectsValue('');
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      // 'branches' больше не существует в draft, так что saveSkillDraft
      // должен принимать объект без 'branches'
      const id = await saveSkillDraft(draft);
      
      const updatedDraft = { ...draft, id };
      setDraft(updatedDraft);
      
      setCatalog(currentCatalog => {
        const index = currentCatalog.findIndex(s => s.id === id);
        
        // [ИЗМЕНЕНО] Убрана логика `branches`
        const updatedSkillAsCatalogEntry: SkillCatalogEntry = {
          ...updatedDraft,
          id: id,
          branches: [], // Отправляем пустой массив, т.к. поле удалено
        } as unknown as SkillCatalogEntry; 
        
        if (index > -1) {
          const nextCatalog = [...currentCatalog];
          nextCatalog[index] = updatedSkillAsCatalogEntry;
          return nextCatalog;
        } else {
          return [updatedSkillAsCatalogEntry, ...currentCatalog];
        }
      });
      
      setToast({ type: 'success', text: 'Навык сохранён' });
      setSelectedId(id); 
      
    } catch (err) {
      console.error('skill save failed', err);
      setToast({ type: 'error', text: 'Не удалось сохранить навык' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!draft?.id) return;
    if (!window.confirm('Удалить этот навык окончательно?')) return;
    try {
      await deleteSkill(draft.id);
      
      setCatalog(currentCatalog => currentCatalog.filter(s => s.id !== draft.id));
      
      setToast({ type: 'success', text: 'Навык удалён' });
      setSelectedId(null);
      setDraft(null);
      setKeywordsValue('');
    } catch (err)
{
      console.error('skill delete failed', err);
      setToast({ type: 'error', text: 'Не удалось удалить навык' });
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await fetch('/assets/skills.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('failed to load skills.json');
      const raw = (await res.json()) as Array<Record<string, unknown>>;
      if (!Array.isArray(raw) || !raw.length) throw new Error('empty payload');
      const drafts = raw.map((entry, idx) => mapJsonToDraft(entry, idx));
      await bulkUpsertSkills(drafts);
      
      const skills = await fetchSkills();
      setCatalog(skills);
      
      setToast({ type: 'success', text: `Импортировано ${drafts.length} навыков` });
    } catch (err) {
      console.error('skills import failed', err);
      setToast({ type: 'error', text: 'Ошибка при импорте' });
    } finally {
      setImporting(false);
    }
  };

  const handleRandomSkill = () => {
    if (!catalog.length) {
      setRandomSkill(null);
      setRandomMessage(RANDOM_BLOCK_TEXT.emptyCatalog);
      return;
    }

    const pool = catalog.filter((skill) => {
      const matchesCategory =
        randomCategoryFilter === 'all' || skill.category === randomCategoryFilter;
      const matchesRank =
        randomRankFilter === 'all' ||
        (skill.rank || '').toLowerCase() === randomRankFilter.toLowerCase();
      const matchesAspect =
        randomAspectFilter === 'all' ||
        (skill.aspects || []).some(
          (aspect) => aspect.trim().toLowerCase() === randomAspectFilter.toLowerCase(),
        );
      return matchesCategory && matchesRank && matchesAspect;
    });

    if (!pool.length) {
      setRandomSkill(null);
      setRandomMessage(RANDOM_BLOCK_TEXT.noMatches);
      return;
    }

    const randomIndex = Math.floor(Math.random() * pool.length);
    setRandomSkill(pool[randomIndex]);
    setRandomMessage(null);
  };

  const updateDraft = (patch: Partial<SkillEditorDraft>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };
  
  const updateAttackDraft = (patch: Partial<AttackDetails>) => {
    setDraft((prev) => (
      prev ? { 
        ...prev, 
        attack: { ...(prev.attack ?? emptyAttackFields()), ...patch } 
      } : prev
    ));
  };

  const handleKeywordsChange = (value: string) => {
    setKeywordsValue(value);
    updateDraft({ keywords: toKeywords(value) });
  };

  const handleAspectsChange = (value: string) => {
    setAspectsValue(value);
    updateDraft({ aspects: toAspects(value) });
  };

  // ... (JSX...)
  return (
    <div className="gs-root">
      <header className="gs-header">
        <div>
          <h1>Редактор навыков</h1>
          <p>Управляйте описаниями, иконками, рангами и перками для всей системы.</p>
        </div>
        <div className="gs-header-actions">
          <button type="button" className="gs-ghost-btn" onClick={handleImport} disabled={importing}>
            <i className="fa-solid fa-cloud-arrow-up" /> {importing ? 'Импорт...' : 'Импортировать JSON'}
          </button>
          <button type="button" className="gs-primary-btn" onClick={startCreate}>
            <i className="fa-solid fa-plus" /> Новый навык
          </button>
          <Link to="/gm-hub" className="gs-link-back">
            <i className="fa-solid fa-arrow-left-long" /> в GM Hub
          </Link>
        </div>
      </header>

      <div className="gs-layout">
        <aside className="gs-sidebar">
          <div className="gs-search">
            <i className="fa-solid fa-magnifying-glass" aria-hidden />
            <input
              type="search"
              placeholder="Поиск по названию, тегам или рангу"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="gs-random">
            <div className="gs-random__header">
              <i className="fa-solid fa-shuffle" aria-hidden />
              <div>
                <strong>{RANDOM_BLOCK_TEXT.title}</strong>
                <p>{RANDOM_BLOCK_TEXT.subtitle}</p>
              </div>
            </div>
            <label>
              {RANDOM_BLOCK_TEXT.categoryLabel}
              <select
                value={randomCategoryFilter}
                onChange={(e) =>
                  setRandomCategoryFilter(e.target.value as 'all' | SkillCategory)
                }
              >
                <option value="all">{RANDOM_BLOCK_TEXT.categoryAny}</option>
                {SKILL_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {RANDOM_BLOCK_TEXT.rankLabel}
              <select
                value={randomRankFilter}
                onChange={(e) => setRandomRankFilter(e.target.value)}
              >
                <option value="all">{RANDOM_BLOCK_TEXT.rankAny}</option>
                {rankOptions.map((rank) => (
                  <option key={rank} value={rank}>
                    {rank}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {RANDOM_BLOCK_TEXT.aspectLabel}
              <select
                value={randomAspectFilter}
                onChange={(e) => setRandomAspectFilter(e.target.value)}
              >
                <option value="all">{RANDOM_BLOCK_TEXT.aspectAny}</option>
                {aspectOptions.map((aspect) => (
                  <option key={aspect} value={aspect}>
                    {aspect}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="gs-random__btn" onClick={handleRandomSkill}>
              <i className="fa-solid fa-dice" /> {RANDOM_BLOCK_TEXT.generate}
            </button>
            {randomMessage && (
              <p className={`gs-random__hint${randomSkill ? '' : ' is-error'}`}>{randomMessage}</p>
            )}
            {randomSkill && (
              <div className="gs-random__result">
                <div>
                  <div className="gs-random__result-title">
                    {randomSkill.name}
                    {randomSkill.rank && <span className="gs-rank-chip">{randomSkill.rank}</span>}
                  </div>
                  <div className="gs-random__result-meta">
                    {randomSkill.category && (
                      <span>
                        {SKILL_CATEGORY_LABELS[randomSkill.category as SkillCategory] ??
                          randomSkill.category}
                      </span>
                    )}
                    {randomSkill.requiredExp && <span>EXP {randomSkill.requiredExp}</span>}
                    {randomSkill.aspects?.length ? (
                      <span>
                        {RANDOM_BLOCK_TEXT.aspectLabel}: {randomSkill.aspects.join(', ')}
                      </span>
                    ) : null}
                  </div>
                  {randomSkill.description && <p>{randomSkill.description}</p>}
                </div>
                <button
                  type="button"
                  className="gs-random__open"
                  onClick={() => setSelectedId(randomSkill.id)}
                >
                  <i className="fa-solid fa-arrow-right-to-bracket" /> {RANDOM_BLOCK_TEXT.open}
                </button>
              </div>
            )}
          </div>
          <ul className="gs-list" role="listbox">
            {loading && <li className="gs-empty">Загрузка...</li>}
            {!loading && filtered.length === 0 && <li className="gs-empty">Ничего не найдено.</li>}
            {filtered.map((skill) => (
              <li key={skill.id}>
                <button
                  type="button"
                  className={`gs-list-item ${selectedId === skill.id ? 'is-active' : ''}`}
                  onClick={() => {
                    setSelectedId(skill.id); 
                  }}
                >
                  <div className="gs-list-icon">
                    <i className={resolveIconClass(skill.icon)} />
                  </div>
                  <div className="gs-list-body">
                    <div className="gs-list-title">
                      {skill.name}
                      {skill.rank && <span className="gs-rank-chip">{skill.rank}</span>}
                    </div>
                    {skill.description && <p>{skill.description}</p>}
                    <div className="gs-list-tags">
                      {skill.requiredExp && <span>EXP {skill.requiredExp}</span>}
                      {skill.category && (
                        <span>{SKILL_CATEGORY_LABELS[skill.category as SkillCategory] ?? skill.category}</span>
                      )}
                      {skill.manaCost?.trim() && <span>Затраты маны: {skill.manaCost}</span>}
                      {!!skill.perks?.length && <span>{skill.perks.length} перков</span>}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="gs-editor">
          {!draft && (
            <div className="gs-editor-empty">
              <i className="fa-solid fa-wand-magic-sparkles" />
              <p>Выберите навык из списка или создайте новый.</p>
            </div>
          )}

          {draft && (
            <form
              className="gs-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
            >
              <div className="gs-form-grid">
                <label>
                  Название
                  <input value={draft.name} onChange={(e) => updateDraft({ name: e.target.value })} required />
                </label>
                <label>
                  EXP порог
                  <input
                    type="number"
                    min={0}
                    value={draft.requiredExp ?? 0}
                    onChange={(e) => updateDraft({ requiredExp: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </label>
                <label>
                  Ранг навыка
                  <input value={draft.rank || ''} onChange={(e) => updateDraft({ rank: e.target.value })} placeholder="S, A, B+ и т.п." />
                </label>
                <label>
                  Затраты маны
                  <input value={draft.manaCost || ""} onChange={(e) => updateDraft({ manaCost: e.target.value })} placeholder="15 МП" />
                </label>
                <label>
                  Icon (FA или Remix)
                  <input value={draft.icon || ''} onChange={(e) => updateDraft({ icon: e.target.value })} placeholder="fa-solid fa-wand-magic-sparkles" />
                </label>
                <label>
                  Категория
                  <select value={draft.category ?? 'misc'} onChange={(e) => updateDraft({ category: e.target.value as SkillCategory })}>
                    {SKILL_CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="gs-form-toggle">
                <input 
                  type="checkbox" 
                  checked={draft.hasAttack} 
                  onChange={(e) => updateDraft({ hasAttack: e.target.checked })} 
                />
                <span className="gs-toggle-slider"></span>
                <span className="gs-toggle-label">Есть атака</span>
              </label>

              {draft.hasAttack && (
                <div className="gs-form-group-wrap">
                  <div className="gs-form-grid">
                    <label>
                      Урон
                      {/* [ИСПРАВЛЕНО] 3. ГЛАВНЫЙ ФИКС
                          Мы используем `draft.attack?.damage` (optional chaining)
                          на случай, если `draft` еще не обновился,
                          И `|| ''` на случай, если `damage` - undefined.
                      */}
                      <input value={draft.attack?.damage || ''} onChange={(e) => updateAttackDraft({ damage: e.target.value })} placeholder="2d8 + МОД" />
                    </label>
                    <label>
                      Тип урона
                      <input value={draft.attack?.damageType || ''} onChange={(e) => updateAttackDraft({ damageType: e.target.value })} placeholder="огонь, холод, некро..." />
                    </label>
                    <label>
                      Дистанция
                      <input value={draft.attack?.range || ''} onChange={(e) => updateAttackDraft({ range: e.target.value })} placeholder="30 футов, касание" />
                    </label>
                    <label>
                      Спасбросок
                      <input value={draft.attack?.saveType || ''} onChange={(e) => updateAttackDraft({ saveType: e.target.value })} placeholder="ЛОВ, МУД, ВЫН" />
                    </label>
                    <label>
                      Время каста
                      <input value={draft.attack?.castingTime || ''} onChange={(e) => updateAttackDraft({ castingTime: e.target.value })} placeholder="1 действие" />
                    </label>
                    <label>
                      Стоимость маны
                      <input value={draft.attack?.manaCost || ''} onChange={(e) => updateAttackDraft({ manaCost: e.target.value })} placeholder="15 MP" />
                    </label>
                    </div>
                  <label>
                    Эффект (при успехе/провале спасброска)
                    <textarea 
                      rows={3} 
                      value={draft.attack?.effect || ''} 
                      onChange={(e) => updateAttackDraft({ effect: e.target.value })} 
                      placeholder="При провале спасброска, цель ошеломлена на 1 раунд." 
                    />
                  </label>
                </div>
              )}

              {/* Новое: модификаторы статов */
              <><div className="gs-form-group-wrap">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
                    <strong>Изменяет характеристики</strong>
                    <button type="button" className="gs-ghost-btn" onClick={addStatMod}>
                      <i className="fa-solid fa-plus" /> Добавить модификатор
                    </button>
                  </div>
                  {(draft.statMods ?? []).length === 0 && (
                    <div className="gs-empty">Нет модификаторов</div>
                  )}
                  {(draft.statMods ?? []).map((mod, idx) => (
                    <div key={idx} className="gs-form-grid">
                      <label>
                        Что меняется
                        <select value={mod.target}
                          onChange={(e) => updateStatMod(idx, { target: e.target.value as SkillStatModTarget })}>
                          <option value="strength">Сила</option>
                          <option value="dexterity">Ловкость</option>
                          <option value="intellect">Интеллект</option>
                          <option value="constitution">Телосложение</option>
                          <option value="charisma">Харизма</option>
                          <option value="perception">Восприятие</option>
                          <option value="wisdom">Мудрость</option>
                          <option value="luck">Удача</option>
                          <option value="manaMax">Макс. мана</option>
                          <option value="healthMax">Макс. хп</option>
                          <option value="speed">Скорость</option>
                          <option value="ac">Класс доспеха</option>
                        </select>
                      </label>
                      <label>
                        На сколько
                        <input type="number" value={Number(mod.delta) || 0}
                          onChange={(e) => updateStatMod(idx, { delta: Number(e.target.value) })} />
                      </label>
                      <div style={{ display: 'flex', alignItems: 'end' }}>
                        <button type="button" className="gs-danger-btn" onClick={() => removeStatMod(idx)}>
                          <i className="fa-solid fa-trash" /> Удалить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <label>
                    Описание
                    <textarea rows={4} value={draft.description || ''} onChange={(e) => updateDraft({ description: e.target.value })} placeholder="История, рекомендации, особенности" />
                  </label>
                <label>
                    Ключевые слова (через запятую)
                    <input value={keywordsValue} onChange={(e) => handleKeywordsChange(e.target.value)} placeholder="яд, ловкость, алхимия" />
                  </label>
                <label>
                  {'\u0410\u0441\u043f\u0435\u043a\u0442\u044b'}
                  <input
                    value={aspectsValue}
                    onChange={(e) => handleAspectsChange(e.target.value)}
                    placeholder="\u043e\u0433\u043e\u043d\u044c, \u0445\u043e\043b\043e\0434, \u044f\0434"
                  />
                </label>
              </>
}

              {/* --- [ИЗМЕНЕНО] --- */} {/* '}' expected. */}

              {/* Убрана обертка gs-form-grid-half и второе поле (Ветки) */}
              <label>
                Перки (по одному на строку)
                <textarea rows={6} value={(draft.perks ?? []).join('\n')} onChange={(e) => updateDraft({ perks: toPerks(e.target.value) })} placeholder="1. Бонус к атакам&#10;2. Иммунитет к ядам" />
              </label>
              {/* --- [КОНЕЦ ИЗМЕНЕНИЯ] --- */}

              <div className="gs-form-actions">
                {draft.id && (
                  <button type="button" className="gs-danger-btn" onClick={handleDelete}>
                    <i className="fa-solid fa-trash" /> Удалить
                  </button>
                )}
                <div className="gs-form-actions__spacer" />
                <button type="button" className="gs-ghost-btn" onClick={resetDraft}>
                  <i className="fa-solid fa-arrow-rotate-right" /> Сбросить
                </button>
                <button type="submit" className="gs-primary-btn" disabled={saving}>
                  <i className="fa-solid fa-floppy-disk" /> {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>

      {toast && <div className={`gs-toast is-${toast.type}`}>{toast.text}</div>}
    </div>
  );
};

export default GmSkillsPage;

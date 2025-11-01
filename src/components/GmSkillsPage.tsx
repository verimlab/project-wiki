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
import type { SkillCatalogEntry, SkillCategory } from '../types/sheet';
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
  rank: '',
  category: 'misc',
  hasAttack: false,
  attack: emptyAttackFields(),
});

const toKeywords = (value: string) =>
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
  // 'branches' не импортируем, т.к. поле удалено
  rank: typeof raw.rank === 'string' ? raw.rank : undefined,
  category: ((): SkillCategory | undefined => {
    const v = typeof (raw as any).category === 'string' ? (raw as any).category : undefined;
    const allowed: SkillCategory[] = ['proficiency', 'magic', 'passive', 'misc'];
    return v && (allowed as string[]).includes(v) ? (v as SkillCategory) : undefined;
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
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
    } else if (catalog.length > 0) {
      setSelectedId(catalog[0].id);
    } else {
      setDraft(null);
      setKeywordsValue('');
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

  const startCreate = () => {
    const next = emptyDraft();
    setSelectedId(NEW_ID);
    setDraft(next);
    setKeywordsValue('');
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
      }
    } else {
      setDraft(null);
      setKeywordsValue('');
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
                  Icon (FA или Remix)
                  <input value={draft.icon || ''} onChange={(e) => updateDraft({ icon: e.target.value })} placeholder="fa-solid fa-wand-magic-sparkles" />
                </label>
                <label>
                  Категория
                  <select value={draft.category ?? 'misc'} onChange={(e) => updateDraft({ category: e.target.value as SkillCategory })}>
                    <option value="proficiency">Владение</option>
                    <option value="magic">Магия</option>
                    <option value="passive">Пассивные</option>
                    <option value="misc">Разное</option>
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

              <label>
                Описание
                <textarea rows={4} value={draft.description || ''} onChange={(e) => updateDraft({ description: e.target.value })} placeholder="История, рекомендации, особенности" />
              </label>

              <label>
                Ключевые слова (через запятую)
                <input value={keywordsValue} onChange={(e) => handleKeywordsChange(e.target.value)} placeholder="яд, ловкость, алхимия" />
              </label>

              {/* --- [ИЗМЕНЕНО] --- */}
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
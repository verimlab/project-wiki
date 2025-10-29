import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useSkillsCatalog } from '../hooks/useSkillsCatalog';
import {
  bulkUpsertSkills,
  deleteSkill,
  saveSkillDraft,
  skillDraftFromCatalog,
  type SkillEditorDraft as ImportedSkillEditorDraft,
} from '../api/skills';
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

type SkillEditorDraft = Omit<ImportedSkillEditorDraft, 'order'> & {
  hasAttack: boolean;
  attack: AttackDetails;
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
  rank: typeof raw.rank === 'string' ? raw.rank : undefined,
  
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
  const { catalog, loading } = useSkillsCatalog();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SkillEditorDraft | null>(null);
  const [keywordsValue, setKeywordsValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const prevCatalogRef = useRef(catalog);

  // --- НАЧАЛО ИСПРАВЛЕНИЯ ---
  const applyDraft = useCallback((value: ImportedSkillEditorDraft | null) => {
    if (value) {
      // 'value' - это неполный объект из 'catalog'
      const itemAsLocal = value as SkillEditorDraft; // Кастуем его

      // Мы используем 'setDraft(currentDraft => ...)' чтобы получить доступ
      // к *текущему* состоянию формы (currentDraft)
      setDraft(currentDraft => {
        // Проверяем, загружаем ли мы тот же навык, который уже в редакторе
        const isReloadingCurrent = currentDraft && currentDraft.id === value.id;

        const finalDraft: SkillEditorDraft = {
          ...emptyDraft(), // 1. Применяем все дефолты
          ...value,        // 2. Применяем неполные данные из 'value' (каталога)
          
          // 3. САМОЕ ВАЖНОЕ:
          // Если это перезагрузка (isReloadingCurrent = true),
          // то берем 'hasAttack' и 'attack' из 'currentDraft' (из состояния),
          // а *не* из 'value' (из каталога).
          // Иначе - сбрасываем (т.к. грузим новый навык).
          hasAttack: isReloadingCurrent
                        ? currentDraft.hasAttack
                        : (itemAsLocal.hasAttack ?? false),
          
          attack: isReloadingCurrent
                        ? currentDraft.attack
                        : (itemAsLocal.attack 
                            ? { ...emptyAttackFields(), ...itemAsLocal.attack }
                            : emptyAttackFields()),
        };
        
        // Так как мы внутри 'setDraft', мы должны обновить keywordsValue здесь же.
        setKeywordsValue((finalDraft.keywords ?? []).join(', '));
        
        return finalDraft;
      });
      
    } else {
      setDraft(null);
      setKeywordsValue('');
    }
  }, [/* Зависимости не нужны, т.к. setDraft/setKeywordsValue стабильны */]);
  // --- КОНЕЦ ИСПРАВЛЕНИЯ ---

  useEffect(() => {
    const catalogChanged = prevCatalogRef.current !== catalog;
    prevCatalogRef.current = catalog;

    if (selectedId === NEW_ID) return;
    if (!catalog.length) {
      applyDraft(null);
      return;
    }
    if (!selectedId) {
      setSelectedId(catalog[0].id);
      applyDraft(skillDraftFromCatalog(catalog[0]));
      return;
    }
    
    const match = catalog.find((item) => item.id === selectedId);
    
    if (match) {
      applyDraft(skillDraftFromCatalog(match));
    } else {
      // Не нашли.
      if (catalogChanged) {
        // Навык был удален, грузим первый.
        if (catalog.length > 0) {
          setSelectedId(catalog[0].id);
          applyDraft(skillDraftFromCatalog(catalog[0]));
        } else {
          applyDraft(null);
        }
      } else {
        // Это только что созданный навык, 'catalog' еще не обновился.
        // Ничего не делаем, 'draft' в состоянии и так верный.
        return;
      }
    }
  }, [catalog, selectedId, applyDraft]);

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
    // Напрямую вызываем 'setDraft', минуя 'applyDraft'
    setDraft(next);
    setKeywordsValue('');
  };

  const resetDraft = () => {
    if (selectedId === NEW_ID) {
      startCreate();
      return;
    }
    if (selectedId) {
      const match = catalog.find((item) => item.id === selectedId);
      applyDraft(match ? skillDraftFromCatalog(match) : null);
    } else if (catalog[0]) {
      applyDraft(skillDraftFromCatalog(catalog[0]));
    } else {
      applyDraft(null);
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const id = await saveSkillDraft(draft);
      setDraft((prev) => (prev ? { ...prev, id } : prev));
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
      setToast({ type: 'success', text: 'Навык удалён' });
      setSelectedId(null);
      applyDraft(null);
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

  // ... (остальная часть компонента JSX остается без изменений) ...
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
                    applyDraft(skillDraftFromCatalog(skill));
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
                      <input value={draft.attack.damage} onChange={(e) => updateAttackDraft({ damage: e.target.value })} placeholder="2d8 + МОД" />
                    </label>
                    <label>
                      Тип урона
                      <input value={draft.attack.damageType} onChange={(e) => updateAttackDraft({ damageType: e.target.value })} placeholder="огонь, холод, некро..." />
                    </label>
                    <label>
                      Дистанция
                      <input value={draft.attack.range} onChange={(e) => updateAttackDraft({ range: e.target.value })} placeholder="30 футов, касание" />
                    </label>
                    <label>
                      Спасбросок
                      <input value={draft.attack.saveType} onChange={(e) => updateAttackDraft({ saveType: e.target.value })} placeholder="ЛОВ, МУД, ВЫН" />
                    </label>
                    <label>
                      Время каста
                      <input value={draft.attack.castingTime} onChange={(e) => updateAttackDraft({ castingTime: e.target.value })} placeholder="1 действие" />
                    </label>
                    <label>
                      Стоимость маны
                      <input value={draft.attack.manaCost} onChange={(e) => updateAttackDraft({ manaCost: e.target.value })} placeholder="15 MP" />
                    </label>
                    </div>
                  <label>
                    Эффект (при успехе/провале спасброска)
                    <textarea 
                      rows={3} 
                      value={draft.attack.effect} 
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

              <label>
                Перки (по одному на строку)
                <textarea rows={6} value={(draft.perks ?? []).join('\n')} onChange={(e) => updateDraft({ perks: toPerks(e.target.value) })} placeholder="1. Бонус к атакам\n2. Иммунитет к ядам" />
              </label>

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
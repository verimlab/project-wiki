import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { createId } from '../utils/id';
import type { Article, ArticlesMap, SectionId } from '../types/lore';
import { LORE_SECTIONS, SECTION_BY_ID } from '../constants/loreSections';
import { buildDefaultArticles } from '../data/loreDefaults';

// [УДАЛЕНО] ❌ import { useLoreArticles } from '../hooks/useLoreArticles';

// [ИЗМЕНЕНО] ✅ Мы используем `fetchArticles`, который, как ты сказал, работает
import { deleteArticle as deleteFromFirestore, saveArticle, fetchArticles } from '../api/lore'; 
import './GmEditorPage.css';

const formatDate = (value: number) =>
  new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(value);

const randomAccent = () => `hsl(${Math.floor(Math.random() * 360)}, 65%, 60%)`;

const STATS_MAP = [
  { key: 'str', label: 'Сила', icon: 'fa-solid fa-hand-fist' },
  { key: 'agi', label: 'Ловкость', icon: 'fa-solid fa-person-running' },
  { key: 'int', label: 'Интеллект', icon: 'fa-solid fa-brain' },
  { key: 'con', label: 'Телосложение', icon: 'fa-solid fa-heart-pulse' },
  { key: 'cha', label: 'Харизма', icon: 'fa-solid fa-comment-dots' },
  { key: 'per', label: 'Восприятие', icon: 'fa-solid fa-eye' },
  { key: 'luc', label: 'Удача', icon: 'fa-solid fa-clover' },
] as const;

type BaseStats = Record<string, number>;
const DEFAULT_STATS: BaseStats = { str: 0, agi: 0, int: 0, con: 0, cha: 0, per: 0, luc: 0 };

const RELATION_MAP = {
  'Отличное': '#00E676',
  'Хорошее': '#698B69',
  'Нейтральное': '#424242',
  'Плохое': '#FFA726',
  'Ужасное': '#F44336',
  'Неизвестное': '#7b6dff',
} as const;

const RELATION_OPTIONS = Object.keys(RELATION_MAP) as (keyof typeof RELATION_MAP)[];
const getRelationFromColor = (color: string): keyof typeof RELATION_MAP => {
  return (Object.entries(RELATION_MAP).find(([, c]) => c === color)?.[0] || 'Неизвестное') as keyof typeof RELATION_MAP;
};

const GmEditorPage: React.FC = () => {
  const defaults = useMemo(() => buildDefaultArticles(), []);
  
  // [УДАЛЕНО] ❌ const { articles: remoteArticles } = useLoreArticles(defaults);

  // 1. `articles` - наш ЕДИНСТВЕННЫЙ источник правды.
  //    Начинаем с пустых `defaults`.
  const [articles, setArticles] = useState<ArticlesMap>(defaults);
  
  const [searchParams, setSearchParams] = useSearchParams();
  const [section, setSection] = useState<SectionId>('characters');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isPreview, setPreview] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  
  // 2. [ИЗМЕНЕНО] ✅ Добавляем `useState` для отслеживания *самой первой* загрузки
  const [isLoaded, setIsLoaded] = useState(false);

  // [ИЗМЕНЕНО] ✅ ЭТОТ useEffect ТЕПЕРЬ ЗАГРУЖАЕТ ДАННЫЕ
  // Мы делаем *в точности* то же самое, что и кнопка "Загрузить из облака",
  // но только ОДИН РАЗ при загрузке страницы.
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        console.log('🔄 Загрузка данных из Firebase...');
        const cloudData = await fetchArticles(); // 👈 Вызываем РАБОТАЮЩУЮ функцию
        setArticles(cloudData);                  // 👈 Заполняем наш главный стейт
        console.log('✅ Данные успешно загружены');
      } catch (err) {
        console.error('❌ Ошибка загрузки данных:', err);
      } finally {
        setIsLoaded(true); // 👈 Говорим, что загрузка завершена
      }
    };
    
    loadInitialData();
  }, []); // 👈 Пустой массив = "run once on mount"

  // [ИЗМЕНЕНО] ✅ Этот useEffect теперь ждет `isLoaded`
  useEffect(() => {
    // Ждем, пока `isLoaded` станет true
    if (!isLoaded) return; 

    const incomingSection = searchParams.get('section');
    const resolvedSection: SectionId = incomingSection && SECTION_BY_ID[incomingSection as SectionId]
      ? (incomingSection as SectionId)
      : 'characters';
    if (resolvedSection !== section) setSection(resolvedSection);

    const list = articles[resolvedSection] ?? [];
    const incomingArticle = searchParams.get('article');
    const resolvedArticle = incomingArticle && list.some((item) => item.id === incomingArticle)
      ? incomingArticle
      : list[0]?.id ?? null;
      
    if (resolvedArticle !== selectedId) {
      setSelectedId(resolvedArticle);
    }
  }, [searchParams, articles, section, selectedId, isLoaded]); // 👈 `isLoaded` в зависимостях

  const syncParams = (nextSection: SectionId, articleId: string | null) => {
    const next = new URLSearchParams(searchParams);
    next.set('section', nextSection);
    if (articleId) next.set('article', articleId);
    else next.delete('article');
    setSearchParams(next);
  };

  const filteredList = useMemo(() => {
    const list = articles[section] ?? [];
    if (!search.trim()) return list.slice().sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    const needle = search.trim().toLowerCase();
    return list
      .filter((item) => item.title.toLowerCase().includes(needle) || item.summary.toLowerCase().includes(needle))
      .sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  }, [articles, section, search]);

  const currentArticle = useMemo(() => {
    const list = articles[section] ?? [];
    return list.find((item) => item.id === selectedId) ?? null;
  }, [articles, section, selectedId]);

  useEffect(() => {
    if (editorRef.current && currentArticle && editorRef.current.innerHTML !== currentArticle.content) {
      editorRef.current.innerHTML = currentArticle.content;
    }
  }, [currentArticle?.id, currentArticle?.content]);

  const handleSelectArticle = (newId: string | null) => {
    if (newId === selectedId) return;
    if (isDirty && !window.confirm('Есть несохранённые изменения. Продолжить без сохранения?')) return;
    setSelectedId(newId);
    setIsDirty(false);
    syncParams(section, newId);
  };

  const handleChangeSection = (newSection: SectionId) => {
    if (newSection === section) return;
    if (isDirty && !window.confirm('Есть несохранённые изменения. Продолжить без сохранения?')) return;
    const firstId = (articles[newSection] ?? [])[0]?.id ?? null;
    setSection(newSection);
    setSelectedId(firstId);
    setIsDirty(false);
    syncParams(newSection, firstId);
  };

  type Patch = Partial<Article>;
  type PatchFn = (prevArticle: Article) => Partial<Article>;

  const updateCurrent = (patch: Patch | PatchFn) => {
    setArticles((prev) => {
      const list = prev[section] ?? [];
      const currentFromState = list.find((item) => item.id === selectedId);
      if (!currentFromState) return prev;
      const patchObject = typeof patch === 'function' ? patch(currentFromState) : patch;
      const nextArticle: Article = { ...currentFromState, ...patchObject };
      setIsDirty(true);
      const nextList = list.map((item) => (item.id === selectedId ? nextArticle : item));
      return { ...prev, [section]: nextList };
    });
  };

  const handleManualSave = async () => {
    if (!currentArticle || isSaving) return;
    setIsSaving(true);
    const articleToSave: Article = { ...currentArticle, updatedAt: Date.now() };
    setArticles(prev => ({
      ...prev,
      [section]: prev[section].map(a => a.id === articleToSave.id ? articleToSave : a)
    }));
    try {
      await saveArticle(section, articleToSave);
      setIsDirty(false);
      console.log('✅ Сохранено:', articleToSave.title);
    } catch (err) {
      console.error('❌ Ошибка сохранения:', err);
      alert('Не удалось сохранить статью.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReloadFromCloud = async () => {
    if (isSaving) return;
    if (isDirty && !window.confirm('Есть несохранённые изменения. Перезаписать локальные данные из облака?')) return;
    try {
      // ✅ Эта кнопка теперь просто делает то же самое, что и при загрузке
      const cloudData = await fetchArticles(); 
      setArticles(cloudData);
      setIsDirty(false);
      console.log('✅ Данные обновлены из Firebase');
    } catch (err) {
      console.error('❌ Ошибка загрузки из Firebase:', err);
      alert('Не удалось загрузить данные из облака.');
    }
  };

  const handleStatChange = (statKey: typeof STATS_MAP[number]['key'], numValue: number) => {
    updateCurrent((prevArticle) => ({
      baseStats: { ...(prevArticle.baseStats ?? DEFAULT_STATS), [statKey]: numValue }
    }));
  };

  const handleContentInput = () => {
    if (!editorRef.current) return;
    updateCurrent({ content: editorRef.current.innerHTML });
  };

  const exec = (command: string, value?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    handleContentInput();
  };

  const handleNewArticle = async () => {
    if (isDirty && !window.confirm('Есть несохранённые изменения. Продолжить без сохранения?')) return;
    const template: Article = {
      id: createId('art'),
      title: 'Новая статья',
      summary: 'Добавьте краткое описание...',
      tags: [],
      coverColor: randomAccent(),
      icon: SECTION_BY_ID[section].icon,
      content: '<p>Начните писать историю прямо здесь...</p>',
      updatedAt: Date.now(),
    };
    if (section === 'races') template.baseStats = DEFAULT_STATS;
    if (section === 'characters') template.coverColor = RELATION_MAP['Неизвестное'];
    if (section === 'creatures') {
      template.ac = '';
      template.attacks = '';
    }

    try {
      await saveArticle(section, template);
      setArticles((prev) => ({
        ...prev,
        [section]: [template, ...(prev[section] ?? [])],
      }));
      setSelectedId(template.id);
      setIsDirty(false);
      syncParams(section, template.id);
      setTimeout(() => editorRef.current?.focus(), 0);
    } catch (err) {
      console.error('create article failed', err);
    }
  };

  const removeArticle = async (id: string) => {
    if (!window.confirm('Удалить эту статью?')) return;
    setArticles((prev) => {
      const nextList = (prev[section] ?? []).filter((item) => item.id !== id);
      if (selectedId === id) {
        const nextId = nextList[0]?.id ?? null;
        setSelectedId(nextId);
        setIsDirty(false);
        syncParams(section, nextId);
      }
      return { ...prev, [section]: nextList };
    });
    deleteFromFirestore(section, id).catch((err) => console.error('delete article failed', err));
  };

  const toolbar = (
    <div className="ge-toolbar">
      {/* ... (весь JSX тулбара остается без изменений) ... */}
      <button type="button" onClick={() => exec('bold')}><i className="fa-solid fa-bold" /></button>
      <button type="button" onClick={() => exec('italic')}><i className="fa-solid fa-italic" /></button>
      <button type="button" onClick={() => exec('underline')}><i className="fa-solid fa-underline" /></button>
      <span className="ge-divider" />
      <button type="button" onClick={() => exec('formatBlock', 'h2')}>H2</button>
      <button type="button" onClick={() => exec('formatBlock', 'h3')}>H3</button>
      <span className="ge-divider" />
      <button type="button" onClick={() => exec('insertUnorderedList')}><i className="fa-solid fa-list" /></button>
      <button type="button" onClick={() => exec('insertOrderedList')}><i className="fa-solid fa-list-ol" /></button>
      <button type="button" onClick={() => exec('formatBlock', 'blockquote')}><i className="fa-solid fa-quote-right" /></button>
      <button type="button" onClick={() => exec('formatBlock', 'pre')}><i className="fa-solid fa-code" /></button>
      <span className="ge-divider" />
      <button type="button" onClick={() => exec('justifyLeft')}><i className="fa-solid fa-align-left" /></button>
      <button type="button" onClick={() => exec('justifyCenter')}><i className="fa-solid fa-align-center" /></button>
      <button type="button" onClick={() => exec('justifyRight')}><i className="fa-solid fa-align-right" /></button>
      <span className="ge-divider" />
      <button type="button" onClick={() => exec('createLink', prompt('Введите ссылку') || undefined)}><i className="fa-solid fa-link" /></button>
      <button type="button" onClick={() => exec('insertImage', prompt('URL изображения') || undefined)}><i className="fa-solid fa-image" /></button>
      <button type="button" onClick={() => exec('removeFormat')}><i className="fa-solid fa-eraser" /></button>
    </div>
  );

  return (
    <div className="ge-root">
      <header className="ge-header">
        {/* ... (JSX хедера без изменений) ... */}
        <div>
          <p className="ge-kicker">GM Studio</p>
          <h1>Редактор статей</h1>
          <p className="ge-sub">Создавайте богатые материалы для разделов Персонажи, Расы, Миры и Существа.</p>
        </div>
        <div className="ge-header-actions">
          <Link to="/gm-hub" className="ge-ghost-btn">
            <i className="fa-solid fa-arrow-left" /> Назад в Hub
          </Link>
          <button type="button" className="ge-ghost-btn" onClick={handleReloadFromCloud}>
            <i className="fa-solid fa-cloud-arrow-down" /> Загрузить из облака
          </button>
          <button type="button" className="ge-primary-btn" onClick={handleNewArticle}>
            <i className="fa-solid fa-plus" /> Новая статья
          </button>
        </div>
      </header>

      <div className="ge-layout">
        <aside className="ge-sidebar">
          {/* ... (JSX сайдбара (табы и поиск) без изменений) ... */}
          <div className="ge-section-tabs">
            {LORE_SECTIONS.map((meta) => (
              <button
                key={meta.id}
                type="button"
                className={`ge-section-pill ${section === meta.id ? 'is-active' : ''}`}
                onClick={() => handleChangeSection(meta.id)}
              >
                <i className={meta.icon} />
                <span>{meta.label}</span>
              </button>
            ))}
          </div>

          <div className="ge-search">
            <i className="fa-solid fa-magnifying-glass" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск статей" />
          </div>

          <ul className="ge-article-list">
            {/* [ИЗМЕНЕНО] ✅ Показываем заглушку, пока `isLoaded` false */}
            {!isLoaded && <p className="ge-empty">Загрузка статей...</p>}
            
            {isLoaded && filteredList.map((item) => (
              <li key={item.id} className={item.id === selectedId ? 'is-active' : ''}>
                <button 
                  type="button" 
                  onClick={() => handleSelectArticle(item.id)}
                >
                  <span className="dot" style={{ background: item.coverColor }} />
                  <div>
                    <strong>{item.title}{isDirty && item.id === selectedId && ' *'}</strong>
                  </div>
                </button>
                <div className="ge-article-actions">
                  <button type="button" onClick={() => handleSelectArticle(item.id)} aria-label="Редактировать"><i className="fa-solid fa-pen" /></button>
                  <button type="button" onClick={() => removeArticle(item.id)} aria-label="Удалить"><i className="fa-solid fa-trash" /></button>
                </div>
              </li>
            ))}
            {isLoaded && filteredList.length === 0 && <p className="ge-empty">Нет статей. Создайте первую!</p>}
          </ul>
        </aside>

        <section className="ge-editor" aria-live="polite">
          {/* [ИЗМЕНЕНО] ✅ Показываем заглушку, пока `isLoaded` false */}
          {!currentArticle && !isLoaded && <div className="ge-placeholder">Загрузка...</div>}
          {!currentArticle && isLoaded && <div className="ge-placeholder">Выберите или создайте статью.</div>}
          
          {currentArticle && (
            <div className="ge-editor-card">
              {/* ... (JSX meta-row, full, stats-row) ... */}
              <div className="ge-meta-row">
                <label>
                  Заголовок
                  <input value={currentArticle.title} onChange={(e) => updateCurrent({ title: e.target.value })} placeholder="Название статьи" />
                </label>

                {section === 'characters' ? (
                  <label>
                    Отношения
                    <select
                      value={getRelationFromColor(currentArticle.coverColor)}
                      onChange={(e) => {
                        const newRelation = e.target.value as keyof typeof RELATION_MAP;
                        const newColor = RELATION_MAP[newRelation] ?? RELATION_MAP['Неизвестное'];
                        updateCurrent({ coverColor: newColor });
                      }}
                    >
                      {RELATION_OPTIONS.map((relation) => (
                        <option key={relation} value={relation}>
                          {relation}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label>
                    Обложка
                    <input type="color" value={currentArticle.coverColor} onChange={(e) => updateCurrent({ coverColor: e.target.value })} />
                  </label>
                )}

                <label>
                  Иконка (FA класс)
                  <input
                    value={currentArticle.icon || ''}
                    onChange={(e) => updateCurrent({ icon: e.target.value })}
                    placeholder="fa-solid fa-feather"
                  />
                </label>
              </div>
              <label className="ge-full">
                Лид / подзаголовок
                <textarea value={currentArticle.summary} onChange={(e) => updateCurrent({ summary: e.target.value })} placeholder="Короткое описание материала" />
              </label>
              
              {section === 'creatures' && (
                <div className="ge-meta-row">
                  <label>
                    КД (Класс Доспеха)
                    <input
                      value={currentArticle.ac || ''}
                      onChange={(e) => updateCurrent({ ac: e.target.value })}
                      placeholder="Напр: 14"
                    />
                  </label>
                  <label>
                    Атаки
                    <input
                      value={currentArticle.attacks || ''}
                      onChange={(e) => updateCurrent({ attacks: e.target.value })}
                      placeholder="Напр: Укус +4 (1d6+2)"
                    />
                  </label>
                </div>
              )}

              {section === 'races' && (
                <div className="ge-stats-row">
                  <p className="ge-stats-header">Базовые характеристики</p>
                  {STATS_MAP.map((stat) => (
                    <label key={stat.key} className="ge-stat-label">
                      {stat.label}
                      <input
                        type="number"
                        value={currentArticle.baseStats?.[stat.key] ?? 0}
                        onChange={(e) => {
                          const numValue = parseInt(e.target.value, 10);
                          const finalValue = isNaN(numValue) ? 0 : numValue;
                          handleStatChange(stat.key, finalValue);
                        }}
                      />
                    </label>
                  ))}
                </div>
              )}

              <div className="ge-editor-shell">
                {toolbar}
                <div
                  className="ge-editor-area"
                  contentEditable
                  spellCheck
                  ref={editorRef}
                  onInput={handleContentInput}
                  suppressContentEditableWarning
                />
              </div>

              <div className="ge-editor-footer">
                {/* ... (JSX футера (кнопки) без изменений) ... */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button 
                    type="button" 
                    className="ge-primary-btn" 
                    onClick={handleManualSave}
                    disabled={!isDirty || isSaving}
                  >
                    <i className={`fa-solid ${isSaving ? 'fa-spinner fa-spin' : 'fa-save'}`} />
                    {isSaving ? 'Сохранение...' : (isDirty ? 'Сохранить' : 'Сохранено')}
                  </button>
                  <button type="button" className="ge-ghost-btn" onClick={() => setPreview((prev) => !prev)}>
                    <i className="fa-solid fa-eye" /> {isPreview ? 'Скрыть превью' : 'Показать превью'}
                  </button>
                </div>
                <p>
                  {isDirty 
                    ? <span style={{ color: '#FFA726' }}>Есть несохраненные изменения...</span> 
                    : `Сохранено: ${formatDate(currentArticle.updatedAt)}`
                  }
                </p>
              </div>
            </div>
          )}
        </section>

        <aside className="ge-preview" aria-live="polite">
          {/* ... (JSX превью без изменений) ... */}
          {!isPreview || !currentArticle ? (
            <div className="ge-preview-placeholder">
              <i className="fa-solid fa-wand-magic-sparkles" />
              <p>Включите превью, чтобы увидеть итог оформления.</p>
            </div>
          ) : (
            <div className="ge-preview-card">
              <div className="ge-preview-cover" style={{ background: currentArticle.coverColor }}>
                <i className={currentArticle.icon || SECTION_BY_ID[section].icon} />
              </div>
              <h2>{currentArticle.title}</h2>
              <p className="ge-preview-summary">{currentArticle.summary}</p>
              
              {section === 'races' && currentArticle.baseStats && (
                <div className="ge-preview-stats">
                  {STATS_MAP.map(stat => (
                    <span key={stat.key} className="ge-preview-stat">
                      <i className={stat.icon} /> {stat.label}: <strong>{currentArticle.baseStats?.[stat.key] ?? 0}</strong>
                    </span>
                  ))}
                </div>
              )}
              
              {section === 'creatures' && (
                <div className="ge-preview-stats">
                  <span className="ge-preview-stat">
                    <i className="fa-solid fa-shield-halved" /> КД: <strong>{currentArticle.ac || '?'}</strong>
                  </span>
                  <span className="ge-preview-stat">
                    <i className="fa-solid fa-gavel" /> Атаки: <strong>{currentArticle.attacks || '...'}</strong>
                  </span>
                </div>
              )}

              <div className="ge-preview-body" dangerouslySetInnerHTML={{ __html: currentArticle.content }} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default GmEditorPage;
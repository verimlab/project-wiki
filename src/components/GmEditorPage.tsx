import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { createId } from '../utils/id';
import type { Article, ArticlesMap, SectionId } from '../types/lore';
import { LORE_SECTIONS, SECTION_BY_ID } from '../constants/loreSections';
import { buildDefaultArticles } from '../data/loreDefaults';
import { useLoreArticles } from '../hooks/useLoreArticles';
import { deleteArticle as deleteFromFirestore, saveArticle } from '../api/lore';
import './GmEditorPage.css';

const formatDate = (value: number) =>
  new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(value);

const randomAccent = () => `hsl(${Math.floor(Math.random() * 360)}, 65%, 60%)`;

// Определение характеристик
const STATS_MAP = [
  { key: 'str', label: 'Сила', icon: 'fa-solid fa-hand-fist' },
  { key: 'agi', label: 'Ловкость', icon: 'fa-solid fa-person-running' },
  { key: 'int', label: 'Интеллект', icon: 'fa-solid fa-brain' },
  { key: 'con', label: 'Телосложение', icon: 'fa-solid fa-heart-pulse' },
  { key: 'cha', label: 'Харизма', icon: 'fa-solid fa-comment-dots' },
  { key: 'per', label: 'Восприятие', icon: 'fa-solid fa-eye' },
  { key: 'luc', label: 'Удача', icon: 'fa-solid fa-clover' },
] as const;

// Тип для статов (для удобства)
type BaseStats = Record<string, number>;
const DEFAULT_STATS: BaseStats = { str: 0, agi: 0, int: 0, con: 0, cha: 0, per: 0, luc: 0 };

// Карта Отношений (для Персонажей)
const RELATION_MAP = {
  'Отличное': '#00E676', // ярко-зеленый
  'Хорошее': '#698B69', // серо-зеленый
  'Нейтральное': '#424242', // темно-серое
  'Плохое': '#FFA726', // оранжевое
  'Ужасное': '#F44336', // красное
  'Неизвестное': '#7b6dff', // фиолетовое
} as const;

const RELATION_OPTIONS = Object.keys(RELATION_MAP) as (keyof typeof RELATION_MAP)[];
const getRelationFromColor = (color: string): keyof typeof RELATION_MAP => {
  return (Object.entries(RELATION_MAP).find(([, c]) => c === color)?.[0] || 'Неизвестное') as keyof typeof RELATION_MAP;
};

// Тип для ref'а таймеров
type PendingSave = {
  timerId: ReturnType<typeof setTimeout>;
  article: Article; // Будем хранить саму статью
};

const GmEditorPage: React.FC = () => {
  const defaults = useMemo(() => buildDefaultArticles(), []);
  const { articles: remoteArticles } = useLoreArticles(defaults);
  const [articles, setArticles] = useState<ArticlesMap>(remoteArticles);
  const [searchParams, setSearchParams] = useSearchParams();
  const [section, setSection] = useState<SectionId>('characters');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isPreview, setPreview] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  
  const saveTimers = useRef<Record<string, PendingSave>>({});
  
  // Этот ref нужен, чтобы наш `useEffect` не перезаписывал
  // локальное состояние во время принудительного сохранения.
  const isSaving = useRef(false);

  // --- КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: УМНЫЙ MERGE ---
  useEffect(() => {
    // Если мы в процессе принудительного сохранения (flushSave),
    // не даем данным с сервера перезаписать наши локальные изменения.
    if (isSaving.current) {
      return;
    }

    setArticles((prevLocalArticles) => {
      // 1. Создаем новую карту из данных, пришедших с сервера
      const nextArticlesMap = { ...remoteArticles };

      // 2. Проходим по всем *локальным* секциям
      (Object.keys(prevLocalArticles) as SectionId[]).forEach((sectionId) => {
        const localList = prevLocalArticles[sectionId] ?? [];
        
        // 3. Берем список с сервера (или пустой массив)
        const remoteList = nextArticlesMap[sectionId] ?? [];
        
        // 4. Проверяем *каждую* локальную статью
        localList.forEach(localArticle => {
          // Ищем ее в данных с сервера
          const remoteArticle = remoteList.find(a => a.id === localArticle.id);

          if (!remoteArticle) {
            // Статьи нет на сервере (например, только создана)
            // Добавляем ее в список
            remoteList.push(localArticle);
          } else {
            // Статья есть и там и там. Сравниваем!
            if (localArticle.updatedAt >= remoteArticle.updatedAt) {
              // Наша локальная новее (или такая же).
              // Заменяем ту, что пришла с сервера, на нашу локальную.
              const index = remoteList.findIndex(a => a.id === localArticle.id);
              remoteList[index] = localArticle;
            }
            // Иначе (remoteArticle.updatedAt > localArticle.updatedAt)
            // мы ничего не делаем, т.к. в remoteList УЖЕ лежит
            // более новая версия с сервера.
          }
        });

        // 5. Обновляем карту
        nextArticlesMap[sectionId] = remoteList;
      });
      
      return nextArticlesMap;
    });
  }, [remoteArticles]); // Зависимость *только* от remoteArticles


  useEffect(() => () => {
    Object.values(saveTimers.current).forEach((pending) => clearTimeout(pending.timerId));
  }, []);

  useEffect(() => {
    const incomingSection = searchParams.get('section');
    const resolvedSection: SectionId = incomingSection && SECTION_BY_ID[incomingSection as SectionId]
      ? (incomingSection as SectionId)
      : 'characters';
    if (resolvedSection !== section) {
      setSection(resolvedSection);
    }

    const list = articles[resolvedSection] ?? [];
    const incomingArticle = searchParams.get('article');
    const resolvedArticle = incomingArticle && list.some((item) => item.id === incomingArticle)
      ? incomingArticle
      : list[0]?.id ?? null;
    if (resolvedArticle !== selectedId) {
      setSelectedId(resolvedArticle);
    }
  }, [searchParams, articles, section, selectedId]);

  const syncParams = (nextSection: SectionId, articleId: string | null) => {
    const next = new URLSearchParams(searchParams);
    next.set('section', nextSection);
    if (articleId) {
      next.set('article', articleId);
    } else {
      next.delete('article');
    }
    setSearchParams(next);
  };

  const filteredList = useMemo(() => {
    const list = articles[section] ?? [];
    if (!search.trim()) {
      return list.slice().sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    }
    const needle = search.trim().toLowerCase();
    return list
      .filter(
        (item) =>
          item.title.toLowerCase().includes(needle) || item.summary.toLowerCase().includes(needle)
      )
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


  const queueSave = (sec: SectionId, article: Article) => {
    const key = `${sec}:${article.id}`;
    
    if (saveTimers.current[key]) {
      clearTimeout(saveTimers.current[key].timerId);
    }
    
    saveTimers.current[key] = {
      timerId: setTimeout(() => {
        saveArticle(sec, article).catch((err) => console.error('save article failed', err));
        delete saveTimers.current[key];
      }, 400), 
      article: article, 
    };
  };

  const flushSave = async (articleId: string | null) => {
    if (!articleId) return;

    const key = `${section}:${articleId}`;
    const pending = saveTimers.current[key];

    if (pending) {
      // Ставим "флаг", что мы сохраняем.
      isSaving.current = true;
      clearTimeout(pending.timerId);
      delete saveTimers.current[key];
      // Ждем-с...
      await saveArticle(section, pending.article).catch((err) => console.error('save article failed', err));
      // Снимаем "флаг".
      isSaving.current = false;
    }
  };

  const handleSelectArticle = async (newId: string | null) => {
    if (newId === selectedId) return; 
    await flushSave(selectedId); 
    setSelectedId(newId); 
    syncParams(section, newId);
  };

  const handleChangeSection = async (newSection: SectionId) => {
    if (newSection === section) return;
    await flushSave(selectedId); 
    const firstId = (articles[newSection] ?? [])[0]?.id ?? null;
    setSection(newSection); 
    setSelectedId(firstId);
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
      const nextArticle: Article = {
        ...currentFromState,
        ...patchObject,
        updatedAt: Date.now(),
      };
      queueSave(section, nextArticle); 
      const nextList = list.map((item) =>
        item.id === selectedId ? nextArticle : item
      );
      return {
        ...prev,
        [section]: nextList,
      };
    });
  };

  const handleStatChange = (statKey: typeof STATS_MAP[number]['key'], numValue: number) => {
    updateCurrent((prevArticle) => {
      const nextStats = {
        ...(prevArticle.baseStats ?? DEFAULT_STATS),
        [statKey]: numValue,
      };
      return { baseStats: nextStats };
    });
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
    await flushSave(selectedId); 
    
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
    
    if (section === 'races') {
      template.baseStats = DEFAULT_STATS;
    }
    if (section === 'characters') {
      template.coverColor = RELATION_MAP['Неизвестное'];
    }
    if (section === 'creatures') {
      template.ac = '';
      template.attacks = '';
    }

    setArticles((prev) => ({
      ...prev,
      [section]: [template, ...(prev[section] ?? [])],
    }));
    setSelectedId(template.id);
    syncParams(section, template.id);
    saveArticle(section, template).catch((err) => console.error('create article failed', err));
    setTimeout(() => editorRef.current?.focus(), 0);
  };

  const removeArticle = async (id: string) => {
    const key = `${section}:${id}`;
    if (saveTimers.current[key]) {
      clearTimeout(saveTimers.current[key].timerId);
      delete saveTimers.current[key];
    }
    
    await flushSave(selectedId); 

    setArticles((prev) => {
      const nextList = (prev[section] ?? []).filter((item) => item.id !== id);
      if (selectedId === id) {
        const nextId = nextList[0]?.id ?? null;
        setSelectedId(nextId);
        syncParams(section, nextId);
      }
      return { ...prev, [section]: nextList };
    });
    deleteFromFirestore(section, id).catch((err) => console.error('delete article failed', err));
  };

  const toolbar = (
    <div className="ge-toolbar">
      <button type="button" onClick={() => exec('bold')} aria-label="Жирный"><i className="fa-solid fa-bold" /></button>
      <button type="button" onClick={() => exec('italic')} aria-label="Курсив"><i className="fa-solid fa-italic" /></button>
      <button type="button" onClick={() => exec('underline')} aria-label="Подчеркнуть"><i className="fa-solid fa-underline" /></button>
      <span className="ge-divider" />
      <button type="button" onClick={() => exec('formatBlock', 'h2')}>H2</button>
      <button type="button" onClick={() => exec('formatBlock', 'h3')}>H3</button>
      <span className="ge-divider" />
      <button type="button" onClick={() => exec('insertUnorderedList')} aria-label="Маркированный список"><i className="fa-solid fa-list" /></button>
      <button type="button" onClick={() => exec('insertOrderedList')} aria-label="Нумерованный список"><i className="fa-solid fa-list-ol" /></button>
      <button type="button" onClick={() => exec('formatBlock', 'blockquote')} aria-label="Цитата"><i className="fa-solid fa-quote-right" /></button>
      <button type="button" onClick={() => exec('formatBlock', 'pre')} aria-label="Код"><i className="fa-solid fa-code" /></button>
      <span className="ge-divider" />
      <button type="button" onClick={() => exec('justifyLeft')} aria-label="По левому краю"><i className="fa-solid fa-align-left" /></button>
      <button type="button" onClick={() => exec('justifyCenter')} aria-label="По центру"><i className="fa-solid fa-align-center" /></button>
      <button type="button" onClick={() => exec('justifyRight')} aria-label="По правому краю"><i className="fa-solid fa-align-right" /></button>
      <span className="ge-divider" />
      <button type="button" onClick={() => exec('createLink', prompt('Введите ссылку') || undefined)} aria-label="Ссылка"><i className="fa-solid fa-link" /></button>
      <button type="button" onClick={() => exec('insertImage', prompt('URL изображения') || undefined)} aria-label="Изображение"><i className="fa-solid fa-image" /></button>
      <button type="button" onClick={() => exec('removeFormat')} aria-label="Очистить форматирование"><i className="fa-solid fa-eraser" /></button>
    </div>
  );

  return (
    <div className="ge-root">
      <header className="ge-header">
        <div>
          <p className="ge-kicker">GM Studio</p>
          <h1>Редактор статей</h1>
          <p className="ge-sub">Создавайте богатые материалы для разделов Персонажи, Расы, Миры и Существа.</p>
        </div>
        <div className="ge-header-actions">
          <Link to="/gm-hub" className="ge-ghost-btn"><i className="fa-solid fa-arrow-left" /> Назад в Hub</Link>
          <button type="button" className="ge-primary-btn" onClick={handleNewArticle}><i className="fa-solid fa-plus" /> Новая статья</button>
        </div>
      </header>

      <div className="ge-layout">
        <aside className="ge-sidebar">
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
            {filteredList.map((item) => (
              <li key={item.id} className={item.id === selectedId ? 'is-active' : ''}>
                <button 
                  type="button" 
                  onClick={() => handleSelectArticle(item.id)}
                >
                  <span className="dot" style={{ background: item.coverColor }} />
                  <div>
                    <strong>{item.title}</strong>
                  </div>
                </button>
                <div className="ge-article-actions">
                  <button type="button" onClick={() => setSelectedId(item.id)} aria-label="Редактировать"><i className="fa-solid fa-pen" /></button>
                  <button type="button" onClick={() => removeArticle(item.id)} aria-label="Удалить"><i className="fa-solid fa-trash" /></button>
                </div>
              </li>
            ))}
            {filteredList.length === 0 && <p className="ge-empty">Нет статей. Создайте первую!</p>}
          </ul>
        </aside>

        <section className="ge-editor" aria-live="polite">
          {!currentArticle && <div className="ge-placeholder">Выберите или создайте статью.</div>}
          {currentArticle && (
            <div className="ge-editor-card">
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
                <button type="button" className="ge-ghost-btn" onClick={() => setPreview((prev) => !prev)}>
                  <i className="fa-solid fa-eye" /> {isPreview ? 'Скрыть превью' : 'Показать превью'}
                </button>
                <p>Последнее изменение: {formatDate(currentArticle.updatedAt)}</p>
              </div>
            </div>
          )}
        </section>

        <aside className="ge-preview" aria-live="polite">
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
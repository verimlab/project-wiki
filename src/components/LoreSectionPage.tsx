import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useLore } from './LoreContext';
import { useLoreArticles } from '../hooks/useLoreArticles';
import type { Article as ImportedArticle, SectionId } from '../types/lore';
import { SECTION_BY_ID } from '../constants/loreSections';
import './LoreSectionPage.css';

type Article = ImportedArticle & { category?: string; skillProficiencies?: string[] };

const STATS_MAP = [
  { key: 'str', label: 'Сила', icon: 'fa-solid fa-hand-fist' },
  { key: 'agi', label: 'Ловкость', icon: 'fa-solid fa-person-running' },
  { key: 'int', label: 'Интеллект', icon: 'fa-solid fa-brain' },
  { key: 'con', label: 'Выносливость', icon: 'fa-solid fa-heart-pulse' },
  { key: 'cha', label: 'Харизма', icon: 'fa-solid fa-comment-dots' },
  { key: 'per', label: 'Восприятие', icon: 'fa-solid fa-eye' },
  { key: 'luc', label: 'Удача', icon: 'fa-solid fa-clover' },
] as const;

const LoreSectionPage: React.FC = () => {
  const params = useParams<{ sectionId?: SectionId }>();
  const { role } = useAuth();
  const { initialArticles, loaded } = useLore();
  const { articles, loading: liveLoading } = useLoreArticles(initialArticles);

  const sectionId: SectionId = params.sectionId && SECTION_BY_ID[params.sectionId as SectionId]
    ? (params.sectionId as SectionId)
    : 'characters';
  const meta = SECTION_BY_ID[sectionId];

  const [modalArticle, setModalArticle] = useState<Article | null>(null);
  const [searchParams] = useSearchParams();

  const list = useMemo(() => {
    const raw = (articles[sectionId] ?? []) as Article[];
    return raw.slice().sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  }, [articles, sectionId]);

  const creatureGroups = useMemo(() => {
    if (sectionId !== 'creatures') return [];
    const map = new Map<string, Article[]>();
    list.forEach((article) => {
      const key = article.category?.trim() || 'Без категории';
      const bucket = map.get(key) ?? [];
      bucket.push(article);
      map.set(key, bucket);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'ru'));
  }, [list, sectionId]);

  useEffect(() => {
    if (!(loaded || !liveLoading)) return;
    const target = searchParams.get('article');
    if (!target) {
      setModalArticle(null);
      return;
    }
    const art = list.find((i) => i.id === target) || null;
    setModalArticle(art);
  }, [loaded, liveLoading, searchParams, list]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalArticle(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const renderArticleCard = (article: Article) => {
    const sectionMeta = SECTION_BY_ID[sectionId];
    return (
      <div
        key={article.id}
        id={'article-' + article.id}
        className={'lore-card'}
        style={{ ['--accent' as any]: article.coverColor || '#78a0ff' }}
      >
        <button type="button" className="lore-card-head" onClick={() => setModalArticle(article)}>
          <span className="lore-card-icon" style={{ color: article.coverColor }}>
            <i className={article.icon || sectionMeta.icon} />
          </span>
          <div className="lore-card-meta">
            <div className="lore-card-title-row">
              <strong>{article.title}</strong>
            </div>
          </div>
        </button>
      </div>
    );
  };

  return (
    <div className="lore-root">
      <header className="lore-header">
        <div>
          <p className="lore-kicker">Энциклопедия</p>
          <h1>{meta.label}</h1>
          <p className="lore-sub">{meta.hint}</p>
        </div>
        <div className="lore-header-actions">
          <Link to="/" className="lore-btn"><i className="fa-solid fa-arrow-left" /> На главную</Link>
          {role === 'gm' && (
            <Link to="/gm-editor" className="lore-btn accent"><i className="fa-solid fa-pen-to-square" /> Редактировать статьи</Link>
          )}
        </div>
      </header>

      {sectionId === 'creatures' ? (
        creatureGroups.length ? (
          creatureGroups.map(([categoryLabel, items]) => (
            <section key={categoryLabel} className="lore-category-block">
              <div className="lore-category-header">
                <div className="lore-category-pill">
                  <i className="fa-solid fa-layer-group" />
                  {categoryLabel}
                </div>
              </div>
              <div className="lore-grid">
                {items.map(renderArticleCard)}
              </div>
            </section>
          ))
        ) : (
          <div className="lore-placeholder" style={{ gridColumn: '1 / -1' }}>
            <i className="fa-solid fa-wand-magic-sparkles" />
            <p>{!(loaded && !liveLoading) ? 'Загрузка статей…' : 'Пока пусто. Добавьте в редакторе.'}</p>
          </div>
        )
      ) : (
        <div className="lore-grid">
          {list.map(renderArticleCard)}
          {list.length === 0 && (
            <div className="lore-placeholder" style={{ gridColumn: '1 / -1' }}>
              <i className="fa-solid fa-wand-magic-sparkles" />
              <p>{!(loaded && !liveLoading) ? 'Загрузка статей…' : 'Пока пусто. Добавьте в редакторе.'}</p>
            </div>
          )}
        </div>
      )}

      {modalArticle && (
        <div className="lore-modal-backdrop" onClick={() => setModalArticle(null)}>
          <div className="lore-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <header className="lore-modal__head">
              <div className="lore-modal__title">
                <span className="lore-modal__icon" style={{ color: modalArticle.coverColor }}>
                  <i className={modalArticle.icon || SECTION_BY_ID[sectionId].icon} />
                </span>
                <h2>{modalArticle.title}</h2>
              </div>
              <button className="lore-modal__close" onClick={() => setModalArticle(null)} aria-label="Закрыть">
                <i className="fa-solid fa-xmark" />
              </button>
            </header>
            <div className="lore-modal__meta">
              {sectionId === 'races' && (
                <div className="lore-stats-display">
                  {STATS_MAP.map((stat) => (
                    <span key={stat.key} className="lore-stat" title={stat.label}>
                      <i className={stat.icon} /> {modalArticle.baseStats?.[stat.key] ?? 0}
                    </span>
                  ))}
                </div>
              )}
              {sectionId === 'creatures' && (
                <div className="lore-stats-display">
                  <span className="lore-stat" title="КД (класс доспеха)"><i className="fa-solid fa-shield-halved" /> {modalArticle.ac || '?'}</span>
                  <span className="lore-stat" title="Атаки"><i className="fa-solid fa-gavel" /> {modalArticle.attacks || '...'}</span>
                </div>
              )}
            </div>
            <div className="lore-modal__content" dangerouslySetInnerHTML={{ __html: modalArticle.content }} />
            {role === 'gm' && (
              <Link to={`/gm-editor?section=${sectionId}&article=${modalArticle.id}`} className="lore-edit-btn">
                <i className="fa-solid fa-pen-to-square" /> Править в редакторе
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoreSectionPage;

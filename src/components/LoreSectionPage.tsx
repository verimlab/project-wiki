import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useRole } from '../hooks/useRole';
import { useLoreArticles } from '../hooks/useLoreArticles';
// Article, SectionId - типы теперь неявно включают baseStats, ac, attacks
import type { Article, SectionId } from '../types/lore';
import { SECTION_BY_ID } from '../constants/loreSections';
import { buildDefaultArticles } from '../data/loreDefaults';
import './LoreSectionPage.css';

// Определение характеристик и иконок
const STATS_MAP = [
  { key: 'str', label: 'Сила', icon: 'fa-solid fa-hand-fist' },
  { key: 'agi', label: 'Ловкость', icon: 'fa-solid fa-person-running' },
  { key: 'int', label: 'Интеллект', icon: 'fa-solid fa-brain' },
  { key: 'con', label: 'Телосложение', icon: 'fa-solid fa-heart-pulse' },
  { key: 'cha', label: 'Харизма', icon: 'fa-solid fa-comment-dots' },
  { key: 'per', label: 'Восприятие', icon: 'fa-solid fa-eye' },
  { key: 'luc', label: 'Удача', icon: 'fa-solid fa-clover' },
] as const;

const LoreSectionPage: React.FC = () => {
  const params = useParams<{ sectionId?: SectionId }>();
  const defaults = useMemo(() => buildDefaultArticles(), []);
  const { articles, loading } = useLoreArticles(defaults);
  const { role } = useRole();

  const sectionId: SectionId = params.sectionId && SECTION_BY_ID[params.sectionId as SectionId]
    ? (params.sectionId as SectionId)
    : 'characters';
  const meta = SECTION_BY_ID[sectionId];

  const list = (articles[sectionId] ?? defaults[sectionId]) as Article[];
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  const toggleCard = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  useEffect(() => {
    if (!expandedId) {
      const target = searchParams.get('article');
      if (target && list.some((item) => item.id === target)) {
        setExpandedId(target);
        return;
      }
    }
    if (!expandedId) return;
    if (!list.some((item) => item.id === expandedId)) {
      setExpandedId(list[0]?.id ?? null);
    }
  }, [list, expandedId, searchParams]);

  return (
    <div className="lore-root">
      <header className="lore-header">
        <div>
          <p className="lore-kicker">Вселенная</p>
          <h1>{meta.label}</h1>
          <p className="lore-sub">{meta.hint}</p>
        </div>
        <div className="lore-header-actions">
          <Link to="/" className="lore-btn"><i className="fa-solid fa-arrow-left" /> На главную</Link>
          {role === 'gm' && (
            <Link to="/gm-editor" className="lore-btn accent"><i className="fa-solid fa-pen-to-square" /> Открыть редактор</Link>
          )}
        </div>
      </header>

      <div className="lore-grid">
        {list.map((article) => {
          const expanded = expandedId === article.id;
          return (
            <div key={article.id} className={`lore-card ${expanded ? 'is-expanded' : ''}`}>
              <button type="button" className="lore-card-head" onClick={() => toggleCard(article.id)}>
                <span className="lore-card-icon" style={{ color: article.coverColor }}>
                  <i className={article.icon || meta.icon} />
                </span>
                
                <div className="lore-card-meta">
                  <div className="lore-card-title-row">
                    <strong>{article.title}</strong>
                    
                    {/* Статы для Рас */}
                    {sectionId === 'races' && (
                      <div className="lore-stats-display">
                        {STATS_MAP.map(stat => (
                          <span key={stat.key} className="lore-stat" title={stat.label}>
                            <i className={stat.icon} /> {article.baseStats?.[stat.key] ?? 0}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* ДОБАВЛЕНО: Статы для Существ (КД/Атаки) */}
                    {sectionId === 'creatures' && (
                      <div className="lore-stats-display">
                        <span className="lore-stat" title="КД (Класс Доспеха)">
                          <i className="fa-solid fa-shield-halved" /> {article.ac || '?'}
                        </span>
                        <span className="lore-stat" title="Атаки">
                          <i className="fa-solid fa-gavel" /> {article.attacks || '...'}
                        </span>
                      </div>
                    )}
                  </div>
                  <small>{article.summary}</small>
                </div>

                <span className="lore-card-chevron" aria-hidden>
                  <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'}`} />
                </span>
              </button>
              {expanded && (
                <div className="lore-card-body">
                  <div className="lore-card-content" dangerouslySetInnerHTML={{ __html: article.content }} />
                  {role === 'gm' && (
                    <Link
                      to={`/gm-editor?section=${sectionId}&article=${article.id}`}
                      className="lore-edit-btn"
                    >
                      <i className="fa-solid fa-pen-to-square" /> Открыть в редакторе
                    </Link>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {list.length === 0 && (
          <div className="lore-placeholder" style={{ gridColumn: '1 / -1' }}>
            <i className="fa-solid fa-wand-magic-sparkles" />
            <p>{loading ? 'Загружаем статьи...' : 'Статей пока нет. Создайте их в редакторе.'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoreSectionPage;
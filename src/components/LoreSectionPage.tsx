import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useRole } from '../hooks/useRole';
import { fetchArticles } from '../api/lore'; 
// [ИЗМЕНЕНО] Импортируем 'Article' как 'ImportedArticle'
import type { Article as ImportedArticle, ArticlesMap, SectionId } from '../types/lore';
import { SECTION_BY_ID } from '../constants/loreSections';
import { buildDefaultArticles } from '../data/loreDefaults';
import './LoreSectionPage.css';

// [ИЗМЕНЕНО] Создаем наш локальный тип 'Article', который включает 'category'
type Article = ImportedArticle & {
  category?: string;
};

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
  const { role } = useRole();
  const [articles, setArticles] = useState<ArticlesMap>(defaults);
  const [isLoaded, setIsLoaded] = useState(false);

  const sectionId: SectionId = params.sectionId && SECTION_BY_ID[params.sectionId as SectionId]
    ? (params.sectionId as SectionId)
    : 'characters';
  const meta = SECTION_BY_ID[sectionId];

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const cloudData = await fetchArticles();
        setArticles(cloudData);
      } catch (err) {
        console.error('❌ Ошибка загрузки данных:', err);
      } finally {
        setIsLoaded(true);
      }
    };
    
    loadInitialData();
  }, []);

  const list = useMemo(() => {
    const rawList = (articles[sectionId] ?? []) as Article[]; // Используем наш новый тип
    // Сортируем копию массива по `title`
    return rawList.slice().sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  }, [articles, sectionId]); 
  
  const groupedCreatures = useMemo(() => {
    if (sectionId !== 'creatures') return null;
    
    const groups: Record<string, Article[]> = {};
    
    for (const article of list) {
      // Это поле теперь валидно
      const category = article.category?.trim() || 'Без категории'; 
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(article);
    }
    
    const categoryNames = Object.keys(groups).sort((a, b) => {
      if (a === 'Без категории') return 1;
      if (b === 'Без категории') return -1;
      return a.localeCompare(b, 'ru');
    });
    
    return { groups, categoryNames };

  }, [list, sectionId]);
  
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  const toggleCard = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  useEffect(() => {
    if (!isLoaded) return;
    
    if (!expandedId) {
      const target = searchParams.get('article');
      if (target && list.some((item) => item.id === target)) {
        setExpandedId(target);
        setTimeout(() => {
          const el = document.getElementById('article-' + target);
          if (el) (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        return;
      }
    }
    if (!expandedId) return;
    if (!list.some((item) => item.id === expandedId)) {
      setExpandedId(list[0]?.id ?? null);
    }
  }, [list, expandedId, searchParams, isLoaded]);

  const renderArticleCard = (article: Article) => {
    const expanded = expandedId === article.id;
    const meta = SECTION_BY_ID[sectionId];
    
    return (
      <div key={article.id} id={'article-' + article.id} className={`lore-card ${expanded ? 'is-expanded' : ''}` }>
        <button type="button" className="lore-card-head" onClick={() => toggleCard(article.id)}>
          <span className="lore-card-icon" style={{ color: article.coverColor }}>
            <i className={article.icon || meta.icon} />
          </span>
          
          <div className="lore-card-meta">
            <div className="lore-card-title-row">
              <strong>{article.title}</strong>
              
              {sectionId === 'races' && (
                <div className="lore-stats-display">
                  {STATS_MAP.map(stat => (
                    <span key={stat.key} className="lore-stat" title={stat.label}>
                      <i className={stat.icon} /> {article.baseStats?.[stat.key] ?? 0}
                    </span>
                  ))}
                </div>
              )}

              {sectionId === 'creatures' && (
                <div className="lore-stats-display">
                  <span className="lore-stat" title="КД (Класс Доспеха)">
                    <i className="fa-solid fa-shield-halved" /> {article.ac || '?'}
                  </span>
                  <span className="lore-stat" title="Атаки">
                    <i className="fa-solid fa-gavel" /> {article.attacks || '...'}
                  </span>
                  {/* Мы не показываем категорию здесь, т.к. она будет в заголовке */}
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
  };


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
        {sectionId === 'creatures' && groupedCreatures ? (
          groupedCreatures.categoryNames.map(categoryName => (
            <React.Fragment key={categoryName}>
              <h2 className="lore-category-heading">{categoryName}</h2>
              {groupedCreatures.groups[categoryName].map(renderArticleCard)}
            </React.Fragment>
          ))
        ) : (
          list.map(renderArticleCard)
        )}
        
        {list.length === 0 && (
          <div className="lore-placeholder" style={{ gridColumn: '1 / -1' }}>
            <i className="fa-solid fa-wand-magic-sparkles" />
            <p>{!isLoaded ? 'Загружаем статьи...' : 'Статей пока нет. Создайте их в редакторе.'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoreSectionPage;
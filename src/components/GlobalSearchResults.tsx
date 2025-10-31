import React from 'react';
import { Link } from 'react-router-dom';
// [ИСПРАВЛЕНО] ❗️ Исправлен путь импорта
import { useSearch } from './SearchContext'; 
// [ИСПРАВЛЕНО] ❗️ Убран неиспользуемый импорт
// import { SECTION_BY_ID } from '../constants/loreSections';
import './GlobalSearchResults.css';

const GlobalSearchResults: React.FC = () => {
  const { searchQuery, results, setSearchQuery } = useSearch();

  if (!searchQuery.trim()) {
    return null;
  }

  const handleClickResult = () => {
    setSearchQuery('');
  };

  // [ИНФО] Эта логика для `to` (определение секции по иконке) -
  // та самая, что я давал. Она не идеальна, но должна работать.
  // Ошибка `article: any` (ts7006) ИСЧЕЗНЕТ, как только
  // ts(2307) `Cannot find module` будет исправлена.
  const getSectionFromIcon = (icon: string | undefined): string => {
    switch (icon) {
      case 'fa-solid fa-users': return 'characters';
      case 'fa-solid fa-dna': return 'races';
      case 'fa-solid fa-map': return 'worlds';
      case 'fa-solid fa-dragon': return 'creatures';
      default: return 'characters'; // Фоллбэк
    }
  };

  return (
    <div className="gs-overlay">
      <div className="gs-container">
        {results.length > 0 ? (
          <ul className="gs-results-list">
            {results.map(article => (
              <li key={article.id}>
                <Link 
                  to={`/lore/${getSectionFromIcon(article.icon)}?article=${article.id}`} 
                  className="gs-result-item" 
                  onClick={handleClickResult}
                >
                  <span className="gs-icon" style={{ color: article.coverColor }}>
                    <i className={article.icon || 'fa-solid fa-file-lines'} />
                  </span>
                  <div className="gs-meta">
                    <strong>{article.title}</strong>
                    <small>{article.summary}</small>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="gs-empty">
            <i className="fa-solid fa-box-open" />
            <p>Ничего не найдено по запросу "{searchQuery}"</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalSearchResults;
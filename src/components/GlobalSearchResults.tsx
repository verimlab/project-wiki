import React from 'react';
import { Link } from 'react-router-dom';
import { useSearch } from './SearchContext';
import './GlobalSearchResults.css';

const GlobalSearchResults: React.FC = () => {
  const { searchQuery, results, setSearchQuery } = useSearch();

  if (!searchQuery.trim()) return null;

  const handleClickResult = () => setSearchQuery('');

  return (
    <div className="gs-overlay">
      <div className="gs-container">
        {results.length > 0 ? (
          <ul className="gs-results-list">
            {results.map((article: any) => (
              <li key={article.id}>
                <Link
                  to={`/lore/${article.sectionId || 'characters'}?article=${article.id}`}
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

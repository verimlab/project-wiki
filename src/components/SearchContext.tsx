import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
// [ИСПРАВЛЕНО] Убраны ArticlesMap и buildDefaultArticles
import type { Article } from '../types/lore';
import { fetchArticles } from '../api/lore';

type SearchContextType = {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  results: Article[];
  isLoading: boolean;
};

const SearchContext = createContext<SearchContextType>({
  searchQuery: '',
  setSearchQuery: () => {},
  results: [],
  isLoading: true,
});

export const useSearch = () => useContext(SearchContext);

type SearchProviderProps = {
  children: React.ReactNode;
};

export const SearchProvider: React.FC<SearchProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [allArticles, setAllArticles] = useState<Article[]>([]);

  useEffect(() => {
    const loadAllArticles = async () => {
      try {
        const articlesMap = await fetchArticles();
        const flatList = Object.values(articlesMap).flat();
        setAllArticles(flatList);
      } catch (err) {
        console.error('Failed to load all articles for search', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadAllArticles();
  }, []);

  const results = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return []; 
    if (isLoading) return [];

    return allArticles.filter(article => 
      article.title.toLowerCase().includes(needle) ||
      article.summary.toLowerCase().includes(needle)
    );
  }, [searchQuery, allArticles, isLoading]);

  const value = {
    searchQuery,
    setSearchQuery,
    results,
    isLoading
  };

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
}
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Article, SectionId } from '../types/lore';
import { fetchArticles } from '../api/lore';

export type SearchResult = Article & { sectionId: SectionId };

type SearchContextType = {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  results: SearchResult[];
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
  const [allArticles, setAllArticles] = useState<SearchResult[]>([]);

  useEffect(() => {
    const loadAllArticles = async () => {
      try {
        const articlesMap = await fetchArticles();
        const withSections: SearchResult[] = Object.entries(articlesMap).flatMap(([sectionId, arr]) =>
          (arr as Article[]).map((a) => ({ ...a, sectionId: sectionId as SectionId }))
        );
        setAllArticles(withSections);
      } catch (err) {
        console.error('Failed to load all articles for search', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadAllArticles();
  }, []);

  const results = useMemo((): SearchResult[] => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle || isLoading) return [];
    return allArticles.filter(article =>
      (article.title || '').toLowerCase().includes(needle) ||
      (article.summary || '').toLowerCase().includes(needle)
    );
  }, [searchQuery, allArticles, isLoading]);

  const value: SearchContextType = {
    searchQuery,
    setSearchQuery,
    results,
    isLoading,
  };

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
};


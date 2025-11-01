import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ArticlesMap } from '../types/lore';
import { buildDefaultArticles } from '../data/loreDefaults';
import { fetchArticles } from '../api/lore';

type LoreContextType = {
  initialArticles: ArticlesMap;
  loaded: boolean;
  refresh: () => Promise<void>;
};

const LoreContext = createContext<LoreContextType>({
  initialArticles: buildDefaultArticles(),
  loaded: false,
  refresh: async () => {},
});

type LoreProviderProps = { children: React.ReactNode };

export const LoreProvider: React.FC<LoreProviderProps> = ({ children }) => {
  const CACHE_KEY = 'loreCacheV1';
  const [initialArticles, setInitialArticles] = useState<ArticlesMap>(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') as ArticlesMap | null;
      return cached ?? buildDefaultArticles();
    } catch {
      return buildDefaultArticles();
    }
  });
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    try {
      const cloud = await fetchArticles();
      setInitialArticles(cloud);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(cloud)); } catch {}
    } catch (e) {
      console.error('LoreProvider: failed to preload articles', e);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const value = useMemo<LoreContextType>(() => ({ initialArticles, loaded, refresh: load }), [initialArticles, loaded]);

  return (
    <LoreContext.Provider value={value}>
      {children}
    </LoreContext.Provider>
  );
};

export const useLore = () => useContext(LoreContext);

import { collection, onSnapshot, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebase';
import type { Article, ArticlesMap, SectionId } from '../types/lore';
import { SECTION_IDS } from '../constants/loreSections';

const emptyMap = (): ArticlesMap =>
  SECTION_IDS.reduce((acc, id) => {
    acc[id as SectionId] = [];
    return acc;
  }, {} as ArticlesMap);

const mapDocToArticle = (id: string, data: Record<string, unknown>): Article => {
  const updatedAtRaw = data.updatedAt;
  const updatedAt = typeof updatedAtRaw === 'number'
    ? updatedAtRaw
    : typeof updatedAtRaw === 'object' && updatedAtRaw !== null && 'toMillis' in updatedAtRaw
      ? (updatedAtRaw as { toMillis: () => number }).toMillis()
      : Date.now();

  return {
    id,
    title: (data.title as string) ?? 'Без названия',
    summary: (data.summary as string) ?? '',
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    coverColor: (data.coverColor as string | undefined) ?? '#7d9bff',
    icon: (data.icon as string | undefined) || undefined,
    content: (data.content as string) ?? '',
    updatedAt,
  };
};

export function useLoreArticles(initial?: ArticlesMap) {
  const [articles, setArticles] = useState<ArticlesMap>(initial ?? emptyMap());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let readyCount = 0;
    const unsubscribers = SECTION_IDS.map((sectionId) =>
      onSnapshot(query(collection(db, 'loreSections', sectionId, 'articles')), (snapshot) => {
        const list = snapshot.docs
          .map((doc) => mapDocToArticle(doc.id, doc.data()))
          .sort((a, b) => b.updatedAt - a.updatedAt);
        setArticles((prev) => ({ ...prev, [sectionId]: list }));
        readyCount += 1;
        if (readyCount >= SECTION_IDS.length) setLoading(false);
      },
      () => {
        readyCount += 1;
        if (readyCount >= SECTION_IDS.length) setLoading(false);
      }),
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, []);

  return { articles, loading } as const;
}

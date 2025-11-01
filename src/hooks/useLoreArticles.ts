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
  const updatedAtRaw = (data as any).updatedAt;
  const updatedAt = typeof updatedAtRaw === 'number'
    ? updatedAtRaw
    : (updatedAtRaw && typeof updatedAtRaw === 'object' && 'toMillis' in updatedAtRaw)
      ? (updatedAtRaw as { toMillis: () => number }).toMillis()
      : Date.now();

  const title = typeof (data as any).title === 'string' ? (data as any).title : 'Без названия';
  const summary = typeof (data as any).summary === 'string' ? (data as any).summary : '';
  const tags = Array.isArray((data as any).tags) ? ((data as any).tags as string[]) : [];
  const coverColor = typeof (data as any).coverColor === 'string' ? (data as any).coverColor : '#7d9bff';
  const icon = typeof (data as any).icon === 'string' ? (data as any).icon : undefined;
  const content = typeof (data as any).content === 'string' ? (data as any).content : '';

  const bs = (data as any).baseStats;
  const normalizedBaseStats: Record<string, number> | undefined = bs && typeof bs === 'object'
    ? Object.fromEntries(Object.entries(bs as Record<string, unknown>).map(([k, v]) => [k, typeof v === 'number' ? v : Number(v) || 0]))
    : undefined;

  const acVal = (data as any).ac;
  const attacksVal = (data as any).attacks;
  const categoryVal = (data as any).category;

  const article = {
    id,
    title,
    summary,
    tags,
    coverColor,
    icon,
    content,
    updatedAt,
    baseStats: normalizedBaseStats,
    ac: acVal != null ? String(acVal) : undefined,
    attacks: attacksVal != null ? String(attacksVal) : undefined,
  } as any;

  if (categoryVal != null) article.category = String(categoryVal);

  return article as Article;
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

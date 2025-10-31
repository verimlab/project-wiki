import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Article, ArticlesMap, SectionId } from '../types/lore';
import { LORE_SECTIONS } from '../constants/loreSections';

const sectionCollection = (sectionId: SectionId) =>
  collection(db, 'loreSections', sectionId, 'articles');

export async function saveArticle(sectionId: SectionId, article: Article) {
  const payload = {
    ...article,
    updatedAt: article.updatedAt ?? Date.now(),
  };
  await setDoc(doc(sectionCollection(sectionId), article.id), payload, { merge: true });
}

export async function deleteArticle(sectionId: SectionId, articleId: string) {
  await deleteDoc(doc(sectionCollection(sectionId), articleId));
}

/**
 * 🔄 Получить все статьи из Firebase
 * Возвращает объект вида { characters: Article[], races: Article[], ... }
 */
export async function fetchArticles(): Promise<ArticlesMap> {
  const result: ArticlesMap = {
    characters: [],
    races: [],
    worlds: [],
    creatures: []
  };

  // Проходим по всем секциям, объявленным в LORE_SECTIONS
  for (const section of LORE_SECTIONS) {
    const querySnapshot = await getDocs(sectionCollection(section.id));
    result[section.id] = querySnapshot.docs.map((doc) => doc.data() as Article);
  }

  return result;
}

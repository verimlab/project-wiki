import { collection, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Article, SectionId } from '../types/lore';

const sectionCollection = (sectionId: SectionId) => collection(db, 'loreSections', sectionId, 'articles');

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


// src/components/GazettePage.tsx

import React, { useState, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import type { User } from 'firebase/auth';
import {
  db,
  auth,
  storage,
} from '../firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc, 
  getDoc,
} from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

// Импортируем НОВЫЕ стили
import './GazettePage.css';
// Также импортируем старые для модальных окон
import './HomePage.css';

// Тип для выпуска газеты
interface Issue {
  id: string;
  title: string;
  imageUrl: string;
  createdAt: any;
}

// ===== УДАЛИЛИ ИНТЕРФЕЙС Comment =====

const GazettePage: React.FC = () => {
  // ===== Секция состояния (State) =====
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'gm' | 'player' | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Состояние для модального окна GM
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState('');
  const [newIssueFile, setNewIssueFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Состояние для модального окна просмотра
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  
  // ===== УДАЛИЛИ СОСТОЯНИЯ ДЛЯ КОММЕНТАРИЕВ =====
  // const [comments, setComments] = useState<Comment[]>([]);
  // const [newComment, setNewComment] = useState('');
  // const [loadingComments, setLoadingComments] = useState(false);

  // Ref для ссылки на изображение
  const imageRef = useRef<HTMLImageElement>(null);

  // ===== Секция useEffect =====

  // 1. Получение пользователя и его роли
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setRole(null);
        return;
      }

      const resolveRole = async () => {
        try {
          const tokenResult = await getIdTokenResult(nextUser, true);
          const claimRole = tokenResult.claims.role;
          if (claimRole === 'gm' || claimRole === 'player') {
            return claimRole as 'gm' | 'player';
          }

          const userDoc = await getDoc(doc(db, 'users', nextUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as { role?: unknown };
            if (data.role === 'gm' || data.role === 'player') {
              return data.role;
            }
          }
        } catch (tokenError) {
          console.error('Ошибка получения роли:', tokenError);
        }
        return 'player' as const;
      };

      const resolved = await resolveRole();
      setRole(resolved);
    });
    return () => unsubscribe();
  }, []);

  // 2. Загрузка списка выпусков газеты
  useEffect(() => {
    setLoading(true);
    const issuesQuery = query(
      collection(db, 'gazetteIssues'),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(
      issuesQuery,
      (querySnapshot) => {
        const issuesData: Issue[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data() as DocumentData;
          issuesData.push({
            id: doc.id,
            title: data.title,
            imageUrl: data.imageUrl,
            createdAt: data.createdAt,
          });
        });
        setIssues(issuesData);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError('Не удалось загрузить выпуски газеты.');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  // ===== УДАЛИЛИ useEffect ДЛЯ ЗАГРУЗКИ КОММЕНТАРИЕВ =====
  // useEffect(() => { ... }, [selectedIssue]);

  // ===== Секция Обработчиков (Handlers) =====

  // --- Обработчики GM ---
  const handleOpenUploadModal = () => setIsUploadModalOpen(true);
  const handleCloseUploadModal = () => {
    setIsUploadModalOpen(false);
    setNewIssueTitle('');
    setNewIssueFile(null);
    setUploading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setNewIssueFile(e.target.files[0]);
    }
  };

  const handleUploadIssue = async (e: FormEvent) => {
    e.preventDefault();
    if (!newIssueFile || !newIssueTitle.trim() || !user) return;

    setUploading(true);
    setError(null);

    try {
      const fileId = uuidv4();
      const fileRef = ref(storage, `gazette/${fileId}-${newIssueFile.name}`);
      await uploadBytes(fileRef, newIssueFile);

      const imageUrl = await getDownloadURL(fileRef);

      await addDoc(collection(db, 'gazetteIssues'), {
        title: newIssueTitle,
        imageUrl: imageUrl,
        uploaderUid: user.uid,
        createdAt: serverTimestamp(),
      });

      handleCloseUploadModal();
    } catch (err: any) { 
      console.error(err);
      setError('Ошибка при загрузке выпуска. Попробуйте снова.');
    } finally {
      setUploading(false);
    }
  };

  // --- Обработчики Игрока ---
  const handleOpenIssue = (issue: Issue) => setSelectedIssue(issue);
  
  const handleCloseIssue = () => {
    setSelectedIssue(null);
  };

  // ===== УДАЛИЛИ handlePostComment =====
  // const handlePostComment = async (e: FormEvent) => { ... };

  // Функция: Переключение полноэкранного режима
  const toggleFullScreen = () => {
    if (imageRef.current) {
      if (!document.fullscreenElement) {
        imageRef.current.requestFullscreen().catch(err => {
          console.error(`Ошибка при попытке перехода в полноэкранный режим: ${err.message}`);
        });
      } else {
        document.exitFullscreen();
      }
    }
  };

  // ===== Секция Рендеринга (JSX) =====
  const renderContent = () => {
    if (loading) {
      return <p className="gp-subtitle">Загрузка выпусков...</p>;
    }
    if (error) {
      return <p className="hw-auth-error">{error}</p>;
    }
    if (issues.length === 0) {
      return <p className="gp-subtitle">Пока нет ни одного выпуска.</p>;
    }

    return (
      <div className="gp-issue-grid">
        {issues.map((issue) => (
          <div
            key={issue.id}
            className="gp-issue-card"
            style={{ backgroundImage: `url(${issue.imageUrl})` }}
            onClick={() => handleOpenIssue(issue)}
            role="button"
            tabIndex={0}
          >
            <div className="gp-issue-card-title">{issue.title}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="hw-root">
      <main className="hw-main">
        <section className="gp-header">
          <h1 className="gp-title">Газета Кара'нокта</h1>
          <p className="gp-subtitle">Архив выпусков</p>
        </section>

        {/* Кнопка для GM */}
        {role === 'gm' && (
          <div className="gp-gm-actions">
            <button
              className="hw-modal-primary"
              onClick={handleOpenUploadModal}
            >
              <i className="fa-solid fa-plus" /> Создать выпуск
            </button>
          </div>
        )}

        {/* Сетка с выпусками */}
        {renderContent()}
      </main>

      {/* ===== Модальное окно №1: Загрузка (только для GM) ===== */}
      {isUploadModalOpen && (
        <div
          className="hw-modal-backdrop"
          role="presentation"
          onClick={handleCloseUploadModal}
        >
          <div
            className="hw-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="hw-modal-header">
              <div>
                <h2 id="upload-modal-title">Новый выпуск</h2>
                <p className="hw-modal-subtitle">
                  Загрузите изображение и введите заголовок
                </p>
              </div>
              <button
                className="hw-modal-close"
                type="button"
                onClick={handleCloseUploadModal}
                aria-label="Закрыть"
              >
                <i className="fa-solid fa-xmark" aria-hidden />
              </button>
            </header>
            <form className="gp-upload-form" onSubmit={handleUploadIssue}>
              <div className="gp-input-group">
                <label htmlFor="issueTitle">Заголовок</label>
                <input
                  id="issueTitle"
                  type="text"
                  className="gp-input"
                  value={newIssueTitle}
                  onChange={(e) => setNewIssueTitle(e.target.value)}
                  placeholder="Например, 'Выпуск №1'"
                  required
                />
              </div>
              <div className="gp-input-group">
                <label htmlFor="issueFile">Изображение (JPG, PNG)</label>
                <input
                  id="issueFile"
                  type="file"
                  className="gp-input"
                  accept="image/png, image/jpeg"
                  onChange={handleFileChange}
                  required
                />
              </div>
              {error && <div className="hw-auth-error" role="alert">{error}</div>}
              <footer className="hw-modal-actions">
                <button
                  className="hw-modal-primary"
                  type="submit"
                  disabled={uploading}
                >
                  {uploading ? 'Загрузка...' : 'Опубликовать'}
                </button>
                <button
                  className="hw-modal-secondary"
                  type="button"
                  onClick={handleCloseUploadModal}
                >
                  Отмена
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* ===== Модальное окно №2: Просмотр (БЕЗ КОММЕНТАРИЕВ) ===== */}
      {selectedIssue && (
        <div
          className="hw-modal-backdrop"
          role="presentation"
          onClick={handleCloseIssue}
        >
          <div
            className="hw-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="hw-modal-header">
              <div>
                <h2 id="issue-modal-title">{selectedIssue.title}</h2>
              </div>
              <button
                className="hw-modal-close"
                type="button"
                onClick={handleCloseIssue}
                aria-label="Закрыть"
              >
                <i className="fa-solid fa-xmark" aria-hidden />
              </button>
            </header>
            
            <div className="gp-issue-modal-body">
              <img
                ref={imageRef} 
                src={selectedIssue.imageUrl}
                alt={selectedIssue.title}
                className="gp-modal-image"
                onClick={toggleFullScreen}
              />
              {/* ===== УДАЛИЛИ СЕКЦИЮ КОММЕНТАРИЕВ ===== */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GazettePage;
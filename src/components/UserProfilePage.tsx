// src/components/UserProfilePage.tsx

import React, { useEffect, useMemo, useState, useRef } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut, updateProfile } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'; // <-- 1. Импорт Storage
import { Link, useNavigate } from 'react-router-dom';
import { auth, db, storage } from '../firebase'; // <-- 2. Импорт storage
import './UserProfilePage.css';
import './HomePage.css';

const UserProfilePage: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'gm' | 'player' | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  // --- Новые состояния ---
  const [isUploading, setIsUploading] = useState(false); // Для аватара
  const [uploadError, setUploadError] = useState<string | null>(null); // Для аватара
  const [notesCount, setNotesCount] = useState(0); // Для статистики
  const [charsCount, setCharsCount] = useState(0); // Для статистики
  const fileInputRef = useRef<HTMLInputElement>(null); // Для клика по инпуту
  // -----------------------

  // Загрузка данных пользователя
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!nextUser) {
        navigate('/');
        return;
      }

      setUser(nextUser);
      setDisplayName(nextUser.displayName || '');

      const resolveRole = async () => {
        try {
          const tokenResult = await nextUser.getIdTokenResult(true);
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
          console.error(tokenError);
        }
        return 'player' as const;
      };

      const resolved = await resolveRole();
      setRole(resolved);
    });
    return () => unsubscribe();
  }, [navigate]);

  // --- НОВЫЙ useEffect для загрузки статистики ---
  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      try {
        // 1. Запрос заметок
        const notesQuery = query(
          collection(db, 'playerNotes'),
          where('ownerUid', '==', user.uid)
        );
        const notesSnap = await getDocs(notesQuery);
        setNotesCount(notesSnap.size);

        // 2. Запрос персонажей (!! ИЗМЕНИ 'playerSheets' если коллекция другая !!)
        const charsQuery = query(
          collection(db, 'characterSheets'),
          where('ownerUid', '==', user.uid)
        );
        const charsSnap = await getDocs(charsQuery);
        setCharsCount(charsSnap.size);

      } catch (error) {
        console.error("Ошибка загрузки статистики:", error);
      }
    };

    fetchStats();
  }, [user]); // Запускаем при появлении user
  // ---------------------------------------------

  const roleLabel = useMemo(() => {
    if (role === 'gm') return 'Гейм-мастер';
    if (role === 'player') return 'Игрок';
    return 'Участник';
  }, [role]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (signOutError) {
      console.error(signOutError);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    setSuccessMessage(null);
    try {
      await updateProfile(user, { displayName });
      setSuccessMessage('Профиль успешно обновлен!');
    } catch (error) {
      console.error('Ошибка обновления профиля:', error);
    } finally {
      setIsLoading(false);
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const joinDate = useMemo(() => {
    if (!user?.metadata.creationTime) return '...';
    return new Date(user.metadata.creationTime).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [user]);
  
  // --- НОВАЯ ЛОГИКА ДЛЯ ЗАГРУЗКИ АВАТАРА ---
  const handleAvatarClick = () => {
    if (isUploading) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    setUploadError(null);

    const storageRef = ref(storage, `avatars/${user.uid}`); // Путь в Storage

    try {
      // 1. Загружаем файл
      const snapshot = await uploadBytes(storageRef, file);
      // 2. Получаем URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      // 3. Обновляем профиль Firebase Auth
      await updateProfile(user, { photoURL: downloadURL });
      
      // 4. Обновляем состояние user локально для немедленного отображения
      setUser({ ...user, photoURL: downloadURL }); 

    } catch (error) {
      console.error("Ошибка загрузки аватара:", error);
      setUploadError('Не удалось загрузить файл. Попробуйте снова.');
    } finally {
      setIsUploading(false);
      // Сбрасываем инпут, чтобы можно было загрузить тот же файл
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };
  // -----------------------------------------

  if (!user) {
    return null;
  }

  return (
    <div className="hw-root">
      <header className="hw-topbar">
        <Link className="hw-brand" to="/">
          <span className="hw-brand-icon" aria-hidden><i className="fa-regular fa-gem" /></span>
          <span>Project Wiki</span>
        </Link>
        <div className="hw-search-form" style={{ visibility: 'hidden' }} />
        <div className="hw-user">
          <Link to="/profile" className="hw-identity" title="Перейти в профиль">
            <span className="hw-user-name">{user.displayName}</span>
            <span className="hw-role">{roleLabel}</span>
          </Link>
          <button className="hw-logout" type="button" onClick={handleSignOut}>
            <i className="fa-solid fa-arrow-right-from-bracket" aria-hidden />
            <span>Выйти</span>
          </button>
        </div>
      </header>

      <main className="hw-main profile-page-main">
        <h1 className="profile-page-title">Профиль пользователя</h1>

        <form className="profile-card" onSubmit={handleSaveProfile}>
          
          {/* --- ОБНОВЛЕННЫЙ БЛОК АВАТАРА --- */}
          <div 
            className={`profile-avatar ${isUploading ? 'is-uploading' : ''}`}
            title="Нажмите, чтобы изменить аватар"
            onClick={handleAvatarClick}
          >
            {user.photoURL ? (
              <img src={user.photoURL} alt="Аватар" />
            ) : (
              <i className="fa-solid fa-user-astronaut" />
            )}
            <div className="profile-avatar-overlay">
              {isUploading ? (
                <i className="fa-solid fa-spinner fa-spin" />
              ) : (
                <i className="fa-solid fa-pencil" />
              )}
            </div>
          </div>
          {/* Скрытый input для выбора файла */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
            accept="image/png, image/jpeg, image/gif"
          />
          {/* ---------------------------------- */}

          <div className="profile-info">
            <div className="profile-field">
              <label htmlFor="displayName">Ваше имя</label>
              <input
                id="displayName"
                type="text"
                className="profile-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="profile-field">
              <label>Email</label>
              <p className="profile-text-value">{user.email}</p>
            </div>
            <div className="profile-field">
              <label>Роль</label>
              <p className="profile-text-value">{roleLabel}</p>
            </div>
            <div className="profile-actions">
              <button
                className="hw-modal-primary"
                type="submit"
                disabled={isLoading || isUploading}
              >
                {isLoading ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button
                className="hw-logout"
                type="button"
                onClick={handleSignOut}
              >
                Выйти
              </button>
            </div>
            {successMessage && <p className="profile-success">{successMessage}</p>}
            {uploadError && <p className="profile-error">{uploadError}</p>}
          </div>
        </form>

        <h2 className="profile-section-title">Статистика</h2>
        
        {/* --- ОБНОВЛЕННЫЙ БЛОК СТАТИСТИКИ --- */}
        <section className="hw-grid profile-stats-grid">
          <div className="hw-card is-stat">
            <span className="hw-card-icon">
              <i className="fa-solid fa-user-group" />
            </span>
            <span className="stat-value">{charsCount}</span>
            <span className="stat-label">Персонажей</span>
          </div>

          <div className="hw-card is-stat">
            <span className="hw-card-icon">
              <i className="fa-regular fa-note-sticky" />
            </span>
            <span className="stat-value">{notesCount}</span>
            <span className="stat-label">Заметок</span>
          </div>

          <div className="hw-card is-stat">
            <span className="hw-card-icon">
              <i className="fa-solid fa-calendar-check" />
            </span>
            <span className="stat-value-small">{joinDate}</span>
            <span className="stat-label">Дата регистрации</span>
          </div>
        </section>
        {/* ------------------------------------- */}
      </main>
    </div>
  );
};

export default UserProfilePage;
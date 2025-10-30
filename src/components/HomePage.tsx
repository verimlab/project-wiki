﻿// src/components/HomePage.tsx

﻿import React, { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { getIdTokenResult, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import './HomePage.css';
import { auth, db, googleProvider } from '../firebase';
import { WEAPONS, ARMOR } from '../data/equipment';
import type { Article } from '../types/lore';
import { buildDefaultArticles } from '../data/loreDefaults';
type DiceResultGroup = {
  faces: number;
  rolls: number[];
};

const sectors: Array<{ id: string; label: string; iconClass: string; restrictedTo?: 'gm' | 'player' }> = [
  { id: 'gm', label: 'GM Hub', iconClass: 'fa-solid fa-hat-wizard', restrictedTo: 'gm' },
  { id: 'chars', label: 'Персонажи', iconClass: 'fa-solid fa-user-group' },
  { id: 'campaign', label: 'Кампания', iconClass: 'fa-solid fa-flag' },
  { id: 'equipment', label: 'Снаряжение', iconClass: 'fa-solid fa-shield-halved' },
  { id: 'races', label: 'Расы', iconClass: 'fa-solid fa-people-group' },
  { id: 'worlds', label: 'Миры', iconClass: 'fa-solid fa-globe' },
  { id: 'creatures', label: 'Монстры', iconClass: 'fa-solid fa-dragon' },
  { id: 'items', label: 'Предметы', iconClass: 'fa-solid fa-box-open' },
  { id: 'notes', label: 'Заметки', iconClass: 'fa-regular fa-note-sticky' },
  { id: 'gazette', label: 'Газета Кара\'нокта', iconClass: 'fa-regular fa-newspaper' },
];

type SearchResultItem = {
  type: 'Оружие' | 'Броня' | 'Эпизод' | 'Заметка' | 'Персонаж' | 'Раса' | 'Мир' | 'Существо';
  id: string;
  title: string;
  description: string;
  path: string;
};

type SearchResults = {
  items: SearchResultItem[];
  query: string;
};


const diceOptions = [4, 6, 8, 10, 12, 20, 100, 1000];

const buildInitialDiceConfig = () =>
  diceOptions.reduce<Record<number, number>>((acc, faces) => {
    acc[faces] = faces === 20 ? 1 : 0;
    return acc;
  }, {});

const MIGRATION_MODAL_KEY = 'hw-migration-banner';

const HomePage: React.FC = () => {
  const [isDiceOpen, setIsDiceOpen] = useState(false);
  const [diceConfig, setDiceConfig] = useState<Record<number, number>>(buildInitialDiceConfig);
  const [results, setResults] = useState<DiceResultGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [role, setRole] = useState<'gm' | 'player' | null>(null);
  const [isMigrationModalOpen, setMigrationModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const suppressionFlag = window.localStorage.getItem(MIGRATION_MODAL_KEY);
    if (suppressionFlag !== 'hidden') {
      setMigrationModalOpen(true);
    }
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
          console.error(tokenError);
        }
        return 'player' as const;
      };

      const resolved = await resolveRole();
      setRole(resolved);
    });
    return () => unsubscribe();
  }, []);

  const total = useMemo(() => {
    if (!results) return null;
    return results.reduce((sum, group) => sum + group.rolls.reduce((acc, roll) => acc + roll, 0), 0);
  }, [results]);

  const selectedDiceCount = useMemo(
    () => Object.values(diceConfig).reduce((acc, value) => acc + value, 0),
    [diceConfig],
  );

  const sectorRoutes: Record<string, string> = {
    gm: '/gm-hub',
    campaign: '/campaign',
    equipment: '/equipment',
    notes: '/notes',
    chars: '/lore/characters',
    races: '/lore/races',
    worlds: '/lore/worlds',
    creatures: '/lore/creatures',
    items: '/gm-items',
    gazette: '/gazette', 
  };

  const openDice = () => {
    setIsDiceOpen(true);
    setResults(null);
    setError(null);
  };

  const closeDice = () => {
    setIsDiceOpen(false);
  };

  const adjustDie = (faces: number, delta: number) => {
    setDiceConfig((prev) => {
      const current = prev[faces] ?? 0;
      const nextCount = Math.min(30, Math.max(0, current + delta));
      if (nextCount === current) {
        return prev;
      }
      return { ...prev, [faces]: nextCount };
    });
    setError(null);
  };

  const handleRoll = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const groups = diceOptions
      .filter((faces) => (diceConfig[faces] ?? 0) > 0)
      .map((faces) => ({
        faces,
        rolls: Array.from({ length: diceConfig[faces] ?? 0 }, () => Math.floor(Math.random() * faces) + 1),
      }));

    if (groups.length === 0) {
      setError('Добавьте хотя бы один куб, чтобы сделать бросок.');
      setResults(null);
      return;
    }

    setError(null);
    setResults(groups);
  };

  const handleSearchSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const term = searchQuery.trim().toLowerCase();
    if (!term) return;

    setSearchLoading(true);
    setSearchError(null);
    setIsSearchModalOpen(true);
    setSearchResults(null);

    const defaults = buildDefaultArticles();

    try {
      const results: SearchResultItem[] = [];

      // Search local equipment
      WEAPONS.forEach(w => {
        const nameMatch = w.name?.toLowerCase().includes(term) ?? false;
        const descMatch = w.description?.toLowerCase().includes(term) ?? false;
        if (nameMatch || descMatch) {
          results.push({ type: 'Оружие', id: w.id, title: w.name, description: w.description || '', path: `/equipment?id=${w.id}` });
        }
      });
      ARMOR.forEach(a => {
        const nameMatch = a.name?.toLowerCase().includes(term) ?? false;
        const descMatch = a.description?.toLowerCase().includes(term) ?? false;
        if (nameMatch || descMatch) {
          results.push({ type: 'Броня', id: a.id, title: a.name, description: a.description || '', path: `/equipment?id=${a.id}` });
        }
      });

      // Search Firestore Lore Articles (Characters, Races, Worlds, Creatures)
      const loreSections: { id: 'characters' | 'races' | 'worlds' | 'creatures'; type: SearchResultItem['type'] }[] = [
        { id: 'characters', type: 'Персонаж' },
        { id: 'races', type: 'Раса' },
        { id: 'worlds', type: 'Мир' },
        { id: 'creatures', type: 'Существо' },
      ];

      for (const section of loreSections) {
        const loreQuery = query(collection(db, section.id));
        const loreSnap = await getDocs(loreQuery);
        
        const addedIds = new Set<string>();

        loreSnap.forEach(doc => {
          const data = doc.data() as Article;
          const id = doc.id;
          addedIds.add(id); 

          const titleMatch = data.title?.toLowerCase().includes(term) ?? false;
          const summaryMatch = data.summary?.toLowerCase().includes(term) ?? false;
          const contentMatch = data.content?.toLowerCase().includes(term) ?? false;

          if (titleMatch || summaryMatch || contentMatch) {
            results.push({ type: section.type, id: id, title: data.title || 'Без названия', description: data.summary || '', path: `/lore/${section.id}?article=${id}` });
          }
        });

        const defaultArticles = defaults[section.id] || [];
        
        defaultArticles.forEach(data => {
          if (addedIds.has(data.id)) {
            return; 
          }

          const titleMatch = data.title?.toLowerCase().includes(term) ?? false;
          const summaryMatch = data.summary?.toLowerCase().includes(term) ?? false;
          const contentMatch = data.content?.toLowerCase().includes(term) ?? false;

          if (titleMatch || summaryMatch || contentMatch) {
            results.push({
              type: section.type,
              id: data.id,
              title: data.title || 'Без названия',
              description: data.summary || '',
              path: `/lore/${section.id}?article=${data.id}`
            });
          }
        });
      }

      // Search Firestore episodes
      const episodesQuery = query(collection(db, 'campaignEpisodes'));
      const episodeSnap = await getDocs(episodesQuery);
      episodeSnap.forEach(doc => {
        const data = doc.data();
        
        const titleMatch = data.title?.toLowerCase().includes(term) ?? false;
        const contentMatch = data.content?.toLowerCase().includes(term) ?? false;

        if (titleMatch || contentMatch) {
          results.push({ type: 'Эпизод', id: doc.id, title: data.title || 'Без названия', description: (data.content || '').substring(0, 150) + '...', path: '/campaign' });
        }
      });

      // Search Firestore notes (for current user)
      if (user) {
        const notesQuery = query(
          collection(db, 'playerNotes'),
          where('ownerUid', '==', user.uid)
        );
        const notesSnap = await getDocs(notesQuery);
        notesSnap.forEach(doc => {
          const data = doc.data();
          
          const titleMatch = data.title?.toLowerCase().includes(term) ?? false;
          const contentMatch = data.content?.toLowerCase().includes(term) ?? false;

          if (titleMatch || contentMatch) {
            results.push({ type: 'Заметка', id: doc.id, title: data.title || 'Без названия', description: (data.content || '').substring(0, 150) + '...', path: `/notes?id=${doc.id}` });
          }
        });
      }

      setSearchResults({ items: results, query: searchQuery });
    } catch (err) {
      console.error("Search failed:", err);
      setSearchError(`Произошла ошибка во время поиска: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSearchLoading(false);
    }
  };

  const closeSearchModal = () => {
    setIsSearchModalOpen(false);
    setSearchResults(null);
  };

  const openAuthModal = () => {
    setIsAuthModalOpen(true);
    setAuthError(null);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setAuthError(null);
  };

  const handleGoogleSignIn = async () => {
    if (typeof window === 'undefined') return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      setIsAuthModalOpen(false);
    } catch (signInError) {
      setAuthError('Не удалось выполнить вход. Попробуйте ещё раз.');
      console.error(signInError);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setRole(null);
    } catch (signOutError) {
      console.error(signOutError);
    }
  };

  const displayName = user?.displayName ?? user?.email ?? 'Гость';
  const photoURL = user?.photoURL;
  const roleLabel = role === 'gm' ? 'Гейм-мастер' : role === 'player' ? 'Игрок' : 'Участник';
  const handleMigrationClose = () => setMigrationModalOpen(false);
  const handleMigrationHide = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(MIGRATION_MODAL_KEY, 'hidden');
    }
    setMigrationModalOpen(false);
  };

  return (
    <div className="hw-root">
      <header className="hw-topbar">
        <div className="hw-brand">
          <span className="hw-brand-icon" aria-hidden><i className="fa-regular fa-gem" /></span>
          <span>Project Wiki</span>
        </div>
        {user ? (
          <>
            <form className="hw-search-form" onSubmit={handleSearchSubmit}>
              <input
                type="text"
                placeholder="Поиск..."
                className="hw-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="hw-search-button" aria-label="Искать"><i className="fa-solid fa-magnifying-glass" /></button>
            </form>
            <div className="hw-user">
              
              <Link to="/profile" className="hw-identity" title="Перейти в профиль">
                {photoURL ? (
                  <img src={photoURL} alt="Аватар" className="hw-avatar" />
                ) : (
                  <span className="hw-avatar-fallback" aria-hidden="true">
                    <i className="fa-solid fa-user" />
                  </span>
                )}
                <div className="hw-identity-text">
                  <span className="hw-user-name">{displayName}</span>
                  <span className="hw-role">{roleLabel}</span>
                </div>
              </Link>

              <button className="hw-logout" type="button" onClick={handleSignOut}>
                <i className="fa-solid fa-arrow-right-from-bracket" aria-hidden />
                <span>Выйти</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <form className="hw-search-form" onSubmit={handleSearchSubmit}>
              <input
                type="text"
                placeholder="Поиск..."
                className="hw-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="hw-search-button" aria-label="Искать"><i className="fa-solid fa-magnifying-glass" /></button>
            </form>
            <button className="hw-login" type="button" onClick={openAuthModal}>
              <i className="fa-solid fa-user-astronaut" aria-hidden />
              <span>Войти</span> 
          </button>
          </>
        )}
      </header>

      {isSearchModalOpen && (
        <div className="hw-modal-backdrop" role="presentation" onClick={closeSearchModal}>
          <div className="hw-search-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <header className="hw-modal-header">
              <div>
                <h2 id="search-modal-title">Результаты поиска</h2>
                {searchResults && <p className="hw-modal-subtitle">По запросу: "{searchResults.query}"</p>}
              </div>
              <button className="hw-modal-close" type="button" onClick={closeSearchModal} aria-label="Закрыть">
                <i className="fa-solid fa-xmark" aria-hidden />
              </button>
            </header>
            <div className="hw-search-results-body">
              {searchLoading && <p>Идет поиск...</p>}
              {searchError && <p className="hw-dice-error">{searchError}</p>}
              {searchResults && (
                searchResults.items.length > 0 ? (
                  <ul className="hw-search-results-list">
                    {searchResults.items.map(item => (
                      <li key={`${item.type}-${item.id}`} className="hw-search-result-item">
                        <Link to={item.path} onClick={closeSearchModal}>
                          <span className="hw-search-item-type">{item.type}</span>
                          <span className="hw-search-item-title">{item.title}</span>
                          <p className="hw-search-item-desc">{item.description}</p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Ничего не найдено.</p>
                )
              )}
            </div>
            <footer className="hw-modal-actions">
              <button className="hw-modal-secondary" type="button" onClick={closeSearchModal}>
                Закрыть
              </button>
            </footer>
          </div>
        </div>
      )}

      <main className="hw-main">
        <section className="hw-hero">
          <h1 className="neon">СИСТЕМА</h1>
          <p className="subtitle">Выберите раздел для изучения</p>
        </section>

        <section className="hw-grid" aria-label="Сектора">
          {sectors
            .filter((s) => !s.restrictedTo || s.restrictedTo === role)
            .map((s) => (
            <Link
              key={s.id}
              className="hw-card"
              to={sectorRoutes[s.id] ?? `#${s.id}`}
              aria-label={s.label}
            >
              {/* ===== НАЧАЛО ИЗМЕНЕНИЙ ===== */}
              <div className="hw-card-header">
                <span className="hw-card-icon">
                  <i className={s.iconClass} aria-hidden />
                </span>
                <span className="hw-card-title">{s.label}</span>
              </div>
              {/* ===== КОНЕЦ ИЗМЕНЕНИЙ ===== */}
              <span className="hw-card-cta">
                Перейти <i className="fa-solid fa-arrow-right" aria-hidden />
              </span>
            </Link>
          ))}
        </section>
      </main>

      <div className="hw-actions" aria-label="Быстрые действия">
        <button className="hw-action hw-action-primary" type="button" onClick={openDice}>
          <span className="hw-action-icon" aria-hidden><i className="fa-solid fa-dice-d20" /></span>
          <span className="hw-action-text">Бросок кубиков</span>
        </button>
        <Link className="hw-action hw-action-secondary" to="/character-sheet">
          <span className="hw-action-icon" aria-hidden><i className="fa-solid fa-scroll" /></span>
          <span className="hw-action-text">Лист персонажа</span>
        </Link>
      </div>

      {isDiceOpen && (
        <div className="hw-modal-backdrop" role="presentation" onClick={closeDice}>
          <div
            className="hw-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dice-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="hw-modal-header">
              <div>
                <h2 id="dice-modal-title">Бросок кубиков</h2>
                <p className="hw-modal-subtitle">Выберите тип и количество кубиков для броска</p>
              </div>
              <button className="hw-modal-close" type="button" onClick={closeDice} aria-label="Закрыть">
                <i className="fa-solid fa-xmark" aria-hidden />
              </button>
            </header>

            <form className="hw-modal-body" onSubmit={handleRoll}>
              <section className="hw-dice-grid" aria-label="Выбор кубов">
                {diceOptions.map((faces) => {
                  const count = diceConfig[faces] ?? 0;
                  return (
                    <div
                      key={faces}
                      className={`hw-dice-item${count > 0 ? ' is-active' : ''}`}
                    >
                      <span className="hw-dice-label">d{faces}</span>
                      <div className="hw-dice-controls">
                        <button
                          type="button"
                          className="hw-dice-btn"
                          onClick={() => adjustDie(faces, -1)}
                          disabled={count === 0}
                          aria-label={`Уменьшить количество d${faces}`}
                        >
                          <i className="fa-solid fa-minus" aria-hidden />
                        </button>
                        <span className="hw-dice-count">{count}</span>
                        <button
                          type="button"
                          className="hw-dice-btn"
                          onClick={() => adjustDie(faces, 1)}
                          aria-label={`Увеличить количество d${faces}`}
                        >
                          <i className="fa-solid fa-plus" aria-hidden />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </section>

              <div className="hw-dice-summary">
                <span>Количество кубов: {selectedDiceCount}</span>
                {error && <span className="hw-dice-error">{error}</span>}
              </div>

              <footer className="hw-modal-actions">
                <button className="hw-modal-primary" type="submit">
                  Подтвердить бросок
                </button>
                <button className="hw-modal-secondary" type="button" onClick={closeDice}>
                  Закрыть
                </button>
              </footer>
            </form>

            {results && (
              <section className="hw-modal-results" aria-live="polite">
                <h3>Результаты броска</h3>
                <div className="hw-results-groups">
                  {results.map((group) => (
                    <div key={group.faces} className="hw-result-group">
                      <span className="hw-result-title">d{group.faces}</span>
                      <div className="hw-results-rolls">
                        {group.rolls.map((value, index) => (
                          <span key={index} className="hw-result-chip">{value}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {total !== null && (
                  <div className="hw-results-total">
                    <span>Итого:</span>
                    <strong>{total}</strong>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      )}

      {isAuthModalOpen && (
        <div className="hw-modal-backdrop" role="presentation" onClick={closeAuthModal}>
          <div
            className="hw-auth-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="hw-auth-header">
              <div>
                <h2 id="auth-modal-title">Вход в аккаунт</h2>
                <p className="hw-auth-subtitle">Используйте Google, чтобы синхронизировать данные и доступ</p>
              </div>
              <button className="hw-modal-close" type="button" onClick={closeAuthModal} aria-label="Закрыть">
                <i className="fa-solid fa-xmark" aria-hidden />
              </button>
            </header>

            <div className="hw-auth-content">
              <button
                className="hw-auth-google"
                type="button"
                onClick={handleGoogleSignIn}
                disabled={authLoading}
              >
                <span className="hw-auth-google-icon" aria-hidden>
                  <i className="fa-brands fa-google" />
                </span>
                <span>{authLoading ? 'Ожидайте…' : 'Вход через Google'}</span>
              </button>
              {authError && <div className="hw-auth-error" role="alert">{authError}</div>}
              <p className="hw-auth-note">Продолжая, вы соглашаетесь с обработкой данных и политикой конфиденциальности проекта.</p>
            </div>
          </div>
        </div>
      )}
      {isMigrationModalOpen && (
        <div className="hw-modal-backdrop" role="presentation" onClick={handleMigrationClose}>
          <div
            className="hw-migration-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="migration-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="hw-migration-header">
              <div>
                <p className="hw-migration-kicker">Привет странник!</p>
                <h2 id="migration-modal-title">Предупреждение!</h2>
              </div>
              <button className="hw-modal-close" type="button" onClick={handleMigrationClose} aria-label="modal-warning">
                <i className="fa-solid fa-xmark" aria-hidden />
              </button>
            </header>
            <div className="hw-migration-body">
              <p>
                Привет! Сайт был перенесён на новую, более мощную, стабильную и совремнную архитектуру. Сейчас работа еще в прогрессе и многое может выглядеть некорректно, неработать или работать неправильно. Это далеко не финальный вид сайта и мы продолжаем работать чтобы всё выглядело превосходно и работало как надо! Спасибо за терпени и понимание, сообщай о багах если их найдешь.
              </p>
            </div>
            <div className="hw-migration-actions">
              <button type="button" className="hw-migration-btn" onClick={handleMigrationClose}>Понятно</button>
              <button type="button" className="hw-migration-btn is-primary" onClick={handleMigrationHide}>Больше не показывать</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
// src/components/TopBar.tsx

import React, { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import type { User } from 'firebase/auth';
import { useSearch } from './SearchContext';
import { useAuth } from './AuthContext';

type TopBarProps = {
  // no props for now
};

const TopBar: React.FC<TopBarProps> = () => {
  const { searchQuery, setSearchQuery } = useSearch();
  const { user, role, signIn } = useAuth();
  const [authLoading, setAuthLoading] = useState(false);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    try {
      await signIn();
    } catch (err) {
      console.error(err);
    } finally {
      setAuthLoading(false);
    }
  };

  // Sign out control removed from top bar

  const displayName: string = user?.displayName ?? user?.email ?? 'Гость';
  const photoURL: User['photoURL'] = user?.photoURL ?? null;
  const roleLabel = role === 'gm' ? 'Мастер' : role === 'player' ? 'Игрок' : 'Гость';

  return (
    <header className="hw-topbar">
      <Link to="/" className="hw-brand">
        <span className="hw-brand-icon" aria-hidden>
          <i className="fa-regular fa-gem" />
        </span>
        <span>Project Wiki</span>
      </Link>
      {user ? (
        <>
          <form className="hw-search-form" onSubmit={handleSearchSubmit}>
            <input
              type="text"
              placeholder="Поиск по справочнику..."
              className="hw-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="hw-search-button" aria-label="Поиск">
              <i className="fa-solid fa-magnifying-glass" />
            </button>
          </form>
          <div className="hw-user">
            <Link to="/profile" className="hw-identity" title="Профиль">
              {photoURL ? (
                <img src={photoURL} alt="Аватар" className="hw-avatar" />
              ) : (
                <span className="hw-avatar-fallback" aria-hidden>
                  <i className="fa-solid fa-user" />
                </span>
              )}
              <div className="hw-identity-text">
                <span className="hw-user-name">{displayName}</span>
                <span className="hw-role">{roleLabel}</span>
              </div>
            </Link>
            {/* Logout button removed from top bar by request */}
          </div>
        </>
      ) : (
        <>
          <form className="hw-search-form" onSubmit={handleSearchSubmit}>
            <input
              type="text"
              placeholder="Поиск по справочнику..."
              className="hw-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="hw-search-button" aria-label="Поиск">
              <i className="fa-solid fa-magnifying-glass" />
            </button>
          </form>
          <button className="hw-login" type="button" onClick={handleGoogleSignIn} disabled={authLoading}>
            <i className="fa-solid fa-user-astronaut" aria-hidden />
            <span>{authLoading ? '...' : 'Войти'}</span>
          </button>
        </>
      )}
    </header>
  );
};

export default TopBar;

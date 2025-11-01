import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signInWithPopup, signOut, getIdTokenResult } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';

export type UserRole = 'gm' | 'player' | null;

type AuthContextType = {
  user: User | null;
  role: UserRole;
  loading: boolean;
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  signIn: async () => {},
  signOutUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

type AuthProviderProps = {
  children: React.ReactNode;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const CACHE_KEY = 'authCacheV1';
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [role, setRole] = useState<UserRole>(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') as { uid?: string; role?: unknown; ts?: number } | null;
      if (cached && (cached.role === 'gm' || cached.role === 'player')) {
        return cached.role as UserRole;
      }
    } catch {}
    return null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setRole(null);
        setLoading(false);
        return;
      }
      try {
        // Try custom claim first
        const token = await getIdTokenResult(u, true);
        const claimRole = token.claims.role;
        if (claimRole === 'gm' || claimRole === 'player') {
          setRole(claimRole as UserRole);
          setLoading(false);
          return;
        }
        // Fallback to users collection
        const userDoc = await getDoc(doc(db, 'users', u.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as { role?: unknown };
          if (data.role === 'gm' || data.role === 'player') {
            setRole(data.role as UserRole);
            setLoading(false);
            return;
          }
        }
        // Default if nothing is set
        setRole('player');
      } catch (e) {
        console.error('AuthContext: failed to resolve role', e);
        setRole('player');
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const signIn = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const signOutUser = async () => {
    await signOut(auth);
  };

  // cache last known role for next reload to avoid UI flicker
  useEffect(() => {
    try {
      if (user && (role === 'gm' || role === 'player')) {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ uid: user.uid, role, ts: Date.now() }));
      }
      if (!user) {
        localStorage.removeItem(CACHE_KEY);
      }
    } catch {}
  }, [user?.uid, role]);

  const value = useMemo<AuthContextType>(
    () => ({ user, role, loading, signIn, signOutUser }),
    [user, role, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

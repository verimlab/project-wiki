import { useState, useEffect } from 'react';
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

type UserRole = 'gm' | 'player' | null;

export const useRole = () => {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        const tokenResult = await getIdTokenResult(user, true);
        const claimRole = tokenResult.claims.role;
        if (claimRole === 'gm' || claimRole === 'player') {
          setRole(claimRole as UserRole);
          setLoading(false);
          return;
        }

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as { role?: unknown };
          if (data.role === 'gm' || data.role === 'player') {
            setRole(data.role as UserRole);
            setLoading(false);
            return;
          }
        }
      } catch (error) {
        console.error("Error resolving user role:", error);
      }
      setRole('player'); // Default to player if no specific role is found
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { role, loading };
};
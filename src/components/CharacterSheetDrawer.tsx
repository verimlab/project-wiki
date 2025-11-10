import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { CharacterSheet } from '../types/sheet';
import PlayerSheetModal from './PlayerSheetModal';

type CharacterSheetDrawerProps = {
  sheetId: string;
  onClose: () => void;
};

const CharacterSheetDrawer: React.FC<CharacterSheetDrawerProps> = ({ sheetId, onClose }) => {
  const [sheet, setSheet] = useState<CharacterSheet | null>(null);

  useEffect(() => {
    const ref = doc(db, 'characterSheets', sheetId);
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        if (!snapshot.exists()) {
          setSheet(null);
          return;
        }
        const data = snapshot.data() as Record<string, any>;
        const sheetData = data.sheet as CharacterSheet | undefined;
        setSheet(sheetData ?? null);
      },
      (error) => {
        console.error('CharacterSheetDrawer: failed to subscribe to sheet', error);
        setSheet(null);
      },
    );
    return unsubscribe;
  }, [sheetId]);

  if (!sheet) return null;
  return <PlayerSheetModal sheet={sheet} onClose={onClose} />;
};

export default CharacterSheetDrawer;

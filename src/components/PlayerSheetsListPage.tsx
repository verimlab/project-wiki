import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import type { CharacterSheet } from '../types/sheet';
import './PlayerSheetsListPage.css';
import PlayerSheetModal from './PlayerSheetModal';

const T = {
  title: '\u041B\u0438\u0441\u0442\u044B \u0438\u0433\u0440\u043E\u043A\u043E\u0432',
  back: '\u041D\u0430\u0437\u0430\u0434 \u0432 GM Hub',
  loading: '\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043B\u0438\u0441\u0442\u043E\u0432...',
  empty: '\u041F\u043E\u043A\u0430 \u043D\u0435\u0442 \u043B\u0438\u0441\u0442\u043E\u0432 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0435\u0439.',
  defaultName: '\u0411\u0435\u0437\u044B\u043C\u044F\u043D\u043D\u044B\u0439',
  error: '\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043B\u0438\u0441\u0442\u044B \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0435\u0439.',
  raceUnknown: '\u0420\u0430\u0441\u0430 \u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u0430',
  authorUnknown: '\u0410\u0432\u0442\u043E\u0440 \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u0435\u043D',
  updated: '\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043E: ',
  open: '\u041E\u0442\u043A\u0440\u044B\u0442\u044C',
  openTitle: '\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043B\u0438\u0441\u0442 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430',
};

interface PlayerSheet {
  id: string;
  name: string;
  race?: string;
  charLevel?: number;
  ownerEmail?: string;
  displayName?: string;
  updatedAt: Date | null;
  sheet: CharacterSheet;
}

const PlayerSheetsListPage: React.FC = () => {
  const [sheets, setSheets] = useState<PlayerSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<PlayerSheet | null>(null);

  useEffect(() => {
    const fetchSheets = async () => {
      try {
        setLoading(true);
        const sheetsCollection = collection(db, 'characterSheets');
        const q = query(sheetsCollection, orderBy('updatedAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const sheetsData = querySnapshot.docs.map(doc => {
          const data = doc.data() as { sheet: CharacterSheet, ownerEmail?: string, displayName?: string, updatedAt?: { seconds: number } };
          return {
            id: doc.id,
            name: data.sheet?.name || T.defaultName,
            race: data.sheet?.race,
            charLevel: data.sheet?.charLevel,
            ownerEmail: data.ownerEmail,
            displayName: data.displayName,
            updatedAt: data.updatedAt ? new Date(data.updatedAt.seconds * 1000) : null,
            sheet: data.sheet,
          };
        });
        setSheets(sheetsData);
      } catch (err) {
        console.error('Error fetching player sheets:', err);
        setError(T.error);
      } finally {
        setLoading(false);
      }
    };

    fetchSheets();
  }, []);

  return (
    <div className="player-sheets-root">
      <header className="player-sheets-header">
        <div className="player-sheets-title-container">
          <h1>{T.title}</h1>
        </div>
        <Link className="player-sheets-back" to="/gm-hub">
          <i className="fa-solid fa-arrow-left-long" aria-hidden />
          <span>{T.back}</span>
        </Link>
      </header>

      <main className="player-sheets-main">
        {loading && <p>{T.loading}</p>}
        {error && <p className="gm-hub-error">{error}</p>}
        {!loading && !error && (
          <div className="player-sheets-grid">
            {sheets.length === 0 ? (
              <p>{T.empty}</p>
            ) : (
              sheets.map(sheet => (
                <div key={sheet.id} className="player-sheet-card" onClick={() => setSelectedSheet(sheet)}>
                  <div className="player-sheet-card__header">
                    <span className="player-sheet-card__name">{sheet.name}</span>
                    {sheet.charLevel && <span className="player-sheet-card__level">{'\u0423\u0440. '}{sheet.charLevel}</span>}
                  </div>
                  <div className="player-sheet-card__body">
                    <p>{sheet.race || T.raceUnknown}</p>
                    <p className="player-sheet-card__owner">
                      <i className="fa-solid fa-user-pen" /> {sheet.displayName || sheet.ownerEmail || T.authorUnknown}
                    </p>
                  </div>
                  <div className="player-sheet-card__footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <span className="player-sheet-card__updated">
                      {sheet.updatedAt ? `${T.updated}${sheet.updatedAt.toLocaleDateString()}` : ''}
                    </span>
                    <Link
                      to={`/character-sheet?uid=${sheet.id}`}
                      className="btn btn-secondary"
                      onClick={(e) => e.stopPropagation()}
                      title={T.openTitle}
                    >
                      <i className="fa-solid fa-pen-to-square" /> {T.open}
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
      {selectedSheet && (
        <PlayerSheetModal sheet={selectedSheet.sheet} onClose={() => setSelectedSheet(null)} />
      )}
    </div>
  );
};

export default PlayerSheetsListPage;

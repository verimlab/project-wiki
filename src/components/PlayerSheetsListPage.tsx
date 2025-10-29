import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import type { CharacterSheet } from '../types/sheet';
import './PlayerSheetsListPage.css';
import PlayerSheetModal from './PlayerSheetModal';

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
  const [isWarningModalOpen, setWarningModalOpen] = useState(false);

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
            name: data.sheet?.name || 'Безымянный',
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
        console.error("Error fetching player sheets:", err);
        setError('Не удалось загрузить листы персонажей.');
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
          <h1>Листы игроков</h1>
          <div
            className="page-warning-indicator"
            onClick={() => setWarningModalOpen(true)}
            title="Есть известные проблемы на этой странице"
          >
            <i className="fa-solid fa-triangle-exclamation" />
          </div>
          <p style={{ gridColumn: '1 / -1' }}>Список всех сохраненных листов персонажей</p>
        </div>
        <Link className="player-sheets-back" to="/gm-hub">
          <i className="fa-solid fa-arrow-left-long" aria-hidden />
          <span>Назад в GM Hub</span>
        </Link>
      </header>

      <main className="player-sheets-main">
        {loading && <p>Загрузка листов...</p>}
        {error && <p className="gm-hub-error">{error}</p>}
        {!loading && !error && (
          <div className="player-sheets-grid">
            {sheets.length === 0 ? (
              <p>Сохраненные листы персонажей не найдены.</p>
            ) : (
              sheets.map(sheet => (
                <div key={sheet.id} className="player-sheet-card" onClick={() => setSelectedSheet(sheet)}>
                  <div className="player-sheet-card__header">
                    <span className="player-sheet-card__name">{sheet.name}</span>
                    {sheet.charLevel && <span className="player-sheet-card__level">Ур. {sheet.charLevel}</span>}
                  </div>
                  <div className="player-sheet-card__body">
                    <p>{sheet.race || 'Раса не указана'}</p>
                    <p className="player-sheet-card__owner">
                      <i className="fa-solid fa-user-pen" /> {sheet.displayName || sheet.ownerEmail || 'Неизвестный игрок'}
                    </p>
                  </div>
                  <div className="player-sheet-card__footer">
                    <span className="player-sheet-card__updated">
                      {sheet.updatedAt ? `Обновлено: ${sheet.updatedAt.toLocaleDateString()}` : ''}
                    </span>
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
      {isWarningModalOpen && (
        <div className="modal-overlay" onClick={() => setWarningModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>ИЗВЕСТНАЯ ПРОБЛЕМА</h3>
              <button
                className="modal-close-button"
                onClick={() => setWarningModalOpen(false)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p>
                <b>Блок характеристик</b> у персонажей отображается некорректно. Над решением ведется работа.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerSheetsListPage;
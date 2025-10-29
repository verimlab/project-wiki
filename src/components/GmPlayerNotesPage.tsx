import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useRole } from '../hooks/useRole';

type PlayerNote = {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
  color?: string;
  ownerUid?: string;
  ownerEmail?: string | null;
  ownerDisplayName?: string | null;
};

const GmPlayerNotesPage: React.FC = () => {
  const { role } = useRole();
  const [notes, setNotes] = useState<PlayerNote[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<PlayerNote | null>(null);

  useEffect(() => {
    if (role !== 'gm') return;
    const q = query(collection(db, 'playerNotes'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: PlayerNote[] = snap.docs.map((d) => {
        const data = d.data() as any;
        const updatedAt = typeof data.updatedAt === 'number' ? data.updatedAt : (data.updatedAt?.toMillis?.() ?? Date.now());
        return {
          id: d.id,
          title: String(data.title ?? ''),
          content: String(data.content ?? ''),
          updatedAt,
          color: data.color,
          ownerUid: data.ownerUid,
          ownerEmail: data.ownerEmail ?? null,
          ownerDisplayName: data.ownerDisplayName ?? null,
        };
      });
      setNotes(list);
    });
    return () => unsub();
  }, [role]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) =>
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      (n.ownerEmail ?? '').toLowerCase().includes(q) ||
      (n.ownerDisplayName ?? '').toLowerCase().includes(q),
    );
  }, [notes, search]);

  if (role !== 'gm') {
    return (
      <div className="gm-hub-root" style={{ padding: 24 }}>
        <header className="gm-hub-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h1>Заметки игроков</h1>
          <Link className="gm-hub-back" to="/" aria-label="Назад">
            <i className="fa-solid fa-arrow-left-long" aria-hidden />
            <span>На главную</span>
          </Link>
        </header>
        <p>Доступ запрещен. Страница доступна только GM.</p>
      </div>
    );
  }

  return (
    <div className="gm-hub-root" style={{ padding: 24 }}>
      <header className="gm-hub-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h1>Заметки игроков</h1>
          <p>Только чтение. Видно только GM.</p>
        </div>
        <Link className="gm-hub-back" to="/gm-hub" aria-label="GM Hub">
          <i className="fa-solid fa-arrow-left-long" aria-hidden />
          <span>В GM Hub</span>
        </Link>
      </header>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <div className="notes-search" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fa-solid fa-magnifying-glass" aria-hidden />
          <input type="search" placeholder="Поиск по заметкам и авторам..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <span style={{ opacity: .7 }}>Всего: {filtered.length}</span>
      </div>

      <div className="player-sheets-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        {filtered.map((n) => (
          <div
            key={n.id}
            className="player-sheet-card"
            style={{ borderLeft: `4px solid ${n.color || '#78a0ff'}`, cursor: 'pointer' }}
            onClick={() => setSelected(n)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setSelected(n); } }}
          >
            <div className="player-sheet-card__header">
              <span className="player-sheet-card__name">{n.title || 'Без названия'}</span>
              <span className="player-sheet-card__level">{new Date(n.updatedAt).toLocaleString('ru-RU')}</span>
            </div>
            <div className="player-sheet-card__body">
              <p style={{ whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'hidden' }}>{n.content}</p>
              <p className="player-sheet-card__owner" title={n.ownerEmail || ''}>
                <i className="fa-solid fa-user-pen" /> {n.ownerDisplayName || n.ownerEmail || n.ownerUid}
              </p>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="sheet-modal-backdrop" onClick={() => setSelected(null)} role="presentation">
          <div className="sheet-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="gm-note-title">
            <header className="sheet-modal-header">
              <div>
                <h2 id="gm-note-title">{selected.title || 'Без названия'}</h2>
                <p>
                  <i className="fa-solid fa-user" aria-hidden /> {selected.ownerDisplayName || selected.ownerEmail || selected.ownerUid}
                  {' · '}
                  <i className="fa-regular fa-clock" aria-hidden /> {new Date(selected.updatedAt).toLocaleString('ru-RU')}
                </p>
              </div>
              <button className="sheet-modal-close" onClick={() => setSelected(null)} aria-label="Закрыть">
                <i className="fa-solid fa-xmark" />
              </button>
            </header>
            <div className="sheet-modal-body">
              <section>
                <h3><i className="fa-regular fa-note-sticky" /> Заметка</h3>
                <div style={{
                  border: '1px solid rgba(126,166,255,0.15)',
                  background: '#0b1534',
                  borderRadius: 12,
                  padding: 12,
                  color: '#e6ebff',
                  maxHeight: '60vh',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.6,
                }}>
                  {selected.content}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GmPlayerNotesPage;

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useRole } from '../hooks/useRole';
import './PlayerSheetsListPage.css';

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

const T = {
  title: '\u0417\u0430\u043C\u0435\u0442\u043A\u0438 \u0438\u0433\u0440\u043E\u043A\u043E\u0432',
  forGm: '\u0422\u043E\u043B\u044C\u043A\u043E \u0434\u043B\u044F GM.',
  back: '\u0412 GM Hub',
  searchPh: '\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043A\u0430\u043C, \u0442\u0435\u043A\u0441\u0442\u0443 \u0438 \u0430\u0432\u0442\u043E\u0440\u0430\u043C...',
  count: '\u041D\u0430\u0439\u0434\u0435\u043D\u043E: ',
  players: '\u0418\u0433\u0440\u043E\u043A\u0438',
  all: '\u0412\u0441\u0435',
  untitled: '\u0411\u0435\u0437 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F',
};

const GmPlayerNotesPage: React.FC = () => {
  const { role } = useRole();
  const [notes, setNotes] = useState<PlayerNote[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<PlayerNote | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | 'all'>('all');

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

  // Owners list grouped from notes
  const owners = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const n of filtered) {
      const id = String(n.ownerUid || n.ownerEmail || 'unknown');
      const name = String(n.ownerDisplayName || n.ownerEmail || n.ownerUid || 'unknown');
      const prev = map.get(id);
      map.set(id, { id, name, count: (prev?.count ?? 0) + 1 });
    }
    const arr = Array.from(map.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ru'));
    return arr;
  }, [filtered]);

  const visibleNotes = useMemo(() => {
    if (selectedOwnerId === 'all') return filtered;
    return filtered.filter(n => String(n.ownerUid || n.ownerEmail || 'unknown') === selectedOwnerId);
  }, [filtered, selectedOwnerId]);

  if (role !== 'gm') {
    return (
      <div className="gm-hub-root" style={{ padding: 24 }}>
        <header className="gm-hub-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h1>{T.title}</h1>
          <Link className="gm-hub-back" to="/" aria-label="Home">
            <i className="fa-solid fa-arrow-left-long" aria-hidden />
            <span>Назад</span>
          </Link>
        </header>
        <p>{T.forGm}</p>
      </div>
    );
  }

  return (
    <div className="gm-hub-root" style={{ padding: 24 }}>
      <header className="gm-hub-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h1>{T.title}</h1>
          <p>{T.forGm}</p>
        </div>
        <Link className="gm-hub-back" to="/gm-hub" aria-label="GM Hub">
          <i className="fa-solid fa-arrow-left-long" aria-hidden />
          <span>{T.back}</span>
        </Link>
      </header>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12 }}>
        <div className="notes-search" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fa-solid fa-magnifying-glass" aria-hidden />
          <input type="search" placeholder={T.searchPh} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <span style={{ opacity: .7 }}>{T.count}{filtered.length}</span>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* Sidebar: players */}
        <aside style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 8 }} aria-label={T.players}>
          <div style={{ fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', opacity: .7, margin: '4px 8px' }}>{T.players}</div>
          <button
            onClick={() => setSelectedOwnerId('all')}
            style={{
              textAlign: 'left',
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid rgba(126,166,255,0.16)',
              background: selectedOwnerId === 'all' ? 'rgba(118,162,255,0.16)' : 'rgba(17,28,54,0.55)',
              color: '#eaf2ff',
              cursor: 'pointer'
            }}
          >
            {T.all} ({filtered.length})
          </button>
          {owners.map(o => (
            <button
              key={o.id}
              onClick={() => setSelectedOwnerId(o.id)}
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid rgba(126,166,255,0.16)',
                background: selectedOwnerId === o.id ? 'rgba(118,162,255,0.16)' : 'rgba(17,28,54,0.55)',
                color: '#eaf2ff',
                cursor: 'pointer'
              }}
            >
              {o.name} ({o.count})
            </button>
          ))}
        </aside>

        {/* Content: notes for selected player */}
        <section style={{ flex: 1 }}>
          <div className="player-sheets-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
            {visibleNotes.map((n) => (
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
                  <span className="player-sheet-card__name">{n.title || T.untitled}</span>
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
        </section>
      </div>

      {selected && (
        <div className="sheet-modal-backdrop" onClick={() => setSelected(null)} role="presentation">
          <div className="sheet-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="gm-note-title">
            <header className="sheet-modal-header">
              <div>
                <h2 id="gm-note-title">{selected.title || T.untitled}</h2>
                <p>
                  <i className="fa-solid fa-user" aria-hidden /> {selected.ownerDisplayName || selected.ownerEmail || selected.ownerUid}
                  {' — '}
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

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import './NotesPage.css';

type Note = {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
  color: string;
};

const colorPalette = ['#4a4e69', '#9a8c98', '#c9ada7', '#f2e9e4', '#22223b', '#7d9bff', '#2bb8ff', '#ff7ab3', '#ffd86b', '#7cffb4'];

const formatDate = (value: number) => new Date(value).toLocaleString('ru-RU');

const templateSnippets = [
  { id: 'session', title: 'Шаблон сессии', body: '## Сессия\n**Сводка:** \n**Цели:** \n\n### Ключевые события\n- \n- \n\n### Важные NPC\n- \n\n### Задачи\n1. \n2. ' },
  { id: 'npc', title: 'Карточка NPC', body: '### NPC\n**Имя:** \n**Роль:** \n**Особенности:** \n- \n- \n\n**Локация:** \n**Отношение:** ' },
  { id: 'brainstorm', title: 'Брейншторм', body: '## Идеи\n- ? \n- ? \n- ? \n\n### Что надо проверить\n1. \n2. \n3. ' },
];

const PlayerNotesCloudPage: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { setNotes([]); return; }
    const q = query(collection(db, 'playerNotes'), where('ownerUid', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const list: Note[] = snap.docs.map((d) => {
        const data = d.data() as any;
        const updatedAt = typeof data.updatedAt === 'number' ? data.updatedAt : (data.updatedAt?.toMillis?.() ?? Date.now());
        const clr = (typeof data.color === 'string' && data.color.trim()) ? String(data.color) : colorPalette[0];
        return { id: d.id, title: String(data.title ?? ''), content: String(data.content ?? ''), updatedAt, color: clr };
      }).sort((a, b) => b.updatedAt - a.updatedAt);
      setNotes(list);
      if (list.length && !selectedId) setSelectedId(list[0].id);
    });
    return () => unsub();
  }, [selectedId]);

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
  }, [notes, search]);

  const selectedNote = notes.find((n) => n.id === selectedId) ?? null;

  const handleCreateNote = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const timestamp = Date.now();
    const payload = { ownerUid: user.uid, ownerEmail: user.email ?? null, ownerDisplayName: user.displayName ?? null, title: '', content: '', updatedAt: timestamp, color: colorPalette[(notes.length + 1) % colorPalette.length] } as const;
    const ref = await addDoc(collection(db, 'playerNotes'), payload);
    setSelectedId(ref.id);
  };

  const handleDeleteNote = async (id: string) => {
    await deleteDoc(doc(collection(db, 'playerNotes'), id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleUpdateNote = async (id: string, patch: Partial<Omit<Note, 'id'>>) => {
    // Optimistic update for responsive typing
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)));
    try {
      await updateDoc(doc(collection(db, 'playerNotes'), id), { ...patch, updatedAt: Date.now() } as any);
    } catch {
      // On failure, snapshot listener will eventually reconcile state
    }
  };

  const handleInsertTemplate = async (body: string) => {
    if (!selectedNote) { await handleCreateNote(); return; }
    await handleUpdateNote(selectedNote.id, { content: `${selectedNote.content}\n\n${body}`.trim() });
  };

  return (
    <div className="notes-page">
      <header className="notes-header">
        <div className="notes-header-left">
          <Link className="notes-back" to="/">
            <i className="fa-solid fa-arrow-left" aria-hidden />
            <span>Вернуться на главную</span>
          </Link>
          <div>
            <p className="notes-kicker">Личные записи и черновики</p>
            <h1>Заметки</h1>
          </div>
        </div>
        <div className="notes-header-actions">
          <div className="notes-search">
            <i className="fa-solid fa-magnifying-glass" aria-hidden />
            <input type="search" placeholder="Поиск по заметкам..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="notes-primary" type="button" onClick={handleCreateNote}>
            <i className="fa-solid fa-plus" aria-hidden />
            <span>Создать</span>
          </button>
        </div>
      </header>

      <div className="notes-workspace">
        <aside className="notes-sidebar" aria-label="Список заметок">
          {filteredNotes.length === 0 ? (
            <div className="notes-empty">
              <p>{auth.currentUser ? 'Заметок пока нет.' : 'Авторизуйтесь, чтобы создавать заметки.'}</p>
              <button type="button" onClick={handleCreateNote}>Создать первую заметку</button>
            </div>
          ) : (
            <ul>
              {filteredNotes.map((note) => (
                <li key={note.id}>
                  <button type="button" className={`notes-list-item${note.id === selectedId ? ' is-active' : ''}`} onClick={() => setSelectedId(note.id)} style={{ borderLeftColor: note.color }}>
                    <div className="notes-list-heading">
                      <strong>{note.title || 'Без названия'}</strong>
                      <time dateTime={new Date(note.updatedAt).toISOString()}>{formatDate(note.updatedAt)}</time>
                    </div>
                    <p>{note.content.slice(0, 120)}</p>
                  </button>
                  <div className="notes-list-actions">
                    <button type="button" aria-label="Удалить заметку" onClick={() => handleDeleteNote(note.id)}>
                      <i className="fa-solid fa-trash" aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="notes-editor" aria-live="polite">
          {selectedNote ? (
            <>
              <div className="notes-editor-meta" style={{ background: selectedNote.color }}>
                <div>
                  <span>Последнее изменение</span>
                  <strong>{formatDate(selectedNote.updatedAt)}</strong>
                </div>
                <div className="notes-color-picker">
                  {colorPalette.map((color) => (
                    <button key={color} type="button" className={color === selectedNote.color ? 'is-selected' : undefined} style={{ backgroundColor: color }} aria-label={`Выбрать цвет ${color}`} onClick={() => handleUpdateNote(selectedNote.id, { color })} />
                  ))}
                </div>
              </div>
              <div className="notes-editor-fields">
                <input className="notes-title" type="text" value={selectedNote.title} onChange={(e) => handleUpdateNote(selectedNote.id, { title: e.target.value })} placeholder="Заголовок заметки" />
                <textarea className="notes-content" value={selectedNote.content} onChange={(e) => handleUpdateNote(selectedNote.id, { content: e.target.value })} placeholder="Пишите здесь..." />
              </div>
              <div className="notes-color-picker" style={{ gap: 8, alignItems: 'center' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ opacity: .8 }}>Любой цвет:</span>
                  <input
                    type="color"
                    value={/^#([0-9a-fA-F]{6})$/.test(selectedNote.color) ? selectedNote.color : '#000000'}
                    onChange={(e) => handleUpdateNote(selectedNote.id, { color: e.target.value })}
                    aria-label="Выбрать произвольный цвет"
                    style={{ width: 36, height: 28, border: '1px solid rgba(126,166,255,0.25)', borderRadius: 6, background: 'transparent' }}
                  />
                  <input
                    type="text"
                    value={selectedNote.color}
                    onChange={(e) => handleUpdateNote(selectedNote.id, { color: e.target.value })}
                    placeholder="#RRGGBB или CSS-цвет"
                    style={{
                      background: '#0b1534',
                      color: '#e6ebff',
                      border: '1px solid rgba(126,166,255,0.25)',
                      borderRadius: 6,
                      padding: '6px 8px',
                      minWidth: 140,
                    }}
                  />
                </div>
              </div>
              <div className="notes-templates" aria-label="Шаблоны">
                <p>Быстрые шаблоны:</p>
                <div className="notes-template-grid">
                  {templateSnippets.map((snippet) => (
                    <button type="button" key={snippet.id} onClick={() => handleInsertTemplate(snippet.body)}>
                      <i className="fa-regular fa-note-sticky" aria-hidden />
                      <span>{snippet.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="notes-placeholder">
              <i className="fa-regular fa-note-sticky" aria-hidden />
              <p>Выберите заметку, чтобы редактировать.</p>
              <button type="button" onClick={handleCreateNote}>Создать заметку</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default PlayerNotesCloudPage;

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import './NotesPage.css';

type Note = {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
  color: string;
};

const STORAGE_KEY = 'hw-notes';

const colorPalette = [
  '#4a4e69', // slate-purple
  '#9a8c98', // muted-rose
  '#c9ada7', // dusty-pink
  '#f2e9e4', // off-white
  '#22223b', // dark-blue
];

const generateId = () => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `note-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
};

const createStarterNotes = (): Note[] => [
  {
    id: generateId(),
    title: 'Компас кампании',
    content:
      '## Главная линия\n- Завязка: город Лимния просит помощи\n- Основной конфликт: расколотый артефакт Пеллина\n- Финал: выбор между стабилизацией мира и личной выгодой',
    updatedAt: Date.now() - 1000 * 60 * 60 * 6,
    color: colorPalette[1],
  },
  {
    id: generateId(),
    title: 'Наброски лора',
    content:
      '### Факты\n1. Луна из мрамора, отражает магию\n2. Речная система связывает столицы\n3. Первая Эпоха закончилась Великим Погружением\n\n### Идеи\n- Добавить кочующие города-караваны\n- Использовать «пустые карты» для исследований',
    updatedAt: Date.now() - 1000 * 60 * 60 * 2,
    color: colorPalette[0],
  },
  {
    id: generateId(),
    title: 'Список дел мастера',
    content:
      '- [ ] Завершить карточку NPC для Риэль\n- [ ] Придумать загадку для древнего зала\n- [x] Подготовить визу сцены на рынке\n\n**Награды недели**\n1. Магический компас (редкий)\n2. Титул «Хранитель пристани»',
    updatedAt: Date.now() - 1000 * 60 * 10,
    color: colorPalette[3],
  },
];

const loadNotes = (): Note[] => {
  if (typeof window === 'undefined') {
    return createStarterNotes();
  }

  try {
    const persisted = window.localStorage.getItem(STORAGE_KEY);
    if (!persisted) {
      return createStarterNotes();
    }
    const parsed = JSON.parse(persisted);
    if (!Array.isArray(parsed)) {
      return createStarterNotes();
    }

    return parsed
      .map((note) => ({
        id: typeof note.id === 'string' ? note.id : generateId(),
        title: typeof note.title === 'string' ? note.title : 'Без названия',
        content: typeof note.content === 'string' ? note.content : '',
        updatedAt: typeof note.updatedAt === 'number' ? note.updatedAt : Date.now(),
        color: colorPalette.includes(note.color) ? note.color : colorPalette[0],
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return createStarterNotes();
  }
};

const formatDate = (value: number) => {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(value);
  } catch {
    return new Date(value).toLocaleString();
  }
};

const templateSnippets = [
  {
    id: 'session',
    title: 'Конспект сессии',
    body: '## Конспект сессии\n**Дата:** \n**Игроки:** \n\n### Что произошло\n- \n- \n\n### Важные NPC\n- \n\n### Крючки\n1. \n2. ',
  },
  {
    id: 'npc',
    title: 'Шаблон NPC',
    body: '### NPC\n**Имя:** \n**Роль:** \n**Черты:** \n- \n- \n\n**Секрет:** \n**Голос:** ',
  },
  {
    id: 'brainstorm',
    title: 'Брейншторм',
    body: '## Идеи\n- 🔥 \n- 🌊 \n- 🌌 \n\n### Следующие шаги\n1. \n2. \n3. ',
  },
];

const NotesPage: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>(() => loadNotes());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (selectedId || notes.length === 0) {
      return;
    }
    setSelectedId(notes[0].id);
  }, [notes, selectedId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return notes;
    }
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query),
    );
  }, [notes, search]);

  const selectedNote = notes.find((note) => note.id === selectedId) ?? null;

  const handleCreateNote = () => {
    const timestamp = Date.now();
    const newNote: Note = {
      id: generateId(),
      title: 'Новая заметка',
      content: 'Начните писать... ✍️',
      updatedAt: timestamp,
      color: colorPalette[(notes.length + 1) % colorPalette.length],
    };
    setNotes((prev) => [newNote, ...prev]);
    setSelectedId(newNote.id);
  };

  const handleDeleteNote = (id: string) => {
    setNotes((prev) => prev.filter((note) => note.id !== id));
    setSelectedId((current) => {
      if (current !== id) {
        return current;
      }
      const remaining = notes.filter((note) => note.id !== id);
      return remaining[0]?.id ?? null;
    });
  };

  const handleUpdateNote = (id: string, patch: Partial<Omit<Note, 'id'>>) => {
    setNotes((prev) => {
      const updated = prev.map((note) =>
        note.id === id
          ? {
              ...note,
              ...patch,
              updatedAt: Date.now(),
            }
          : note,
      );
      return [...updated].sort((a, b) => b.updatedAt - a.updatedAt);
    });
  };

  const handleInsertTemplate = (body: string) => {
    if (!selectedNote) {
      const timestamp = Date.now();
      const newNote: Note = {
        id: generateId(),
        title: 'Быстрая заметка',
        content: body,
        updatedAt: timestamp,
        color: colorPalette[0],
      };
      setNotes((prev) => [newNote, ...prev]);
      setSelectedId(newNote.id);
      return;
    }
    handleUpdateNote(selectedNote.id, {
      content: `${selectedNote.content}\n\n${body}`.trim(),
    });
  };

  return (
    <div className="notes-page">
      <header className="notes-header">
        <div className="notes-header-left">
          <Link className="notes-back" to="/">
            <i className="fa-solid fa-arrow-left" aria-hidden />
            <span>Назад на главную</span>
          </Link>
          <div>
            <p className="notes-kicker">Ваш личный блокнот</p>
            <h1>Заметки</h1>
          </div>
        </div>
        <div className="notes-header-actions">
          <div className="notes-search">
            <i className="fa-solid fa-magnifying-glass" aria-hidden />
            <input
              type="search"
              placeholder="Поиск по заметкам..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button className="notes-primary" type="button" onClick={handleCreateNote}>
            <i className="fa-solid fa-plus" aria-hidden />
            <span>Новая</span>
          </button>
        </div>
      </header>

      <div className="notes-workspace">
        <aside className="notes-sidebar" aria-label="Список заметок">
          {filteredNotes.length === 0 ? (
            <div className="notes-empty">
              <p>Ничего не найдено.</p>
              <button type="button" onClick={handleCreateNote}>
                Создать первую запись
              </button>
            </div>
          ) : (
            <ul>
              {filteredNotes.map((note) => (
                <li key={note.id}>
                  <button
                    type="button"
                    className={`notes-list-item${note.id === selectedId ? ' is-active' : ''}`}
                    onClick={() => setSelectedId(note.id)}
                    style={{ borderLeftColor: note.color }}
                  >
                    <div className="notes-list-heading">
                      <strong>{note.title || 'Без названия'}</strong>
                      <time dateTime={new Date(note.updatedAt).toISOString()}>
                        {formatDate(note.updatedAt)}
                      </time>
                    </div>
                    <p>{note.content.slice(0, 120)}</p>
                  </button>
                  <div className="notes-list-actions">
                    <button
                      type="button"
                      aria-label="Удалить заметку"
                      onClick={() => handleDeleteNote(note.id)}
                    >
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
                  <span>Последнее обновление</span>
                  <strong>{formatDate(selectedNote.updatedAt)}</strong>
                </div>
                <div className="notes-color-picker">
                  {colorPalette.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={color === selectedNote.color ? 'is-selected' : undefined}
                      style={{ backgroundColor: color }}
                      aria-label={`Присвоить цвет ${color}`}
                      onClick={() => handleUpdateNote(selectedNote.id, { color })}
                    />
                  ))}
                </div>
              </div>
              <div className="notes-editor-fields">
                <input
                  className="notes-title"
                  type="text"
                  value={selectedNote.title}
                  onChange={(event) => handleUpdateNote(selectedNote.id, { title: event.target.value })}
                  placeholder="Название заметки"
                />
                <textarea
                  className="notes-content"
                  value={selectedNote.content}
                  onChange={(event) => handleUpdateNote(selectedNote.id, { content: event.target.value })}
                  placeholder="Записывайте мысли, планы и лор..."
                />
              </div>
              <div className="notes-templates" aria-label="Шаблоны">
                <p>Быстрые вставки:</p>
                <div className="notes-template-grid">
                  {templateSnippets.map((snippet) => (
                    <button
                      type="button"
                      key={snippet.id}
                      onClick={() => handleInsertTemplate(snippet.body)}
                    >
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
              <p>Создайте заметку, чтобы начать.</p>
              <button type="button" onClick={handleCreateNote}>
                Добавить заметку
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default NotesPage;

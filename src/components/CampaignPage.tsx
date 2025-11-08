import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp, FieldValue, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useRole } from '../hooks/useRole';
import './CampaignPage.css';

const pad2 = (n: number) => String(n).padStart(2, '0');
const formatDateTime = (ms: number) => new Date(ms).toLocaleString('ru-RU', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

// Type for data as it exists in Firestore (before client-side conversion)
type EpisodeDocData = {
  title: string;
  content: string;
  order: number;
  createdAt: Timestamp | FieldValue; // Can be Timestamp when read, FieldValue when written
  updatedAt: Timestamp | FieldValue; // Can be Timestamp when read, FieldValue when written
};

// Type for data as used in the React component state
type Episode = {
  id: string;
  title: string;
  content: string;
  order: number;
  createdAt: number; // Milliseconds
  updatedAt: number; // Milliseconds
};

// Type for campaign data from Firestore
type CampaignData = {
  title: string;
  description: string;
  nextSessionDate: Timestamp;
};

const DEFAULT_CAMPAIGN_DATA = {
  title: 'Приключение по вселенной',
  description: 'Невероятное приключение в мире фэнтези, полное опасностей и загадок.',
  nextSessionDate: Timestamp.fromDate(new Date('2025-10-26T11:00:00+02:00')), // Default date if none in DB
};

const CAMPAIGN_ID = 'mainCampaign'; // Using a fixed ID for the main campaign document

const CampaignPage: React.FC = () => {
  const { role } = useRole();

  // State for campaign data
  const [campaignData, setCampaignData] = useState<CampaignData | null>(null);
  const [loadingCampaign, setLoadingCampaign] = useState(true);

  // State for date editing
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [dateFormValue, setDateFormValue] = useState({ date: '', time: '' });
  const [isSavingDate, setIsSavingDate] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);

  // State for info editing
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({ title: '', description: '' });
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);


  // Static placeholders
  const schedule = 'Каждое воскресенье в 11:00 (По Киеву, UTC+2)';
  const place = 'Discord сервер "Venom", голосовой канал.';
  const master = 'Даня';

  const [now, setNow] = useState<Date>(() => new Date());

  // Campaign data subscription effect
  useEffect(() => {
    const campaignRef = doc(db, 'campaigns', CAMPAIGN_ID);
    const unsubscribe = onSnapshot(campaignRef, (docSnap) => {
      if (docSnap.exists()) {
        setCampaignData(docSnap.data() as CampaignData);
      } else {
        setCampaignData(DEFAULT_CAMPAIGN_DATA);
      }
      setLoadingCampaign(false);
    });
    return () => unsubscribe();
  }, []);

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(true);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [isEpisodeModalOpen, setIsEpisodeModalOpen] = useState(false);
  const [isEditingEpisode, setIsEditingEpisode] = useState(false);
  const [episodeForm, setEpisodeForm] = useState<{ id?: string; title: string; content: string; order: number }>({
    title: '',
    content: '',
    order: 0,
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Episodes subscription effect
  useEffect(() => {
    const q = query(collection(db, 'campaignEpisodes'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => { // <--- Here
      const fetchedEpisodes: Episode[] = snapshot.docs.map((doc) => {
        const data = doc.data() as EpisodeDocData; // Assert the data type from Firestore
        return {
          id: doc.id,
          title: data.title,
          content: data.content,
          order: data.order,
          createdAt: (data.createdAt as Timestamp)?.toMillis ? (data.createdAt as Timestamp).toMillis() : Date.now(),
          updatedAt: (data.updatedAt as Timestamp)?.toMillis ? (data.updatedAt as Timestamp).toMillis() : Date.now(),
        };
      });
      setEpisodes(fetchedEpisodes);
      setLoadingEpisodes(false);
    }, (error) => {
      console.error("Error fetching episodes:", error);
      setLoadingEpisodes(false);
      // Optionally set an error state for the user
    });
    return () => unsubscribe();
  }, []);

  // Timer effect
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const targetDate = useMemo(() => campaignData?.nextSessionDate?.toDate() ?? null, [campaignData]);
  const diffMs = targetDate ? targetDate.getTime() - now.getTime() : -1;
  const active = diffMs <= 0;

  const { days, hours, minutes, seconds } = useMemo(() => {
    const d = Math.max(0, diffMs);
    const totalSeconds = Math.floor(d / 1000);
    const dd = Math.floor(totalSeconds / (24 * 3600));
    const hh = Math.floor((totalSeconds % (24 * 3600)) / 3600);
    const mm = Math.floor((totalSeconds % 3600) / 60);
    const ss = totalSeconds % 60;
    return { days: dd, hours: hh, minutes: mm, seconds: ss };
  }, [diffMs]);

  const handleEditDate = () => {
    if (targetDate) {
      // Format for datetime-local input: YYYY-MM-DDTHH:mm
      const year = targetDate.getFullYear();
      const month = pad2(targetDate.getMonth() + 1);
      const day = pad2(targetDate.getDate());
      const hours = pad2(targetDate.getHours());
      const minutes = pad2(targetDate.getMinutes());
      setDateFormValue({ date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` });
    }
    setIsEditingDate(true);
    setDateError(null);
  };

  const handleSaveDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateFormValue.date || !dateFormValue.time) {
      setDateError('Пожалуйста, укажите и дату, и время.');
      return;
    }
    setDateError(null);
    setIsSavingDate(true);
    try {
      const newDate = new Date(`${dateFormValue.date}T${dateFormValue.time}`);
      const campaignRef = doc(db, 'campaigns', CAMPAIGN_ID);
      await setDoc(campaignRef, {
        // Ensure we don't overwrite existing title/description
        title: campaignData?.title ?? DEFAULT_CAMPAIGN_DATA.title,
        description: campaignData?.description ?? DEFAULT_CAMPAIGN_DATA.description,
        nextSessionDate: Timestamp.fromDate(newDate),
      }, { merge: true });
      setIsEditingDate(false);
    } catch (error) {
      setDateError('Не удалось сохранить дату. Попробуйте снова.');
      console.error("Error updating date:", error);
    } finally {
      setIsSavingDate(false);
    }
  };

  const handleDateFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateFormValue(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleEditInfo = () => {
    if (campaignData) {
      setInfoForm({
        title: campaignData.title,
        description: campaignData.description,
      });
    }
    setIsEditingInfo(true);
    setInfoError(null);
  };

  const handleInfoFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInfoForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!infoForm.title.trim()) {
      setInfoError('Название не может быть пустым.');
      return;
    }
    setInfoError(null);
    setIsSavingInfo(true);
    try {
      const campaignRef = doc(db, 'campaigns', CAMPAIGN_ID);
      await setDoc(campaignRef, {
        title: infoForm.title,
        description: infoForm.description,
      }, { merge: true });
      setIsEditingInfo(false);
    } catch (error) {
      setInfoError('Не удалось сохранить информацию. Попробуйте снова.');
      console.error("Error updating campaign info:", error);
    } finally {
      setIsSavingInfo(false);
    }
  };

  const openEpisodeModal = (episode: Episode, editing: boolean = false) => {
    setSelectedEpisode(episode);
    setIsEditingEpisode(editing);
    if (editing) {
      setEpisodeForm({ id: episode.id, title: episode.title, content: episode.content, order: episode.order });
    } else {
      setEpisodeForm({ title: '', content: '', order: 0 }); // Reset form for viewing
    }
    setFormError(null);
    setIsEpisodeModalOpen(true);
  };

  const closeEpisodeModal = () => {
    setIsEpisodeModalOpen(false);
    setSelectedEpisode(null);
    setIsEditingEpisode(false);
    setEpisodeForm({ title: '', content: '', order: 0 });
    setFormError(null);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEpisodeForm((prev) => ({ ...prev, [name]: name === 'order' ? Number(value) : value }));
  };

  const saveEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!episodeForm.title.trim() || !episodeForm.content.trim()) {
      setFormError('Заголовок и содержание эпизода не могут быть пустыми.');
      return;
    }

    setFormError(null);
    try {
      if (episodeForm.id) {
        // Update existing episode
        const episodeRef = doc(db, 'campaignEpisodes', episodeForm.id);
        await updateDoc(episodeRef, {
          title: episodeForm.title,
          content: episodeForm.content,
          order: episodeForm.order,
          updatedAt: serverTimestamp(), // <--- Here
        } as Partial<EpisodeDocData>); // Cast for update
      } else {
        // Add new episode
        await addDoc(collection(db, 'campaignEpisodes'), {
          title: episodeForm.title,
          content: episodeForm.content,
          order: episodeForm.order,
          createdAt: serverTimestamp(), // <--- Here
          updatedAt: serverTimestamp(), // <--- Here
        } as EpisodeDocData); // Cast for add
      }
      closeEpisodeModal();
    } catch (error) {
      console.error('Error saving episode:', error);
      setFormError('Не удалось сохранить эпизод. Попробуйте снова.');
    }
  };

  const deleteEpisode = async (id: string) => {
    if (window.confirm('Вы уверены, что хотите удалить этот эпизод?')) {
      try {
        const episodeRef = doc(db, 'campaignEpisodes', id);
        await deleteDoc(episodeRef);
        closeEpisodeModal();
      } catch (error: any) {
        console.error('Error deleting episode:', error);
        setFormError('Не удалось удалить эпизод. Попробуйте снова.');
      }
    }
  };

  const addNewEpisode = () => {
    setEpisodeForm({ title: '', content: '', order: episodes.length > 0 ? Math.max(...episodes.map(e => e.order)) + 1 : 1 });
    setSelectedEpisode(null);
    setIsEditingEpisode(true);
    setFormError(null);
    setIsEpisodeModalOpen(true);
  };

  return (
    <div className="camp-root">
      <div className="camp-toolbar">
        <Link to="/" className="camp-back" aria-label="На главную">
          <i className="fa-solid fa-arrow-left" />
          <span>На главную</span>
        </Link>
      </div>
      <header className="camp-header">
        {isEditingInfo ? (
          <form onSubmit={handleSaveInfo} className="camp-info-form">
            <div className="camp-form-group">
              <label htmlFor="campaign-title">Название кампании</label>
              <input
                id="campaign-title"
                name="title"
                type="text"
                value={infoForm.title}
                onChange={handleInfoFormChange}
              />
            </div>
            <div className="camp-form-group">
              <label htmlFor="campaign-description">Описание</label>
              <textarea
                id="campaign-description"
                name="description"
                rows={3}
                value={infoForm.description}
                onChange={handleInfoFormChange}
              />
            </div>
            {infoError && <p className="camp-error">{infoError}</p>}
            <div className="camp-info-form-actions">
              <button type="submit" className="camp-btn camp-btn-primary" disabled={isSavingInfo}>{isSavingInfo ? 'Сохранение...' : 'Сохранить'}</button>
              <button type="button" className="camp-btn camp-btn-secondary" onClick={() => setIsEditingInfo(false)} disabled={isSavingInfo}>Отмена</button>
            </div>
          </form>
        ) : (
          <div className="camp-header-content">
            <div className="camp-header-text">
              <h1><i className="fa-solid fa-flag" /> {campaignData?.title ?? 'Загрузка...'}</h1>
              <p className="camp-sub">{campaignData?.description ?? 'Описание кампании.'}</p>
            </div>
            {role === 'gm' && (
              <button type="button" className="camp-btn camp-edit-info-btn" onClick={handleEditInfo} aria-label="Редактировать информацию">
                <i className="fa-solid fa-pencil" />
              </button>
            )}
          </div>
        )}
      </header>

      <section className="camp-info">
        <div className="camp-row"><i className="fa-regular fa-calendar" /> <span>Дата и время партий:</span> <strong>{schedule}</strong></div>
        <div className="camp-row"><i className="fa-solid fa-location-dot" /> <span>Место сбора:</span> <strong>{place}</strong></div>
        <div className="camp-row"><i className="fa-solid fa-hat-wizard" /> <span>Мастер:</span> <strong>{master}</strong></div>
      </section>

      <section className="camp-timer">
        {loadingCampaign ? (
          <p>Загрузка таймера...</p>
        ) : !targetDate ? (
          <div className="camp-note">Дата следующей сессии не установлена.</div>
        ) : (
          <>
            {active ? (
              <div className="camp-active">Партия активна</div>
            ) : (
              <>
                <div className="camp-timer-title">До следующей сессии</div>
                <div className="camp-countdown" aria-live="polite">
                  {days > 0 && (
                    <div className="camp-box">
                      <div className="camp-num">{days}</div>
                      <div className="camp-label">дн</div>
                    </div>
                  )}
                  <div className="camp-box">
                    <div className="camp-num">{pad2(hours)}</div>
                    <div className="camp-label">ч</div>
                  </div>
                  <div className="camp-sep">:</div>
                  <div className="camp-box">
                    <div className="camp-num">{pad2(minutes)}</div>
                    <div className="camp-label">м</div>
                  </div>
                  <div className="camp-sep">:</div>
                  <div className="camp-box">
                    <div className="camp-num">{pad2(seconds)}</div>
                    <div className="camp-label">с</div>
                  </div>
                </div>
              </>
            )}
            <div className="camp-note">
              Следующая встреча: {targetDate.toLocaleString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short',
              })}
            </div>
          </>
        )}
        {role === 'gm' && (
          isEditingDate ? (
            <>
              <form className="camp-date-form" onSubmit={handleSaveDate}>
                <div className="camp-date-inputs">
                  <input type="date" name="date" value={dateFormValue.date} onChange={handleDateFormChange} required />
                  <input type="time" name="time" value={dateFormValue.time} onChange={handleDateFormChange} required />
                </div>
                <div className="camp-date-actions">
                  <button type="submit" className="camp-btn camp-btn-primary" disabled={isSavingDate}>
                    {isSavingDate ? 'Сохранение...' : 'Сохранить'}
                  </button>
                  <button type="button" className="camp-btn camp-btn-secondary" onClick={() => setIsEditingDate(false)} disabled={isSavingDate}>
                    Отмена
                  </button>
                </div>
              </form>
              {dateError && <p className="camp-error" style={{ marginTop: '10px' }}>{dateError}</p>}
            </>
          ) : (
            <button type="button" className="camp-btn camp-edit-date-btn" onClick={handleEditDate}>Изменить дату</button>
          )
        )}
      </section>

      <section className="camp-episodes">
        <header className="camp-episodes-header">
          <h2>Эпизоды</h2>
          {role === 'gm' && (
            <button type="button" className="camp-btn" onClick={addNewEpisode}>
              <i className="fa-solid fa-plus" /> Добавить эпизод
            </button>
          )}
        </header>
        {loadingEpisodes ? (
          <p>Загрузка эпизодов...</p>
        ) : episodes.length === 0 ? (
          <p>Эпизоды пока не добавлены.</p>
        ) : (
          <ul className="camp-episode-list">
            {episodes.map((episode) => (
              <li key={episode.id} className="camp-episode-item">
                <button type="button" className="camp-episode-button" onClick={() => openEpisodeModal(episode)}>
                  <div className="camp-episode-main">
                    <span className="camp-episode-badge">#{episode.order}</span>
                    <span className="camp-episode-title">{episode.title}</span>
                  </div>
                  <div className="camp-episode-meta">Обновлено: {formatDateTime(episode.updatedAt)}</div>
                </button>
                {role === 'gm' && (
                  <button type="button" className="camp-episode-edit-btn" aria-label="Редактировать эпизод" onClick={() => openEpisodeModal(episode, true)}>
                    <i className="fa-solid fa-pencil" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {isEpisodeModalOpen && selectedEpisode && (
        <div className="camp-modal-backdrop" role="presentation" onClick={closeEpisodeModal}>
          <div className="camp-modal camp-modal--glass" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <header className="camp-modal-header">
              <div>
                <h2><i className="fa-solid fa-scroll" /> {isEditingEpisode ? 'Редактировать эпизод' : selectedEpisode.title}</h2>
                {!isEditingEpisode && (
                  <div className="camp-modal-subtitle">Эпизод #{selectedEpisode.order} • Обновлено {formatDateTime(selectedEpisode.updatedAt)}</div>
                )}
              </div>
              <button type="button" className="camp-modal-close" onClick={closeEpisodeModal} aria-label="Закрыть">
                <i className="fa-solid fa-xmark" />
              </button>
            </header>
            <div className="camp-modal-body">
              {formError && <div className="camp-error">{formError}</div>}
              {isEditingEpisode ? (
                <form onSubmit={saveEpisode}>
                  <div className="camp-form-group">
                    <label htmlFor="episode-title">Заголовок</label>
                    <input
                      type="text"
                      id="episode-title"
                      name="title"
                      value={episodeForm.title}
                      onChange={handleFormChange}
                      required
                    />
                  </div>
                  <div className="camp-form-group">
                    <label htmlFor="episode-order">Порядок</label>
                    <input
                      type="number"
                      id="episode-order"
                      name="order"
                      value={episodeForm.order}
                      onChange={handleFormChange}
                      required
                    />
                  </div>
                  <div className="camp-form-group">
                    <label htmlFor="episode-content">Содержание</label>
                    <textarea
                      id="episode-content"
                      name="content"
                      value={episodeForm.content}
                      onChange={handleFormChange}
                      rows={10}
                      required
                    />
                  </div>
                  <div className="camp-modal-actions">
                    <button type="submit" className="camp-btn camp-btn-primary">Сохранить</button>
                    <button type="button" className="camp-btn camp-btn-secondary" onClick={closeEpisodeModal}>Отмена</button>
                    {episodeForm.id && (
                      <button type="button" className="camp-btn camp-btn-danger" onClick={() => deleteEpisode(episodeForm.id!)}>Удалить</button>
                    )}
                  </div>
                </form>
              ) : (
                <>
                  <p><strong>Порядок:</strong> {selectedEpisode.order}</p>
                  <div className="camp-episode-content" dangerouslySetInnerHTML={{ __html: selectedEpisode.content }} />
                  {role === 'gm' && (
                    <div className="camp-modal-actions">
                      <button type="button" className="camp-btn camp-btn-primary" onClick={() => openEpisodeModal(selectedEpisode, true)}>Редактировать</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {isEpisodeModalOpen && !selectedEpisode && isEditingEpisode && ( // Modal for adding new episode
        <div className="camp-modal-backdrop" role="presentation" onClick={closeEpisodeModal}>
          <div className="camp-modal camp-modal--glass" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <header className="camp-modal-header">
              <h2><i className="fa-solid fa-scroll" /> Добавить новый эпизод</h2>
              <button type="button" className="camp-modal-close" onClick={closeEpisodeModal} aria-label="Закрыть">
                <i className="fa-solid fa-xmark" />
              </button>
            </header>
            <div className="camp-modal-body">
              {formError && <div className="camp-error">{formError}</div>}
              <form onSubmit={saveEpisode}>
                <div className="camp-form-group">
                  <label htmlFor="episode-title">Заголовок</label>
                  <input
                    type="text"
                    id="episode-title"
                    name="title"
                    value={episodeForm.title}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                <div className="camp-form-group">
                  <label htmlFor="episode-order">Порядок</label>
                  <input
                    type="number"
                    id="episode-order"
                    name="order"
                    value={episodeForm.order}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                <div className="camp-form-group">
                  <label htmlFor="episode-content">Содержание</label>
                  <textarea
                    id="episode-content"
                    name="content"
                    value={episodeForm.content}
                    onChange={handleFormChange}
                    rows={10}
                    required
                  />
                </div>
                <div className="camp-modal-actions">
                  <button type="submit" className="camp-btn camp-btn-primary">Сохранить</button>
                  <button type="button" className="camp-btn camp-btn-secondary" onClick={closeEpisodeModal}>Отмена</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignPage;

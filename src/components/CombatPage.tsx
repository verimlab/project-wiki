import React, { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
// vvv ДОБАВЛЕНЫ 'writeBatch', 'where' vvv
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc, deleteDoc, arrayUnion, arrayRemove, writeBatch, where } from 'firebase/firestore'; 
import type { Unsubscribe } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { getIdTokenResult, onAuthStateChanged } from 'firebase/auth';
import './PlayerSheetsListPage.css';
import './CombatPage.css';
import type { CharacterSheet } from '../types/sheet';

type Role = 'gm' | 'player' | null;

type Participant = {
  id: string;
  name: string;
  initiative: number;
  createdAt?: unknown;
  type?: 'player' | 'npc' | 'ally' | 'enemy';
  dexMod?: number | '';
  ownerUid?: string;
  showHp?: boolean;
  hp?: number | '';
  hpMax?: number | '';
  ac?: number | '';
  mp?: number | '';
  mpMax?: number | '';
  showAc?: boolean;
  showMp?: boolean;
  conditions: string[]; 
  effects: string[]; 
};

type Invite = {
  id: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt?: unknown;
  characterId?: string;
  characterName?: string;
  targetUid?: string;
  participantId?: string;
};

// vvv ДОБАВЛЕН ТИП ДЛЯ ШАБЛОНА vvv
type CombatTemplate = {
  id: string;
  name: string;
};

const CombatPage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams();
  const combatId = params.combatId as string | undefined;

  const [userUid, setUserUid] = useState<string | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [characters, setCharacters] = useState<Array<{ id: string; name: string; ownerEmail?: string; displayName?: string; ownerUid?: string }>>([]);
  const [selectedCharId, setSelectedCharId] = useState<string>('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = participants.find((p) => p.id === selectedId) || null;

  type Meta = { round: number; activeIndex: number; status: 'idle' | 'active' | 'ended' };
  const [meta, setMeta] = useState<Meta>({ round: 1, activeIndex: 0, status: 'idle' });

  const [newCondition, setNewCondition] = useState('');
  const [newEffect, setNewEffect] = useState('');

  // vvv ДОБАВЛЕНЫ СОСТОЯНИЯ ДЛЯ ШАБЛОНОВ vvv
  const [templates, setTemplates] = useState<CombatTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templateLoading, setTemplateLoading] = useState(false);
  // ^^^ КОНЕЦ НОВЫХ СОСТОЯНИЙ ^^^

  // Resolve auth and role (copying approach from HomePage)
  useEffect(() => {
    // ... (этот useEffect без изменений)
    const unsub = onAuthStateChanged(auth, async (usr) => {
      setUserUid(usr?.uid ?? null);
      if (!usr) {
        setRole(null);
        setLoading(false);
        return;
      }
      try {
        const token = await getIdTokenResult(usr, true);
        const claimRole = token.claims.role;
        if (claimRole === 'gm' || claimRole === 'player') {
          setRole(claimRole);
          setLoading(false);
          return;
        }
        const userDoc = await getDoc(doc(db, 'users', usr.uid));
        const data = userDoc.exists() ? (userDoc.data() as { role?: unknown }) : {};
        if (data.role === 'gm' || data.role === 'player') {
          setRole(data.role);
        } else {
          setRole('player');
        }
      } catch (e) {
        console.error(e);
        setRole('player');
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // Subscribe to combat data (participants and invites)
  useEffect(() => {
    // ... (этот useEffect без изменений)
    let unsubscribers: Unsubscribe[] = [];
    if (!combatId) return;

    const partsCol = collection(db, 'combats', combatId, 'participants');
    const invCol = collection(db, 'combats', combatId, 'invites');
    const combatDoc = doc(db, 'combats', combatId);

    const unsubA = onSnapshot(partsCol, (snap) => {
      setParticipants(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Participant, 'id'>) }))
          .sort((a, b) => {
            const totalA = (a.initiative || 0) + (Number(a.dexMod) || 0);
            const totalB = (b.initiative || 0) + (Number(b.dexMod) || 0);
            return totalB - totalA;
          }),
      );
    });
    unsubscribers.push(unsubA);

    const unsubB = onSnapshot(invCol, (snap) => {
      setInvites(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Invite, 'id'>) })));
    });
    unsubscribers.push(unsubB);

    const unsubC = onSnapshot(combatDoc, (snap) => {
      const data = snap.data() as Partial<Meta> | undefined;
      setMeta({ round: data?.round ?? 1, activeIndex: data?.activeIndex ?? 0, status: (data?.status as Meta['status']) ?? 'idle' });
    });
    unsubscribers.push(unsubC);

    return () => {
      unsubscribers.forEach((u) => u());
    };
  }, [combatId]);

  // vvv ДОБАВЛЕН useEffect ДЛЯ ЗАГРУЗКИ ШАБЛОНОВ vvv
  useEffect(() => {
    if (!userUid) {
      setTemplates([]);
      return;
    }
    // Загружаем шаблоны, принадлежащие текущему ГМу
    const q = query(
      collection(db, 'combatTemplates'),
      where('ownerUid', '==', userUid),
      orderBy('name', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, name: d.data().name as string }));
      setTemplates(list);
      // Автоматически выбираем первый шаблон в списке, если он есть
      if (list.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(list[0].id);
      }
    });
    return () => unsub();
  }, [userUid]);
  // ^^^ КОНЕЦ НОВОГО useEffect ^^^

  // Auto-create participant when invite accepted
  useEffect(() => {
    // ... (этот useEffect без изменений)
    const run = async () => {
      if (!combatId) return;
      for (const inv of invites) {
        if (inv.status === 'accepted' && !inv.participantId) {
          const chId = inv.characterId;
          let name = inv.characterName || 'Персонаж';
          let hp = 0;
          let hpMax = 0;
          let mp = 0;
          let mpMax = 0;
          let ac = 10;
          let ownerUid = inv.targetUid || undefined;
          try {
            if (chId) {
              const snap = await getDoc(doc(db, 'characterSheets', chId));
              if (snap.exists()) {
                const data = snap.data() as { sheet?: CharacterSheet; ownerUid?: string };
                if (data.sheet?.name) name = data.sheet.name;
                if (typeof data.sheet?.healthCurrent === 'number') hp = data.sheet.healthCurrent;
                if (typeof data.sheet?.healthMax === 'number') hpMax = data.sheet.healthMax;
                if (typeof data.sheet?.manaCurrent === 'number') mp = data.sheet.manaCurrent;
                if (typeof data.sheet?.manaMax === 'number') mpMax = data.sheet.manaMax;
                if (typeof data.sheet?.ac === 'number') ac = data.sheet.ac;
                if (!ownerUid && data.ownerUid) ownerUid = data.ownerUid;
              }
            }
          } catch (e) {
            console.error('Failed to read character for invite', e);
          }

          try {
            const partRef = await addDoc(collection(db, 'combats', combatId, 'participants'), {
              name,
              type: 'player',
              ownerUid: ownerUid || null,
              hp: hp || 0,
              hpMax: hpMax || 0,
              mp: mp || 0,
              mpMax: mpMax || 0,
              showMp: false,
              showHp: false,
              ac: ac || 10,
              showAc: false,
              initiative: 0,
              characterId: chId || null,
              createdAt: serverTimestamp(),
              conditions: [], 
              effects: [], 
            });
            await updateDoc(doc(db, 'combats', combatId, 'invites', inv.id), { participantId: partRef.id });
            if (inv.targetUid) {
              try {
                const m = await import('firebase/firestore');
                await m.setDoc(m.doc(db, 'userInvites', inv.targetUid, 'items', inv.id), { participantId: partRef.id }, { merge: true });
              } catch {}
            }
          } catch (e) {
            console.error('Failed to create participant for accepted invite', e);
          }
        }
      }
    };
    run();
  }, [combatId, invites]);

  // Load available characters for inviting (GM view)
  useEffect(() => {
    // ... (этот useEffect без изменений)
    const loadChars = async () => {
      try {
        const q = query(collection(db, 'characterSheets'), orderBy('updatedAt', 'desc'));
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => {
          const data = d.data() as { sheet?: { name?: string }; ownerEmail?: string; displayName?: string; ownerUid?: string };
          return { id: d.id, name: data.sheet?.name || 'Без имени', ownerEmail: data.ownerEmail, displayName: data.displayName, ownerUid: (data as any).ownerUid };
        });
        setCharacters(list);
        if (list.length && !selectedCharId) setSelectedCharId(list[0].id);
      } catch (e) {
        console.error('load characters failed', e);
      }
    };
    loadChars();
  }, []);

  const handleCreateCombat = async () => {
    // ... (эта функция без изменений)
    if (!userUid) {
      setError('Необходима авторизация.');
      return;
    }
    try {
      const newDocRef = await addDoc(collection(db, 'combats'), {
        ownerUid: userUid,
        createdAt: serverTimestamp(),
        round: 1,
        activeIndex: 0,
        status: 'idle',
      });
      navigate(`/combat/${newDocRef.id}`);
    } catch (e) {
      console.error(e);
      setError('Не удалось создать бой.');
    }
  };

  const handleInvite = async (e: FormEvent) => {
    // ... (эта функция без изменений)
    e.preventDefault();
    if (!combatId || !selectedCharId) return;
    const ch = characters.find((c) => c.id === selectedCharId);
    if (!ch) return;
    if (!ch.ownerUid) {
      setError('У выбранного персонажа не указан владелец (UID). Откройте лист и сохраните — поле ownerUid добавится автоматически.');
      return;
    }
    try {
      const inviteRef = await addDoc(collection(db, 'combats', combatId, 'invites'), {
        status: 'pending',
        createdAt: serverTimestamp(),
        characterId: ch.id,
        characterName: ch.name,
        targetUid: ch.ownerUid,
      });
      // Mirror doc for quick lookup by player (no collectionGroup indexes)
      await updateDoc(inviteRef, {}); // ensure server timestamp applied before mirroring
      await (await import('firebase/firestore')).setDoc(
        (await import('firebase/firestore')).doc(db, 'userInvites', ch.ownerUid, 'items', inviteRef.id),
        {
          combatId,
          characterId: ch.id,
          characterName: ch.name,
          status: 'pending',
          createdAt: serverTimestamp(),
          invitePath: inviteRef.path,
        },
      );
    } catch (e) {
      console.error(e);
      setError('Не удалось отправить приглашение.');
    }
  };

  const blocked = !loading && role !== 'gm';

  const startCombat = async () => {
    // ... (эта функция без изменений)
    if (!combatId) return;
    const combatDoc = doc(db, 'combats', combatId);
    await updateDoc(combatDoc, { status: 'active', round: 1, activeIndex: 0 });
  };

  const endCombat = async () => {
    // ... (эта функция без изменений)
    if (!combatId) return;
    const combatDoc = doc(db, 'combats', combatId);
    await updateDoc(combatDoc, { status: 'ended' });
  };

  const nextTurn = async () => {
    // ... (эта функция без изменений)
    if (!combatId) return;
    const cnt = participants.length;
    if (cnt === 0) return;
    const nextIdx = (meta.activeIndex + 1) % cnt;
    const nextRound = nextIdx === 0 ? meta.round + 1 : meta.round;
    const combatDoc = doc(db, 'combats', combatId);
    await updateDoc(combatDoc, { activeIndex: nextIdx, round: nextRound });
  };

  const prevTurn = async () => {
    // ... (эта функция без изменений)
    if (!combatId) return;
    const cnt = participants.length;
    if (cnt === 0) return;
    const prevIdx = (meta.activeIndex - 1 + cnt) % cnt;
    const prevRound = meta.activeIndex === 0 ? Math.max(1, meta.round - 1) : meta.round;
    const combatDoc = doc(db, 'combats', combatId);
    await updateDoc(combatDoc, { activeIndex: prevIdx, round: prevRound });
  };

  const addQuickParticipant = async () => {
    // ... (эта функция без изменений)
    if (!combatId) return;
    try {
      const ref = await addDoc(collection(db, 'combats', combatId, 'participants'), {
        name: 'Новый участник',
        type: 'player',
        dexMod: 0,
        hp: 0,
        hpMax: 0,
        mp: 0,
        mpMax: 0,
        showMp: false,
        showHp: false,
        ac: 10,
        showAc: false,
        initiative: 0,
        createdAt: serverTimestamp(),
        conditions: [], 
        effects: [], 
      });
      setSelectedId(ref.id);
    } catch (e) {
      console.error(e);
      setError('Не удалось добавить участника.');
    }
  };

  const updateSelected = async (patch: Partial<Participant>) => {
    // ... (эта функция без изменений)
    if (!combatId || !selected) return;
    await updateDoc(doc(db, 'combats', combatId, 'participants', selected.id), patch as Record<string, unknown>);
  };

  const rollD20ForInitiative = async () => {
    // ... (эта функция без изменений)
    if (!selected) return;
    const roll = Math.floor(Math.random() * 20) + 1;
    await updateSelected({ initiative: roll });
  };

  // --- Функции для управления Состояниями и Эффектами ---
  const addCondition = async () => {
    // ... (эта функция без изменений)
    if (!combatId || !selected || !newCondition.trim()) return;
    await updateDoc(doc(db, 'combats', combatId, 'participants', selected.id), {
      conditions: arrayUnion(newCondition.trim())
    });
    setNewCondition('');
  };
  const removeCondition = async (condition: string) => {
    // ... (эта функция без изменений)
    if (!combatId || !selected) return;
    await updateDoc(doc(db, 'combats', combatId, 'participants', selected.id), {
      conditions: arrayRemove(condition)
    });
  };
  const addEffect = async () => {
    // ... (эта функция без изменений)
    if (!combatId || !selected || !newEffect.trim()) return;
    await updateDoc(doc(db, 'combats', combatId, 'participants', selected.id), {
      effects: arrayUnion(newEffect.trim())
    });
    setNewEffect('');
  };
  const removeEffect = async (effect: string) => {
    // ... (эта функция без изменений)
    if (!combatId || !selected) return;
    await updateDoc(doc(db, 'combats', combatId, 'participants', selected.id), {
      effects: arrayRemove(effect)
    });
  };
  // --- Конец функций ---

  // vvv ДОБАВЛЕНЫ ФУНКЦИИ ДЛЯ ШАБЛОНОВ vvv

  /**
   * Сохраняет текущих участников (кроме игроков) как новый шаблон.
   */
  const handleSaveTemplate = async () => {
    const nonPlayerParticipants = participants.filter(p => p.type !== 'player' && !p.ownerUid);

    if (!userUid || nonPlayerParticipants.length === 0) {
      setError('Нет участников (кроме игроков) для сохранения в шаблон.');
      return;
    }
    
    const name = prompt('Введите название шаблона (н-р, "Гоблины x5"):');
    if (!name || !name.trim()) return;

    setTemplateLoading(true);
    setError(null);
    try {
      // 1. Создаем основной документ шаблона
      const templateRef = await addDoc(collection(db, 'combatTemplates'), {
        name: name.trim(),
        ownerUid: userUid,
        createdAt: serverTimestamp(),
      });

      // 2. Пакетно записываем всех участников (кроме игроков) в подколлекцию
      const batch = writeBatch(db);
      const templatePartsCol = collection(db, 'combatTemplates', templateRef.id, 'participants');
      
      for (const p of nonPlayerParticipants) {
        const { id, ...data } = p; // Убираем 'id' из live-боя
        batch.set(doc(templatePartsCol), data); // Firestore сгенерирует новый ID
      }

      await batch.commit();
      alert('Шаблон сохранен! (Участники-игроки были пропущены)');
    } catch (e) {
      console.error(e);
      setError('Не удалось сохранить шаблон.');
    } finally {
      setTemplateLoading(false);
    }
  };

  /**
   * Загружает участников из выбранного шаблона в текущий бой.
   */
  const handleLoadTemplate = async () => {
    if (!combatId || !selectedTemplateId) {
      setError('Шаблон не выбран.');
      return;
    }
    setTemplateLoading(true);
    setError(null);
    try {
      // 1. Получаем всех участников из подколлекции шаблона
      const templatePartsCol = collection(db, 'combatTemplates', selectedTemplateId, 'participants');
      const snap = await getDocs(templatePartsCol);
      
      if (snap.empty) {
        setError('Выбранный шаблон пуст.');
        setTemplateLoading(false);
        return;
      }

      // 2. Пакетно записываем их в подколлекцию *текущего* боя
      const batch = writeBatch(db);
      const combatPartsCol = collection(db, 'combats', combatId, 'participants');
      
      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        // Добавляем 'createdAt' для нового участника
        const newParticipantData = {
          ...data,
          createdAt: serverTimestamp(),
        };
        batch.set(doc(combatPartsCol), newParticipantData);
      }

      await batch.commit();
    } catch (e) {
      console.error(e);
      setError('Не удалось загрузить шаблон.');
    } finally {
      setTemplateLoading(false);
    }
  };

  /**
   * Удаляет выбранный шаблон (включая всех участников внутри него).
   */
  const handleDeleteTemplate = async () => {
    if (!selectedTemplateId) return;
    
    if (!confirm(`Вы уверены, что хотите удалить шаблон "${templates.find(t => t.id === selectedTemplateId)?.name}"? Это действие нельзя отменить.`)) {
      return;
    }
    
    setTemplateLoading(true);
    setError(null);
    try {
      const templateRef = doc(db, 'combatTemplates', selectedTemplateId);
      const templatePartsCol = collection(db, 'combatTemplates', selectedTemplateId, 'participants');
      
      // 1. Удаляем всех участников из подколлекции
      const snap = await getDocs(templatePartsCol);
      const batch = writeBatch(db);
      snap.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      // 2. Удаляем сам документ шаблона
      await deleteDoc(templateRef);

      setSelectedTemplateId(''); // Сбрасываем выбор
      alert('Шаблон удален.');

    } catch (e) {
      console.error(e);
      setError('Не удалось удалить шаблон.');
    } finally {
      setTemplateLoading(false);
    }
  };
  // ^^^ КОНЕЦ ФУНКЦИЙ ДЛЯ ШАБЛОНОВ ^^^


  return (
    <div className="combat-root">
      <header className="combat-header">
        {/* ... (header без изменений) ... */}
        <div>
          <h1>Боевые инструменты</h1>
          <p>Настройте участников и управляйте ходом боя в реальном времени.</p>
        </div>
        <Link className="gm-hub-back" to="/gm-hub">
          <i className="fa-solid fa-arrow-left-long" aria-hidden />
          <span>Назад</span>
        </Link>
      </header>

      <main className="combat-main">
        {loading && <p>Загрузка...</p>}
        {blocked && !loading && (
          <p className="gm-hub-error">Доступ запрещён. Страница только для ГМа.</p>
        )}

        {!loading && !blocked && (
          <div className="combat-grid">
            {/* Левая колонка */}
            <aside className="combat-left">
              <div className="combat-card">
                <div className="combat-card-title">Ход боя</div>
                {!combatId ? (
                  <button className="btn btn-primary" onClick={handleCreateCombat} type="button">
                    <i className="fa-solid fa-swords" /> Создать бой
                  </button>
                ) : (
                  <div className="combat-controls">
                    <div className="combat-status">Раунд {meta.round} — {meta.status === 'active' ? 'Активный' : meta.status === 'ended' ? 'Завершён' : 'Ожидает'}</div>
                    <div className="combat-buttons">
                      <button className="btn" onClick={startCombat} disabled={meta.status === 'active'}>
                        <i className="fa-solid fa-play" /> Начать бой
                      </button>
                      <button className="btn" onClick={prevTurn} disabled={meta.status !== 'active'}>
                        <i className="fa-solid fa-backward-step" /> Предыдущий ход
                      </button>
                      <button className="btn" onClick={nextTurn} disabled={meta.status !== 'active'}>
                        <i className="fa-solid fa-forward-step" /> Следующий ход
                      </button>
                      <button className="btn btn-danger" onClick={endCombat} disabled={meta.status === 'ended' || !combatId}>
                        <i className="fa-solid fa-square" /> Завершить
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* vvv ДОБАВЛЕН БЛОК ШАБЛОНОВ vvv */}
              {combatId && (
                <div className="combat-card">
                  <div className="combat-card-title">Шаблоны боя</div>
                  <div className="template-form">
                    <select 
                      value={selectedTemplateId} 
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      disabled={templates.length === 0 || templateLoading}
                    >
                      {templates.length === 0 && <option>Нет сохраненных шаблонов</option>}
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <div className="template-buttons">
                      <button 
                        className="btn" 
                        onClick={handleLoadTemplate} 
                        disabled={!selectedTemplateId || templateLoading}
                        title="Загрузить участников из шаблона в этот бой"
                      >
                        <i className="fa-solid fa-download" /> Загрузить
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        onClick={handleSaveTemplate}
                        disabled={templateLoading || participants.filter(p => p.type !== 'player' && !p.ownerUid).length === 0}
                        title="Сохранить всех (кроме игроков) из этого боя как новый шаблон"
                      >
                        <i className="fa-solid fa-save" /> Сохранить
                      </button>
                    </div>
                    {selectedTemplateId && (
                      <button 
                        className="btn btn-danger btn-small" 
                        onClick={handleDeleteTemplate}
                        disabled={templateLoading}
                        style={{ gridColumn: '1 / -1' }} // Кнопка на всю ширину
                      >
                        <i className="fa-solid fa-trash" /> Удалить выбранный шаблон
                      </button>
                    )}
                  </div>
                </div>
              )}
              {/* ^^^ КОНЕЦ БЛОКА ШАБЛОНОВ ^^^ */}


              <div className="combat-card">
                <div className="combat-card-title">Очередь инициативы</div>
                {participants.length === 0 ? (
                  <p className="muted">Пока нет участников</p>
                ) : (
                  <ul className="initiative-list">
                    {/* ... (map по participants без изменений) ... */}
                    {participants.map((p, idx) => {
                      const hpVal = Number(p.hp ?? 0);
                      const hpMaxVal = Math.max(0, Number(p.hpMax ?? 0));
                      const pct = hpMaxVal > 0 ? Math.max(0, Math.min(100, (hpVal / hpMaxVal) * 100)) : 0;
                      const mpVal = Number(p.mp ?? 0);
                      const mpMaxVal = Math.max(0, Number(p.mpMax ?? 0));
                      const mpPct = mpMaxVal > 0 ? Math.max(0, Math.min(100, (mpVal / mpMaxVal) * 100)) : 0;
                      const hCls = pct > 70 ? 'is-high' : pct > 30 ? 'is-mid' : 'is-low';
                      const pType = p.type || 'player'; 
                      return (
                        <li
                          key={p.id}
                          className={`initiative-item${selectedId === p.id ? ' is-selected' : ''}${meta.status === 'active' && meta.activeIndex === idx ? ' is-active' : ''} is-type-${pType}`}
                          onClick={() => setSelectedId(p.id)}
                          role="button"
                        >
                          <div className="initiative-top">
                            <div className="initiative-name-ac">
                              <span className="initiative-name" title={p.name || 'Безымянный'}>{p.name || 'Безымянный'}</span>
                              <span className="initiative-ac">
                                <i className="fa-solid fa-shield" /> {p.ac || 0}
                              </span>
                            </div>
                            <span className="initiative-score">{(p.initiative || 0) + (Number(p.dexMod) || 0)}</span>
                          </div>
                          <div className="hp-row">
                            <div className="hp-bar" aria-label={`HP ${hpVal}/${hpMaxVal}`}>
                              <div className={`hp-bar__fill ${hCls}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="hp-text">{hpVal}/{hpMaxVal}</span>
                          </div>
                          <div className="hp-row">
                            <div className="hp-bar" aria-label={`MP ${mpVal}/${mpMaxVal}`}>
                              <div className="hp-bar__fill is-mp" style={{ width: `${mpPct}%` }} />
                            </div>
                            <span className="hp-text">{mpVal}/{mpMaxVal}</span>
                          </div>
                          {(p.conditions?.length > 0 || p.effects?.length > 0) && (
                            <div className="participant-tags">
                              {(p.conditions || []).map(c => <span key={c} className="tag is-condition">{c}</span>)}
                              {(p.effects || []).map(e => <span key={e} className="tag is-effect">{e}</span>)}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {combatId && (
                  <button className="btn btn-secondary" onClick={addQuickParticipant}>
                    <i className="fa-solid fa-user-plus" /> Добавить участника
                  </button>
                )}
              </div>

              {combatId && (
                <div className="combat-card">
                   {/* ... (блок Приглашения без изменений) ... */}
                  <div className="combat-card-title">Приглашения</div>
                  <form onSubmit={handleInvite} className="invite-form invite-form--chars">
                    <select value={selectedCharId} onChange={(e) => setSelectedCharId(e.target.value)}>
                      {characters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.displayName ? `— ${c.displayName}` : c.ownerEmail ? `— ${c.ownerEmail}` : ''}
                        </option>
                      ))}
                    </select>
                    <button className="btn" type="submit" disabled={!selectedCharId}>
                      <i className="fa-solid fa-paper-plane" /> Пригласить
                    </button>
                  </form>
                  {invites.length > 0 && (
                    <ul className="invite-list">
                      {invites.map((i) => {
                        const statusLabel = i.status === 'pending' ? 'Ожидание' : i.status === 'accepted' ? 'Принято' : 'Отклонено';
                        const statusClass = i.status === 'pending' ? 'is-pending' : i.status === 'accepted' ? 'is-accepted' : 'is-declined';
                        const statusIcon = i.status === 'pending' ? 'fa-hourglass-half' : i.status === 'accepted' ? 'fa-check' : 'fa-xmark';
                        // @ts-ignore additional fields may exist
                        const chName = (i as any).characterName || 'Персонаж';
                        return (
                          <li key={i.id} className="invite-item">
                            <span className="invite-name"><i className="fa-solid fa-user" aria-hidden /> {chName}</span>
                            <span className={`invite-status ${statusClass}`}>
                              <i className={`fa-solid ${statusIcon}`} aria-hidden /> {statusLabel}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </aside>

            {/* Правая колонка */}
            <section className="combat-right">
               {/* ... (блок Сводка боя без изменений) ... */}
              <div className="combat-card">
                <div className="combat-card-title">Сводка боя</div>
                <div className="summary-bar">{meta.status === 'idle' && 'Бой ожидает начала.'}{meta.status === 'active' && `Идёт бой. Раунд ${meta.round}.`}{meta.status === 'ended' && 'Бой завершён.'}</div>
              </div>

              <div className="combat-card">
                <div className="combat-card-title">Карточка участника</div>
                {!selected ? (
                  <p className="muted">Выберите участника из очереди слева.</p>
                ) : (
                  <form className="participant-form" onSubmit={(e) => e.preventDefault()}>
                     {/* ... (вся <form className="participant-form"> без изменений) ... */}
                    <label>
                      Имя участника
                      <input
                        type="text"
                        value={selected.name}
                        onChange={(e) => updateSelected({ name: e.target.value })}
                        placeholder="Имя"
                      />
                    </label>

                    <label>
                      Тип
                      <select
                        value={selected.type ?? 'player'}
                        onChange={(e) => updateSelected({ type: e.target.value as 'player' | 'npc' | 'ally' | 'enemy' })}
                      >
                        <option value="player">Игрок</option>
                        <option value="npc">NPC</option>
                        <option value="ally">Союзник</option>
                        <option value="enemy">Противник</option>
                      </select>
                    </label>

                    <label>
                      Инициатива (Бросок / База)
                      <input
                        type="number"
                        value={selected.initiative ?? 0}
                        onChange={(e) => updateSelected({ initiative: e.target.value === '' ? 0 : Number(e.target.value) })}
                        placeholder="Например, 15"
                      />
                    </label>

                    <label>
                      Модификатор Ловкости
                      <input
                        type="number"
                        value={selected.dexMod ?? 0}
                        onChange={async (e) => {
                          const newDex = e.target.value === '' ? 0 : Number(e.target.value);
                          await updateSelected({ dexMod: newDex });
                        }}
                        placeholder="0"
                      />
                    </label>

                    <label>
                      КД (Класс Доспеха)
                      <input
                        type="number"
                        value={selected.ac ?? 10}
                        onChange={(e) => updateSelected({ ac: e.target.value === '' ? 10 : Number(e.target.value) })}
                        placeholder="Например, 15"
                      />
                    </label>

                    <label>
                      Владелец (UID игрока)
                      <input
                        type="text"
                        value={selected.ownerUid ?? ''}
                        onChange={(e) => updateSelected({ ownerUid: e.target.value })}
                        placeholder="Не назначен"
                      />
                    </label>

                    {(() => {
                      const cur = Number(selected.hp ?? 0);
                      const max = Math.max(0, Number(selected.hpMax ?? 0));
                      const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((cur / Math.max(1, max)) * 100))) : 0;
                      const hCls = pct > 70 ? 'is-high' : pct > 30 ? 'is-mid' : 'is-low';
                      const setHp = async (value: number) => {
                        await updateSelected({ hp: Math.max(0, Math.min(999, Math.floor(value))) });
                      };
                      const setHpMax = async (value: number) => {
                        const v = Math.max(0, Math.min(999, Math.floor(value)));
                        await updateSelected({ hpMax: v, hp: Math.min(cur, v) });
                      };
                      return (
                        <div className="gm-hp">
                          <div className="hp-row">
                            <div className="hp-bar" aria-label={`HP ${cur}/${max}`}>
                              <div className={`hp-bar__fill ${hCls}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="hp-text">{cur} / {max}</span>
                          </div>
                          <div className="gm-hp-controls">
                            <input type="number" value={cur} onChange={(e) => setHp(Number(e.target.value))} />
                            <div className="hp-text">/</div>
                            <input type="number" value={max} onChange={(e) => setHpMax(Number(e.target.value))} />
                          </div>
                        </div>
                      );
                    })()}

                    {(() => {
                      const cur = Number(selected.mp ?? 0);
                      const max = Math.max(0, Number(selected.mpMax ?? 0));
                      const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((cur / Math.max(1, max)) * 100))) : 0;
                      const setMp = async (value: number) => {
                        await updateSelected({ mp: Math.max(0, Math.min(999, Math.floor(value))) });
                      };
                      const setMpMax = async (value: number) => {
                        const v = Math.max(0, Math.min(999, Math.floor(value)));
                        await updateSelected({ mpMax: v, mp: Math.min(cur, v) });
                      };
                      return (
                        <div className="gm-hp">
                          <div className="hp-row">
                            <div className="hp-bar" aria-label={`MP ${cur}/${max}`}>
                              <div className="hp-bar__fill is-mp" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="hp-text">{cur} / {max}</span>
                          </div>
                          <div className="gm-hp-controls">
                            <input type="number" value={cur} onChange={(e) => setMp(Number(e.target.value))} />
                            <div className="hp-text">/</div>
                            <input type="number" value={max} onChange={(e) => setMpMax(Number(e.target.value))} />
                          </div>
                        </div>
                      );
                    })()}

                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={Boolean(selected.showHp)}
                        onChange={(e) => updateSelected({ showHp: e.target.checked })}
                      />
                      Показывать HP всем
                    </label>

                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={Boolean(selected.showMp)}
                        onChange={(e) => updateSelected({ showMp: e.target.checked })}
                      />
                      Показывать MP всем
                    </label>

                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={Boolean(selected.showAc)}
                        onChange={(e) => updateSelected({ showAc: e.target.checked })}
                      />
                      Показывать КД всем
                    </label>

                    <div className="form-list-manager">
                      <label>Состояния</label>
                      <div className="tag-list">
                        {(selected.conditions || []).map(c => (
                          <span key={c} className="tag is-condition">
                            {c}
                            <button type="button" onClick={() => removeCondition(c)}>&times;</button>
                          </span>
                        ))}
                      </div>
                      <div className="form-add-tag">
                        <input
                          type="text"
                          value={newCondition}
                          onChange={(e) => setNewCondition(e.target.value)}
                          placeholder="Напр., Очарован"
                        />
                        <button className="btn" type="button" onClick={addCondition}>Добавить</button>
                      </div>
                    </div>
                    
                    <div className="form-list-manager">
                      <label>Прочие эффекты</label>
                      <div className="tag-list">
                        {(selected.effects || []).map(e => (
                          <span key={e} className="tag is-effect">
                            {e}
                            <button type="button" onClick={() => removeEffect(e)}>&times;</button>
                          </span>
                        ))}
                      </div>
                      <div className="form-add-tag">
                        <input
                          type="text"
                          value={newEffect}
                          onChange={(e) => setNewEffect(e.target.value)}
                          placeholder="Напр., Кровотечение (d4)"
                        />
                        <button className="btn" type="button" onClick={addEffect}>Добавить</button>
                      </div>
                    </div>


                    <div className="form-actions">
                      <button className="btn" type="button" onClick={rollD20ForInitiative}>
                        <i className="fa-solid fa-dice-d20" /> Бросить d20
                      </button>
                      <button className="btn" type="button" onClick={() => void 0} style={{ display: 'none' }}>
                        Сохранить
                      </button>
                      <button
                        className="btn btn-danger"
                        type="button"
                        onClick={async () => {
                          if (!combatId || !selected) return;
                          await deleteDoc(doc(db, 'combats', combatId, 'participants', selected.id));
                          setSelectedId(null);
                        }}
                      >
                        Удалить
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </section>
          </div>
        )}

        {error && <p className="gm-hub-error" style={{ marginTop: 12 }}>{error}</p>}
      </main>
    </div>
  );
};

export default CombatPage;
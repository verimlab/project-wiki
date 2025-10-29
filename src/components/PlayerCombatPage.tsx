import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import './PlayerCombatPage.css';

type Meta = { round: number; activeIndex: number; status: 'idle' | 'active' | 'ended' };

// ИЗМЕНЕНИЕ: Добавлены ac и showAc
type Participant = {
  id: string;
  name: string;
  initiative: number;
  createdAt?: unknown;
  type?: 'player' | 'npc' | 'ally' | 'enemy';
  dexMod?: number | '';
  ownerUid?: string | null;
  showHp?: boolean;
  hp?: number | '';
  hpMax?: number | '';
  ac?: number | '';
  mp?: number | '';
  mpMax?: number | '';
  showAc?: boolean;
  showMp?: boolean;
  conditions: string[]; // <--- Добавлено
  effects: string[]; // <--- Добавлено
  characterId?: string | null;
};

const PlayerCombatPage: React.FC = () => {
  const params = useParams();
  const combatId = params.combatId as string | undefined;

  const [userUid, setUserUid] = useState<string | null>(null);
  const [meta, setMeta] = useState<Meta>({ round: 1, activeIndex: 0, status: 'idle' });
  const [participants, setParticipants] = useState<Participant[]>([]);

  // audio notification
  // ... (этот блок без изменений)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioReadyRef = useRef<boolean>(false);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const defaultSoundUrl = '/assets/turn.mp3';
  const ensureAudio = () => {
    // prepare HTMLAudio element first (custom file if provided)
    if (!audioRef.current) {
      const el = new Audio();
      el.preload = 'auto';
      el.src = defaultSoundUrl;
      el.addEventListener('canplaythrough', () => { audioReadyRef.current = true; }, { once: true });
      el.addEventListener('error', () => { audioReadyRef.current = false; });
      audioRef.current = el;
    }
    // attempt a very short play to unlock on mobile
    audioRef.current.volume = 1;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});

    if (!audioCtxRef.current) {
      const Ctx: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;
      audioCtxRef.current = new Ctx();
    }
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    // Route element through WebAudio with gain boost (~2x)
    if (audioRef.current && audioCtxRef.current && !sourceRef.current) {
      try {
        sourceRef.current = audioCtxRef.current.createMediaElementSource(audioRef.current);
        gainRef.current = audioCtxRef.current.createGain();
        gainRef.current.gain.value = 2.0; // ~2x louder
        sourceRef.current.connect(gainRef.current);
        gainRef.current.connect(audioCtxRef.current.destination);
        // mute original element path to avoid double playback
        audioRef.current.muted = true;
        audioRef.current.volume = 1;
      } catch (e) {
        // If connecting fails, fall back to direct element playback
        console.warn('Audio graph setup failed; falling back to element output', e);
        if (audioRef.current) audioRef.current.muted = false;
      }
    }
    setAudioEnabled(true);
    return audioCtxRef.current;
  };
  const playTurnSound = () => {
    // prefer bundled audio file if available and loaded
    if (audioRef.current && audioReadyRef.current) {
      try {
        audioRef.current.currentTime = 0;
        void audioRef.current.play();
        return;
      } catch {}
    }
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    const tone = (freq: number, start: number, dur: number, gain = 0.08) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, now + start);
      g.gain.exponentialRampToValueAtTime(gain, now + start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    };
    // simple up arpeggio
    tone(740, 0, 0.12);
    tone(988, 0.08, 0.12);
    tone(1319, 0.16, 0.18);
  };


  // auth
  useEffect(() => {
    // ... (этот useEffect без изменений)
    const unsub = onAuthStateChanged(auth, (u) => setUserUid(u?.uid ?? null));
    return () => unsub();
  }, []);

  // subscriptions
  useEffect(() => {
    // ... (этот useEffect без изменений)
    if (!combatId) return;
    const partsCol = collection(db, 'combats', combatId, 'participants');
    const combatDoc = doc(db, 'combats', combatId);

    const unsubA = onSnapshot(query(partsCol, orderBy('initiative', 'desc')), (snap) => {
      setParticipants(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Participant, 'id'>) })));
    });
    const unsubB = onSnapshot(combatDoc, (snap) => {
      const data = snap.data() as Partial<Meta> | undefined;
      setMeta({ round: data?.round ?? 1, activeIndex: data?.activeIndex ?? 0, status: (data?.status as Meta['status']) ?? 'idle' });
    });
    return () => { unsubA(); unsubB(); };
  }, [combatId]);

  const me = useMemo(() => participants.find((p) => !!userUid && p.ownerUid === userUid) || null, [participants, userUid]);

  const hp = typeof me?.hp === 'number' ? me.hp : 0;
  const hpMax = typeof me?.hpMax === 'number' ? me.hpMax : 0;
  const initiative = typeof me?.initiative === 'number' ? me.initiative : 0;
  const mePct = hpMax ? Math.round((hp / Math.max(1, hpMax)) * 100) : 0;
  const meHealthCls = mePct > 70 ? 'is-high' : mePct > 30 ? 'is-mid' : 'is-low';

  // --- Добавлено для Маны ---
  const mp = typeof me?.mp === 'number' ? me.mp : 0;
  const mpMax = typeof me?.mpMax === 'number' ? me.mpMax : 0;
  const meMpPct = mpMax ? Math.round((mp / Math.max(1, mpMax)) * 100) : 0;

  const changeInitiative = async (delta: number) => {
    // ... (эта функция без изменений)
    if (!combatId || !me) return;
    const next = Math.max(0, initiative + delta);
    try {
      await updateDoc(doc(db, 'combats', combatId, 'participants', me.id), { initiative: next });
    } catch (e) { console.error(e); }
  };

  const setInitiative = async (value: number) => {
    // ... (эта функция без изменений)
    if (!combatId || !me) return;
    const v = Math.max(0, Math.floor(value || 0));
    try { await updateDoc(doc(db, 'combats', combatId, 'participants', me.id), { initiative: v }); } catch (e) { console.error(e); }
  };

  const changeHp = async (delta: number) => {
    // ... (эта функция без изменений)
    if (!combatId || !me) return;
    const next = Math.max(0, Math.min(hpMax || 0, hp + delta));
    await setHp(next);
  };

  // --- Добавлено для Маны ---
  const changeMp = async (delta: number) => {
    if (!combatId || !me) return;
    const next = Math.max(0, Math.min(mpMax || 0, mp + delta));
    await setMp(next);
  };

  // detect my turn
  // ... (этот useEffect без изменений)
  const prevActiveIdRef = useRef<string | null>(null);
  useEffect(() => {
    const activeId = participants[meta.activeIndex]?.id || null;
    const prev = prevActiveIdRef.current;
    prevActiveIdRef.current = activeId;
    if (!me) return;
    if (activeId === me.id && prev !== me.id) {
      // my turn just started
      playTurnSound();
    }
  }, [meta.activeIndex, participants, me?.id]);

  const setHp = async (value: number) => {
    // ... (эта функция без изменений)
    if (!combatId || !me) return;
    const v = Math.max(0, Math.min(hpMax || 0, Math.floor(value || 0)));
    try {
      await updateDoc(doc(db, 'combats', combatId, 'participants', me.id), { hp: v });
      if (me.characterId) {
        // persist to character sheet as well
        try {
          await updateDoc(doc(db, 'characterSheets', me.characterId), { 'sheet.healthCurrent': v, updatedAt: serverTimestamp() });
        } catch {}
      }
    } catch (e) {
      console.error(e);
    }
  };

  // --- Добавлено для Маны ---
  const setMp = async (value: number) => {
    if (!combatId || !me) return;
    const v = Math.max(0, Math.min(mpMax || 0, Math.floor(value || 0)));
    try {
      await updateDoc(doc(db, 'combats', combatId, 'participants', me.id), { mp: v });
      if (me.characterId) {
        // persist to character sheet as well
        try {
          // ИЗМЕНЕНИЕ: Обновляем 'sheet.manaCurrent'
          await updateDoc(doc(db, 'characterSheets', me.characterId), { 'sheet.manaCurrent': v, updatedAt: serverTimestamp() });
        } catch {}
      }
    } catch (e) {
      console.error(e);
    }
  };


  return (
    <div className="pc-root">
      <header className="pc-header">
        {/* ... (header без изменений) ... */}
        <div className="pc-title">
          <i className="fa-solid fa-sparkles" aria-hidden />
          <div>
            <h1>Бой для игрока</h1>
            <p>Следи за ходом боя и обновляй своё здоровье и инициативу.</p>
          </div>
        </div>
        <div className="pc-meta">
          <span className={`pc-status pc-status--${meta.status}`}>{meta.status === 'active' ? 'Идёт бой' : meta.status === 'ended' ? 'Завершён' : 'Ожидание'}</span>
          <span className="pc-round">Раунд: {meta.round}</span>
          <button className="pc-sound" onClick={ensureAudio} type="button">{audioEnabled ? 'Звук включен' : 'Включить звук'}</button>
          <Link to="/" className="pc-exit">Выйти</Link>
        </div>
      </header>

      <main className="pc-main">
        {/* Перенесено: сначала трекер (слева), затем инструменты (справа) */}
        <aside className="pc-right">
          <div className="pc-card">
            <div className="pc-card-title">Очередь хода</div>
            <ul className="pc-queue">
              {participants.map((p, idx) => {
                const active = idx === meta.activeIndex;
                const isMe = me && p.id === me.id;
                const hpVal = typeof p.hp === 'number' ? p.hp : 0;
                const hpMaxVal = typeof p.hpMax === 'number' ? p.hpMax : 0;
                const pct = hpMaxVal > 0 ? Math.round((hpVal / Math.max(1, hpMaxVal)) * 100) : 0;
                const hCls = pct > 70 ? 'is-high' : pct > 30 ? 'is-mid' : 'is-low';
                const hideHp = p.showHp === false;
                // --- Добавлено для Маны ---
                const mpVal = typeof p.mp === 'number' ? p.mp : 0;
                const mpMaxVal = typeof p.mpMax === 'number' ? p.mpMax : 0;
                const mpPct = mpMaxVal > 0 ? Math.round((mpVal / Math.max(1, mpMaxVal)) * 100) : 0;
                const hideMp = p.showMp === false;
                const stateLabel = pct > 70 ? 'Отлично' : pct > 30 ? 'Средне' : 'Плохо';
                const stateClass = pct > 70 ? 'ok' : pct > 30 ? 'mid' : 'bad';
                
                // *** ИЗМЕНЕНИЕ ЗДЕСЬ ***
                const t = (p.type as 'player' | 'npc' | 'ally' | 'enemy') || 'player';
                // *** КОНЕЦ ИЗМЕНЕНИЯ ***

                const typeLabel = t === 'enemy' ? 'Противник' : t === 'ally' ? 'Союзник' : t === 'npc' ? 'NPC' : 'Игрок';
                const typeIcon = isMe ? 'fa-star' : t === 'enemy' ? 'fa-skull-crossbones' : t === 'ally' ? 'fa-handshake' : t === 'npc' ? 'fa-user' : 'fa-user-astronaut';
                
                // ИЗМЕНЕНИЕ: Добавлены переменные для КД
                const showAc = p.showAc === true;
                const acVal = typeof p.ac === 'number' ? p.ac : 0;

                return (
                  <li 
                    key={p.id} 
                    // *** ИЗМЕНЕНИЕ ЗДЕСЬ: Добавлен `is-type-${t}` ***
                    className={`pc-queue-item${active ? ' is-active' : ''}${isMe ? ' is-me' : ''} is-type-${t}`}
                    // *** КОНЕЦ ИЗМЕНЕНИЯ ***
                  >
                    <div className="pc-queue-left">
                      <div className="pc-initiative-badge">{p.initiative ?? 0}</div>
                      {/* ИЗМЕНЕНИЕ: Обновлена структура для отображения КД */}
                      <div className="pc-queue-info">
                        <div className="pc-queue-name-row">
                          <div className="pc-queue-name"><i className={`fa-solid ${typeIcon}`} aria-hidden />{p.name}</div>
                          {(showAc || isMe) && (
                            <div className="pc-queue-ac">
                              <i className="fa-solid fa-shield" aria-hidden />
                              <span>{acVal} КД</span>
                            </div>
                          )}
                        </div>
                        <div className="pc-type">{isMe ? 'Твой персонаж' : typeLabel}</div>
                        {hideHp ? (
                          <div className="pc-queue-hp">
                            <span className={`pc-hp-state ${hpMaxVal > 0 ? stateClass : 'unknown'}`}>{hpMaxVal > 0 ? stateLabel : 'Неизвестно'}</span>
                          </div>
                        ) : (
                          <div className="pc-queue-hp">
                            <div className="pc-bar small"><div className={`pc-bar-fill ${hCls}`} style={{ width: `${pct}%` }} /></div>
                            <span>{hpVal} / {hpMaxVal}</span>
                          </div>
                        )}
                        {/* --- Добавлен MP бар в список --- */}
                        {hideMp ? (
                          <div className="pc-queue-hp">
                            <span className={`pc-hp-state ${mpMaxVal > 0 ? 'unknown' : 'unknown'}`}>{mpMaxVal > 0 ? 'Мана (скрыто)' : 'Нет маны'}</span>
                          </div>
                        ) : (
                          <div className="pc-queue-hp">
                            <div className="pc-bar small"><div className="pc-bar-fill is-mp" style={{ width: `${mpPct}%` }} /></div>
                            <span>{mpVal} / {mpMaxVal}</span>
                          </div>
                        )}
                        {/* --- Добавлен блок тегов --- */}
                        {((p.conditions || []).length > 0 || (p.effects || []).length > 0) && (
                          <div className="pc-participant-tags">
                            {(p.conditions || []).map(c => <span key={c} className="pc-tag is-condition">{c}</span>)}
                            {(p.effects || []).map(e => <span key={e} className="pc-tag is-effect">{e}</span>)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="pc-queue-right">{isMe && <span className="pc-tag">Твой персонаж</span>}</div>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        <section className="pc-left">
          <div className="pc-card">
            {/* ... (инструменты игрока без изменений) ... */}
            <div className="pc-card-title">{me?.name || 'Ваш персонаж'}</div>
            <div className="pc-row">
              <div className="pc-subtitle">Твоя инициатива</div>
              <div className="pc-initiative">
                <button className="btn" onClick={() => changeInitiative(-1)}>-1</button>
                <input
                  type="number"
                  value={initiative}
                  onChange={(e) => setInitiative(Number(e.target.value))}
                />
                <button className="btn" onClick={() => changeInitiative(+1)}>+1</button>
              </div>
            </div>

            <div className="pc-row">
              <div className="pc-subtitle">Здоровье</div>
              <div className="pc-health">
                <div className="pc-bar">
                  <div className={`pc-bar-fill ${meHealthCls}`} style={{ width: `${mePct}%` }} />
                </div>
                <div className="pc-hp-stats">{hp} / {hpMax || 0} HP</div>
                <div className="pc-hp-controls">
                  <button className="btn" onClick={() => changeHp(-10)}>-10</button>
                  <button className="btn" onClick={() => changeHp(-1)}>-1</button>
                  <input type="number" value={hp} onChange={(e) => setHp(Number(e.target.value))} />
                  <div className="pc-hp-max">/ {hpMax || 0} HP</div>
                  <button className="btn" onClick={() => changeHp(+1)}>+1</button>
                  <button className="btn" onClick={() => changeHp(+10)}>+10</button>
                </div>
                <div className="pc-note">Изменения сохраняются и в бою, и в листе персонажа.</div>
              </div>
            </div>

            {/* --- Добавлен блок управления Маной --- */}
            <div className="pc-row">
              <div className="pc-subtitle">Мана</div>
              <div className="pc-health">
                <div className="pc-bar">
                  <div className="pc-bar-fill is-mp" style={{ width: `${meMpPct}%` }} />
                </div>
                <div className="pc-hp-stats">{mp} / {mpMax || 0} MP</div>
                <div className="pc-hp-controls">
                  <button className="btn" onClick={() => changeMp(-10)}>-10</button>
                  <button className="btn" onClick={() => changeMp(-1)}>-1</button>
                  <input type="number" value={mp} onChange={(e) => setMp(Number(e.target.value))} />
                  <div className="pc-hp-max">/ {mpMax || 0} MP</div>
                  <button className="btn" onClick={() => changeMp(+1)}>+1</button>
                  <button className="btn" onClick={() => changeMp(+10)}>+10</button>
                </div>
                <div className="pc-note">Изменения сохраняются и в бою, и в листе персонажа.</div>
              </div>
            </div>

          </div>
        </section>
      </main>
    </div>
  );
};

export default PlayerCombatPage;
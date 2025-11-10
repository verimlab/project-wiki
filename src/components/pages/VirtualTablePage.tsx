// src/pages/VirtualTablePage.tsx
import React, {
  type PointerEvent,
  type ChangeEvent,
  type WheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type BoardConfig,
  type BoardDoc,
  type DragState,
  type Token,
  VirtualTableContext,
  type BoardMeta,
  type RollResult,
  type BoardMeasurement,
} from '../virtual-table/VirtualTableContext';
import { useAuth } from '../AuthContext';
import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteField,
  type Timestamp,
} from 'firebase/firestore';
import { db, storage } from '../../firebase';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

// --- Компоненты Layout ---
// import { VTPHeader } from '../virtual-table/VTPHeader'; // <-- УДАЛЕНО
import { VTSidebar } from '../virtual-table/VTSidebar';
import { VTBoard } from '../virtual-table/VTBoard';

// --- Стили Layout ---
import './VirtualTablePage.css';
import CharacterSheetDrawer from '../CharacterSheetDrawer';
import { createId } from '../../utils/id';
import { Dice2DOverlay } from '../dice-roller-2d/Dice2DOverlay';
import { VTToolbar } from '../virtual-table/VTToolbar';
import { VTChatLog } from '../chat/VTChatLog';
import { DiceRollerModal } from '../dice-roller-2d/DiceRollerModal';

// --- Константы (скопированы) ---
const DEFAULT_CONFIG: BoardConfig = {
  backgroundUrl: null,
  backgroundName: null,
  gridSize: 56,
  snapToGrid: true,
  showCoordinates: false,
  showGrid: true,
};
const DEFAULT_DOC: BoardDoc = { ...DEFAULT_CONFIG, tokens: [] };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
type PingMarker = { id: string; x: number; y: number; expiresAt: number; color: string };
const PLAYER_COLORS = ['#f472b6', '#c084fc', '#60a5fa', '#34d399', '#facc15', '#f97316', '#f87171'];
const pickColorForUser = (uid: string | null) => {
  if (!uid) return PLAYER_COLORS[0];
  let hash = 0;
  for (let i = 0; i < uid.length; i += 1) {
    hash = (hash + uid.charCodeAt(i) * (i + 1)) % 2147483647;
  }
  return PLAYER_COLORS[hash % PLAYER_COLORS.length];
};

const isMeasurementPoint = (value: unknown): value is { x: number; y: number } =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { x?: unknown }).x === 'number' &&
  typeof (value as { y?: unknown }).y === 'number';

type ActiveRoll = {
  id: string;
  type: string;
  value: number;
  isSingleRoll?: boolean;
  indexInGroup?: number;
};

// --- Главный компонент-провайдер ---
const VirtualTablePage: React.FC = () => {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const { role, user } = useAuth();
  const canEdit = role === 'gm';

  // ... (вся логика 'useState', 'useEffect', 'useCallback' остается АБСОЛЮТНО БЕЗ ИЗМЕНЕНИЙ) ...
  // ... (я вырезал их отсюда для краткости, не меняй их) ...
  const tableDocRef = useMemo(() => doc(db, 'virtualTables', 'default'), []);
  const [config, setConfig] = useState<BoardConfig>(DEFAULT_CONFIG);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [meta, setMeta] = useState<BoardMeta>({ updatedAt: null, updatedBy: null });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [focusedTokenId, setFocusedTokenId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panPointerIdRef = useRef<number | null>(null);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const cameraStateRef = useRef({ panX: 0, panY: 0, zoom: 1 });
  const [mapWidth, setMapWidth] = useState<number | null>(null);
  const [mapHeight, setMapHeight] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [openedSheetId, setOpenedSheetId] = useState<string | null>(null);
  const [fullSheetId, setFullSheetId] = useState<string | null>(null);
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [measureEnd, setMeasureEnd] = useState<{ x: number; y: number } | null>(null);
  const [measureMeters, setMeasureMeters] = useState<number | null>(null);
  const [measurePreviewMeters, setMeasurePreviewMeters] = useState<number | null>(null);
  const [measureArmed, setMeasureArmed] = useState(false);
  const [sharedMeasurements, setSharedMeasurements] = useState<Record<string, BoardMeasurement>>({});
  const [rollHistory, setRollHistory] = useState<RollResult[]>([]);
  const [activeRolls, setActiveRolls] = useState<ActiveRoll[]>([]);
  const [isDiceModalOpen, setIsDiceModalOpen] = useState(false);
  const [pings, setPings] = useState<PingMarker[]>([]);
  const [userColor, setUserColorInternal] = useState<string>(PLAYER_COLORS[0]);
  const pointerWorldRef = useRef<{ x: number; y: number } | null>(null);
  const [isColorDockOpen, setIsColorDockOpen] = useState(false);
  const cameraEngineRef = useRef({
    target: { panX: 0, panY: 0, zoom: 1 },
    current: { panX: 0, panY: 0, zoom: 1 },
    loopId: null as number | null,
  });
  const lastRemotePingIdRef = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const measurementBroadcastRef = useRef<string | null>(null);
  const fallbackMeasurementAuthorIdRef = useRef<string>(createId('measure-guest'));
  const measurementAuthorId = fallbackMeasurementAuthorIdRef.current;

  useEffect(() => {
    if (typeof window === 'undefined') {
      setUserColorInternal((prev) => prev ?? PLAYER_COLORS[0]);
      return;
    }
    const stored = window.localStorage.getItem('vt-user-color');
    if (stored) {
      setUserColorInternal(stored);
      return;
    }
    setUserColorInternal(pickColorForUser(user?.uid ?? null));
  }, [user?.uid]);

  useEffect(() => {
    if (user?.uid) {
      fallbackMeasurementAuthorIdRef.current = user.uid;
    }
  }, [user?.uid]);

  const setUserColor = useCallback((color: string) => {
    setUserColorInternal(color);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('vt-user-color', color);
    }
  }, []);

  const getViewportRect = useCallback(() => {
    const boardEl = boardRef.current;
    if (!boardEl) return null;
    return boardEl.parentElement?.getBoundingClientRect() ?? boardEl.getBoundingClientRect();
  }, []);

  const getWorldPoint = useCallback(
    (clientX: number, clientY: number) => {
      const rect = getViewportRect();
      if (!rect) return null;
      const { panX: currentPanX, panY: currentPanY, zoom: currentZoom } = cameraStateRef.current;
      return {
        x: (clientX - rect.left - currentPanX) / currentZoom,
        y: (clientY - rect.top - currentPanY) / currentZoom,
      };
    },
    [getViewportRect],
  );

  const snapToTokenCenter = useCallback(
    (point: { x: number; y: number }) => {
      const threshold = Math.max(config.gridSize * 0.4, 28);
      let closest: { x: number; y: number } | null = null;
      let closestDist = threshold;
      for (const token of tokens) {
        const dx = token.x - point.x;
        const dy = token.y - point.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= closestDist) {
          closest = { x: token.x, y: token.y };
          closestDist = dist;
        }
      }
      return closest;
    },
    [config.gridSize, tokens],
  );

  const playPingSound = useCallback(() => {
    try {
      if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.4);
    } catch (error) {
      console.warn('VTP: failed to play ping sound', error);
    }
  }, []);

  const addPing = useCallback(
    (
      point: { x: number; y: number },
      id: string = createId('ping'),
      color: string = userColor,
      shouldPlaySound = true,
    ) => {
      setPings((prev) => {
        const now = Date.now();
        const trimmed = prev.filter((ping) => ping.expiresAt > now && ping.id !== id);
        return [
          ...trimmed,
          {
            id,
            x: point.x,
            y: point.y,
            expiresAt: now + 2000,
            color,
          },
        ];
      });
      if (shouldPlaySound) {
        playPingSound();
      }
      return id;
    },
    [playPingSound, userColor],
  );

  useEffect(() => {
    cameraStateRef.current = { panX, panY, zoom };
  }, [panX, panY, zoom]);

  const clampPanForZoom = useCallback(
    (panValueX: number, panValueY: number, zoomValue: number) => {
      const boardParent = boardRef.current?.parentElement;
      if (!mapWidth || !mapHeight || !boardParent) {
        return { panX: panValueX, panY: panValueY };
      }

      const viewport = boardParent.getBoundingClientRect();
      const PADDING = 500;
      const scaledMapWidth = mapWidth * zoomValue;
      const scaledMapHeight = mapHeight * zoomValue;

      const maxPanX = PADDING;
      const minPanX = viewport.width - scaledMapWidth - PADDING;
      const maxPanY = PADDING;
      const minPanY = viewport.height - scaledMapHeight - PADDING;

      const clampValue = (value: number, boundA: number, boundB: number) =>
        Math.min(Math.max(value, Math.min(boundA, boundB)), Math.max(boundA, boundB));

      return {
        panX: clampValue(panValueX, minPanX, maxPanX),
        panY: clampValue(panValueY, minPanY, maxPanY),
      };
    },
    [mapHeight, mapWidth],
  );

  const snapCameraNow = useCallback(
    (panValueX: number, panValueY: number, zoomValue: number) => {
      const { panX: clampedPanX, panY: clampedPanY } = clampPanForZoom(panValueX, panValueY, zoomValue);
      setPanX(clampedPanX);
      setPanY(clampedPanY);
      setZoom(zoomValue);
      cameraStateRef.current = { panX: clampedPanX, panY: clampedPanY, zoom: zoomValue };
      const engine = cameraEngineRef.current;
      engine.current.panX = clampedPanX;
      engine.current.panY = clampedPanY;
      engine.current.zoom = zoomValue;
      engine.target.panX = clampedPanX;
      engine.target.panY = clampedPanY;
      engine.target.zoom = zoomValue;
    },
    [clampPanForZoom],
  );

  const setCameraTarget = useCallback(
    (panValueX: number, panValueY: number, zoomValue: number) => {
      const engine = cameraEngineRef.current;
      const { panX: clampedPanX, panY: clampedPanY } = clampPanForZoom(panValueX, panValueY, zoomValue);
      engine.target.panX = clampedPanX;
      engine.target.panY = clampedPanY;
      engine.target.zoom = zoomValue;
    },
    [clampPanForZoom],
  );

  useEffect(() => {
    if (!mapWidth || !mapHeight) return;
    const viewport = getViewportRect();
    if (!viewport) return;
    const centeredPanX = (viewport.width - mapWidth) / 2;
    const centeredPanY = (viewport.height - mapHeight) / 2;
    snapCameraNow(centeredPanX, centeredPanY, cameraEngineRef.current.current.zoom);
  }, [getViewportRect, mapHeight, mapWidth, snapCameraNow]);

  useEffect(() => {
    const engine = cameraEngineRef.current;
    const ZOOM_LERP = 0.2;
    const PAN_LERP = 0.2;

    const loop = () => {
      const zoomDelta = engine.target.zoom - engine.current.zoom;
      const nextZoom =
        Math.abs(zoomDelta) < 0.0005 ? engine.target.zoom : engine.current.zoom + zoomDelta * ZOOM_LERP;

      const { panX: clampedTargetPanX, panY: clampedTargetPanY } = clampPanForZoom(
        engine.target.panX,
        engine.target.panY,
        nextZoom,
      );

      const panXDelta = clampedTargetPanX - engine.current.panX;
      const nextPanX =
        Math.abs(panXDelta) < 0.1 ? clampedTargetPanX : engine.current.panX + panXDelta * PAN_LERP;

      const panYDelta = clampedTargetPanY - engine.current.panY;
      const nextPanY =
        Math.abs(panYDelta) < 0.1 ? clampedTargetPanY : engine.current.panY + panYDelta * PAN_LERP;

      engine.current.zoom = nextZoom;
      engine.current.panX = nextPanX;
      engine.current.panY = nextPanY;

      setZoom((prev) => (Math.abs(prev - nextZoom) < 0.0001 ? prev : nextZoom));
      setPanX((prev) => (Math.abs(prev - nextPanX) < 0.01 ? prev : nextPanX));
      setPanY((prev) => (Math.abs(prev - nextPanY) < 0.01 ? prev : nextPanY));

      cameraStateRef.current = {
        panX: nextPanX,
        panY: nextPanY,
        zoom: nextZoom,
      };

      engine.loopId = requestAnimationFrame(loop);
    };

    engine.loopId = requestAnimationFrame(loop);
    return () => {
      if (engine.loopId) {
        cancelAnimationFrame(engine.loopId);
        engine.loopId = null;
      }
    };
  }, [clampPanForZoom]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      setPings((prev) => prev.filter((ping) => ping.expiresAt > now));
    }, 250);
    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMeasureStart(null);
        setMeasureEnd(null);
        setMeasureMeters(null);
        setMeasurePreviewMeters(null);
        setMeasureArmed(false);
        return;
      }
      if (event.key === 'Tab') {
        const pointer = pointerWorldRef.current;
        if (pointer) {
          event.preventDefault();
          const pingId = createId('ping');
          addPing(pointer, pingId, userColor);
          lastRemotePingIdRef.current = pingId;
          void updateDoc(tableDocRef, {
            latestPing: {
              id: pingId,
              x: pointer.x,
              y: pointer.y,
              createdAt: serverTimestamp(),
              createdBy: user?.uid ?? null,
              color: userColor,
            },
          });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [addPing, tableDocRef, user?.uid, userColor]);

  const activeMeasurements = useMemo(() => {
    const list: Array<{
      start: { x: number; y: number } | null;
      end: { x: number; y: number } | null;
      meters: number | null;
      color?: string | null;
    }> = [];
    const hasLocal =
      measureStart !== null ||
      measureEnd !== null ||
      measureMeters !== null ||
      measurePreviewMeters !== null;
    const localMeasurement =
      hasLocal && measureStart
        ? {
            start: measureStart,
            end: measureEnd,
            meters: measureMeters ?? measurePreviewMeters,
            color: userColor,
          }
        : null;
    Object.entries(sharedMeasurements).forEach(([authorId, measurement]) => {
      if (!measurement || !isMeasurementPoint(measurement.start) || !isMeasurementPoint(measurement.end)) {
        return;
      }
      if (localMeasurement && authorId === measurementAuthorId) {
        return;
      }
      list.push({
        start: measurement.start,
        end: measurement.end,
        meters: measurement.meters ?? null,
        color: measurement.color ?? '#fcd34d',
      });
    });
    if (localMeasurement) {
      list.push(localMeasurement);
    }
    return list;
  }, [
    measureEnd,
    measureMeters,
    measurePreviewMeters,
    measureStart,
    measurementAuthorId,
    sharedMeasurements,
    userColor,
  ]);

  useEffect(() => {
    const unsubscribe = onSnapshot(tableDocRef, (snapshot) => {
      if (!snapshot.exists()) {
        void setDoc(tableDocRef, DEFAULT_DOC);
        setLoading(false);
        return;
      }
      const data = snapshot.data() as BoardDoc;
      setConfig({
        backgroundUrl: data.backgroundUrl ?? null,
        backgroundName: data.backgroundName ?? null,
        gridSize: data.gridSize ?? DEFAULT_CONFIG.gridSize,
        snapToGrid: typeof data.snapToGrid === 'boolean' ? data.snapToGrid : DEFAULT_CONFIG.snapToGrid,
        showCoordinates:
          typeof data.showCoordinates === 'boolean' ? data.showCoordinates : DEFAULT_CONFIG.showCoordinates,
        showGrid: typeof data.showGrid === 'boolean' ? data.showGrid : DEFAULT_CONFIG.showGrid,
      });
      const parsedTokens: Token[] = Array.isArray(data.tokens)
        ? (data.tokens as Token[]).map((token) => ({
            ...token,
            characterSheetId: typeof token.characterSheetId === 'string' ? token.characterSheetId : null,
            imageUrl: typeof token.imageUrl === 'string' ? token.imageUrl : null,
          }))
        : [];
      setTokens(parsedTokens);
      const measurementMap = (data as { measurements?: Record<string, BoardMeasurement | null> }).measurements;
      const parsedMeasurements: Record<string, BoardMeasurement> = {};
      if (measurementMap && typeof measurementMap === 'object') {
        for (const [authorId, rawMeasurement] of Object.entries(measurementMap)) {
          if (
            rawMeasurement &&
            typeof rawMeasurement === 'object' &&
            isMeasurementPoint(rawMeasurement.start) &&
            isMeasurementPoint(rawMeasurement.end)
          ) {
            parsedMeasurements[authorId] = {
              start: { x: rawMeasurement.start.x, y: rawMeasurement.start.y },
              end: { x: rawMeasurement.end.x, y: rawMeasurement.end.y },
              meters: typeof rawMeasurement.meters === 'number' ? rawMeasurement.meters : null,
              color: typeof rawMeasurement.color === 'string' ? rawMeasurement.color : '#fcd34d',
              authorId: typeof rawMeasurement.authorId === 'string' ? rawMeasurement.authorId : authorId,
            };
          }
        }
      }
      const legacyMeasurement = (data as { measurement?: BoardMeasurement | null }).measurement;
      if (
        legacyMeasurement &&
        typeof legacyMeasurement === 'object' &&
        isMeasurementPoint(legacyMeasurement.start) &&
        isMeasurementPoint(legacyMeasurement.end)
      ) {
        parsedMeasurements.legacy = parsedMeasurements.legacy ?? {
          start: { x: legacyMeasurement.start.x, y: legacyMeasurement.start.y },
          end: { x: legacyMeasurement.end.x, y: legacyMeasurement.end.y },
          meters: typeof legacyMeasurement.meters === 'number' ? legacyMeasurement.meters : null,
          color: typeof legacyMeasurement.color === 'string' ? legacyMeasurement.color : '#fcd34d',
          authorId: typeof legacyMeasurement.authorId === 'string' ? legacyMeasurement.authorId : 'legacy',
        };
      }
      setSharedMeasurements(parsedMeasurements);
      const updatedAt =
        data.updatedAt && typeof (data.updatedAt as Timestamp)?.toDate === 'function'
          ? (data.updatedAt as Timestamp).toDate()
          : null;
      setMeta({ updatedAt, updatedBy: data.updatedBy ?? null });
      const remotePing = (data as {
        latestPing?: { id?: string; x?: number; y?: number; color?: string };
      }).latestPing;
      if (
        remotePing &&
        typeof remotePing.id === 'string' &&
        typeof remotePing.x === 'number' &&
        typeof remotePing.y === 'number' &&
        remotePing.id !== lastRemotePingIdRef.current
      ) {
        lastRemotePingIdRef.current = remotePing.id;
        addPing(
          { x: remotePing.x, y: remotePing.y },
          remotePing.id,
          typeof remotePing.color === 'string' ? remotePing.color : '#f472b6',
        );
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [addPing, tableDocRef]);

  const persistPatch = useCallback(
    async (patch: Partial<BoardDoc>) => {
      try {
        await updateDoc(tableDocRef, {
          ...patch,
          updatedAt: serverTimestamp(),
          updatedBy: user?.uid ?? null,
        });
      } catch (error) {
        console.error('VTP: update failed, retrying with merge', error);
        await setDoc(tableDocRef, { ...patch, updatedAt: serverTimestamp(), updatedBy: user?.uid ?? null }, { merge: true });
      }
    },
    [tableDocRef, user?.uid],
  );

  useEffect(() => {
    const authorId = measurementAuthorId;
    const hasFinalMeasurement =
      measureStart !== null && measureEnd !== null && typeof measureMeters === 'number';
    if (hasFinalMeasurement) {
      const payload: BoardMeasurement = {
        start: measureStart,
        end: measureEnd,
        meters: measureMeters,
        color: userColor,
        authorId,
      };
      const signature = `${authorId}:${JSON.stringify(payload)}`;
      if (measurementBroadcastRef.current !== signature) {
        measurementBroadcastRef.current = signature;
        void updateDoc(tableDocRef, {
          [`measurements.${authorId}`]: payload,
          updatedAt: serverTimestamp(),
          updatedBy: user?.uid ?? null,
        });
      }
    } else if (measurementBroadcastRef.current) {
      measurementBroadcastRef.current = null;
      void updateDoc(tableDocRef, {
        [`measurements.${authorId}`]: deleteField(),
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid ?? null,
      });
    }
  }, [
    measureEnd,
    measureMeters,
    measureStart,
    measurementAuthorId,
    tableDocRef,
    user?.uid,
    userColor,
  ]);

  const userSheetId = user?.uid ?? null;

  const mutateTokens = useCallback(
    (mutator: (prev: Token[]) => Token[], persist = true) => {
      let result: Token[] = [];
      setTokens((prev) => {
        result = mutator(prev);
        return result;
      });
      if (persist) {
        void persistPatch({ tokens: result });
      }
    },
    [persistPatch],
  );

  const beginDrag = useCallback(
    (tokenId: string, event: PointerEvent<HTMLButtonElement>) => {
      if (!canEdit || !boardRef.current || event.button !== 0) return;
      const token = tokens.find((t) => t.id === tokenId);
      if (!token) return;
      const rect = getViewportRect();
      if (!rect) return;
      const { panX: cameraPanX, panY: cameraPanY, zoom: cameraZoom } = cameraStateRef.current;
      const worldPointerX = (event.clientX - rect.left - cameraPanX) / cameraZoom;
      const worldPointerY = (event.clientY - rect.top - cameraPanY) / cameraZoom;
      setDragState({
        tokenId,
        offsetX: worldPointerX - token.x,
        offsetY: worldPointerY - token.y,
      });
      event.currentTarget.setPointerCapture(event.pointerId);
      setFocusedTokenId(tokenId);
    },
    [canEdit, getViewportRect, tokens],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const rect = getViewportRect();
      if (!rect) return;

      const pointerWorld = getWorldPoint(event.clientX, event.clientY);
      if (pointerWorld) {
        pointerWorldRef.current = pointerWorld;
      }

      if (measureStart && measureMeters === null && pointerWorld) {
        setMeasureEnd(pointerWorld);
        if (config.gridSize > 0) {
          const dx = pointerWorld.x - measureStart.x;
          const dy = pointerWorld.y - measureStart.y;
          setMeasurePreviewMeters(Math.hypot(dx, dy) / config.gridSize);
        }
      }

      if (isPanning) {
        event.preventDefault();
        const engine = cameraEngineRef.current;
        const nextPanX = engine.current.panX + event.movementX;
        const nextPanY = engine.current.panY + event.movementY;
        const { panX: clampedPanX, panY: clampedPanY } = clampPanForZoom(
          nextPanX,
          nextPanY,
          engine.current.zoom,
        );
        engine.current.panX = clampedPanX;
        engine.current.panY = clampedPanY;
        engine.target.panX = clampedPanX;
        engine.target.panY = clampedPanY;
        setPanX(clampedPanX);
        setPanY(clampedPanY);
        cameraStateRef.current = { panX: clampedPanX, panY: clampedPanY, zoom: engine.current.zoom };
        return;
      }

      if (!dragState || !canEdit) return;
      const { panX: cameraPanX, panY: cameraPanY, zoom: cameraZoom } = cameraStateRef.current;
      const worldPointer = pointerWorld ?? {
        x: (event.clientX - rect.left - cameraPanX) / cameraZoom,
        y: (event.clientY - rect.top - cameraPanY) / cameraZoom,
      };
      let nextX = worldPointer.x - dragState.offsetX;
      let nextY = worldPointer.y - dragState.offsetY;
      if (config.snapToGrid && config.gridSize > 4) {
        const grid = config.gridSize;
        const halfGrid = grid / 2;
        nextX = (Math.floor(nextX / grid) * grid) + halfGrid;
        nextY = (Math.floor(nextY / grid) * grid) + halfGrid;
      }
      if (mapWidth && mapHeight) {
        nextX = clamp(nextX, 0, mapWidth);
        nextY = clamp(nextY, 0, mapHeight);
      }
      mutateTokens(
        (prev) => prev.map((token) => (token.id === dragState.tokenId ? { ...token, x: nextX, y: nextY } : token)),
        false,
      );
    },
    [
      clampPanForZoom,
      dragState,
      canEdit,
      config.gridSize,
      config.snapToGrid,
      mutateTokens,
      isPanning,
      mapHeight,
      mapWidth,
      getViewportRect,
      getWorldPoint,
      measureStart,
      measureMeters,
    ],
  );

  const handlePointerUp = useCallback(
    (event?: PointerEvent) => {
      if (isPanning) {
        setIsPanning(false);
        if (
          event?.currentTarget &&
          typeof event.currentTarget.releasePointerCapture === 'function' &&
          panPointerIdRef.current !== null
        ) {
          try {
            event.currentTarget.releasePointerCapture(panPointerIdRef.current);
          } catch {
            // ignore release errors
          }
        }
        panPointerIdRef.current = null;
      }

      if (!dragState) return;
      setDragState(null);
      setTokens((currentTokens) => {
        void persistPatch({ tokens: currentTokens });
        return currentTokens;
      });
    },
    [dragState, isPanning, persistPatch],
  );

  const handleBackgroundUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      if (!canEdit) return;
      const file = event.target.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const storagePath = `virtualTables/default/background-${Date.now()}-${file.name}`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file, { cacheControl: 'public,max-age=3600' });
        const url = await getDownloadURL(storageRef);
        await persistPatch({ backgroundUrl: url, backgroundName: file.name });
      } catch (error) {
        console.error('VTP: failed to upload background', error);
      } finally {
        setUploading(false);
        event.target.value = '';
      }
    },
    [canEdit, persistPatch],
  );

  const handleBackgroundReset = useCallback(() => {
    if (!canEdit) return;
    void persistPatch({ backgroundUrl: null, backgroundName: null });
  }, [canEdit, persistPatch]);

  const handleRoll = useCallback(
    (notation: string) => {
      const parts = notation.split('d');
      const count = Number.isFinite(parseInt(parts[0] || '1', 10)) ? Math.max(1, parseInt(parts[0] || '1', 10)) : 1;
      const dieType = Number.isFinite(parseInt(parts[1] || '20', 10)) ? Math.max(2, parseInt(parts[1] || '20', 10)) : 20;

      const isSingleRoll = count === 1;
      const newRollsForLog: RollResult[] = [];
      const newRollsForAnim: Array<{
        id: string;
        type: string;
        value: number;
        isSingleRoll: boolean;
        indexInGroup: number;
      }> = [];

      for (let i = 0; i < count; i += 1) {
        const finalValue = Math.floor(Math.random() * dieType) + 1;
        const rollId = createId('roll');

        newRollsForLog.push({
          id: rollId,
          notation,
          value: finalValue,
          timestamp: new Date(),
        });

        newRollsForAnim.push({
          id: rollId,
          type: `d${dieType}`,
          value: finalValue,
          isSingleRoll,
          indexInGroup: i,
        });
      }

      setRollHistory((prev) => [...newRollsForLog, ...prev].slice(0, 50));
      setActiveRolls((prev) => [...prev, ...newRollsForAnim]);
    },
    [],
  );

  const onAnimationComplete = useCallback((rollId: string) => {
    setActiveRolls((prev) => prev.filter((roll) => roll.id !== rollId));
  }, []);

  const handleStagePointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (event.button === 0 && (event.ctrlKey || measureArmed)) {
        event.preventDefault();
        const point = getWorldPoint(event.clientX, event.clientY);
        if (!point) return;
        pointerWorldRef.current = point;
        if (!measureStart || measureMeters !== null) {
          const snapped = snapToTokenCenter(point) ?? point;
          setMeasureStart(snapped);
          setMeasureEnd(null);
          setMeasureMeters(null);
          setMeasurePreviewMeters(null);
        } else {
          const snappedEnd = snapToTokenCenter(point) ?? point;
          setMeasureEnd(snappedEnd);
          if (config.gridSize > 0) {
            const dx = snappedEnd.x - measureStart.x;
            const dy = snappedEnd.y - measureStart.y;
            const meters = Math.hypot(dx, dy) / config.gridSize;
            setMeasureMeters(meters);
            setMeasurePreviewMeters(null);
          }
          setMeasureArmed(false);
        }
        return;
      }
      if (event.button !== 1) return;
      event.preventDefault();
      setIsPanning(true);
      panPointerIdRef.current = event.pointerId;
      if (typeof event.currentTarget.setPointerCapture === 'function') {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    },
    [config.gridSize, getWorldPoint, measureArmed, measureMeters, measureStart, snapToTokenCenter],
  );

  const setMapDimensions = useCallback((width: number, height: number) => {
    setMapWidth(width);
    setMapHeight(height);
  }, []);

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLElement>) => {
      event.preventDefault();
      const rect = getViewportRect();
      if (!rect) return;
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const { panX: currentPanX, panY: currentPanY, zoom: currentZoom } = cameraStateRef.current;
      const worldXBefore = (mouseX - currentPanX) / currentZoom;
      const worldYBefore = (mouseY - currentPanY) / currentZoom;
      const engine = cameraEngineRef.current;
      const newZoom = clamp(engine.target.zoom - event.deltaY * 0.001, 0.1, 5);
      const newPanX = mouseX - worldXBefore * newZoom;
      const newPanY = mouseY - worldYBefore * newZoom;
      setCameraTarget(newPanX, newPanY, newZoom);
    },
    [getViewportRect, setCameraTarget],
  );

  const handleRecenter = useCallback(() => {
    const viewport = getViewportRect();
    let desiredPanX = 0;
    let desiredPanY = 0;
    if (viewport && mapWidth && mapHeight) {
      desiredPanX = (viewport.width - mapWidth) / 2;
      desiredPanY = (viewport.height - mapHeight) / 2;
    }
    setCameraTarget(desiredPanX, desiredPanY, 1);
  }, [getViewportRect, mapHeight, mapWidth, setCameraTarget]);

  const activePings = useMemo(
    () => pings.map(({ id, x, y, color }) => ({ id, x, y, color })),
    [pings],
  );

  const contextValue = useMemo(
    () => ({
      config,
      tokens,
      meta,
      canEdit,
      loading,
      uploading,
      focusedTokenId,
      dragState,
      panX,
      panY,
      zoom,
      mapWidth,
      mapHeight,
      rollHistory,
      userColor,
      persistPatch,
      mutateTokens,
      setFocusedTokenId,
      beginDrag,
      handleBackgroundUpload,
      handleBackgroundReset,
      setMapDimensions,
      setOpenedSheetId,
      openedSheetId,
      handleRoll,
      setUserColor,
    }),
    [
      config,
      tokens,
      meta,
      canEdit,
      loading,
      uploading,
      focusedTokenId,
      dragState,
      panX,
      panY,
      zoom,
      mapWidth,
      mapHeight,
      rollHistory,
      userColor,
      persistPatch,
      mutateTokens,
      beginDrag,
      handleBackgroundUpload,
      handleBackgroundReset,
      setMapDimensions,
      setOpenedSheetId,
      openedSheetId,
      handleRoll,
      setUserColor,
    ],
  );

  // --- JSX ---
  return (
    <VirtualTableContext.Provider value={contextValue}>
      <div className="vt-page">
        {/* <VTPHeader /> */} {/* <-- УДАЛЕНО */}
        
        <main
          className={['vt-stage-container', isPanning ? 'is-panning' : '', !isSidebarOpen ? 'is-sidebar-expanded' : '']
            .filter(Boolean)
            .join(' ')}
          onPointerDown={handleStagePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
        >
          <VTBoard ref={boardRef} measurements={activeMeasurements} pings={activePings} />
        </main>

        <VTSidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen((prev) => !prev)} />
        <VTToolbar
          onRecenter={handleRecenter}
          onOpenDiceRoller={() => setIsDiceModalOpen(true)}
        />
        <VTChatLog />
        <Dice2DOverlay activeRolls={activeRolls} onAnimationComplete={onAnimationComplete} />
        <DiceRollerModal isOpen={isDiceModalOpen} onClose={() => setIsDiceModalOpen(false)} />
        <button
          type="button"
          className="vt-sheet-button"
          onClick={() => userSheetId && setFullSheetId(userSheetId)}
          aria-label="Открыть лист персонажа"
          disabled={!userSheetId}
        >
          <i className="fa-solid fa-scroll" aria-hidden />
        </button>
        <button
          type="button"
          className={measureArmed ? 'vt-measure-button is-active' : 'vt-measure-button'}
          onClick={() => {
            setMeasureArmed((prev) => !prev);
            setMeasureStart(null);
            setMeasureEnd(null);
            setMeasureMeters(null);
            setMeasurePreviewMeters(null);
          }}
          aria-pressed={measureArmed}
          aria-label="Линейка"
        >
          <i className="fa-solid fa-ruler" aria-hidden />
        </button>
        <div
          className={isColorDockOpen ? 'vt-color-dock is-open' : 'vt-color-dock'}
          aria-label="Выбор цвета маркеров"
        >
          <button
            type="button"
            className="vt-color-dock__toggle"
            onClick={() => setIsColorDockOpen((prev) => !prev)}
            aria-label={isColorDockOpen ? 'Скрыть выбор цвета' : 'Показать выбор цвета'}
          >
            <i className="fa-solid fa-palette" aria-hidden />
          </button>
          <div className="vt-color-dock__panel">
            <input
              type="color"
              value={userColor}
              onChange={(event) => setUserColor(event.target.value)}
              aria-label="Настроить цвет маркеров"
            />
            <div className="vt-color-dock__swatches">
              {PLAYER_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={color === userColor ? 'is-selected' : ''}
                  style={{ backgroundColor: color }}
                  onClick={() => setUserColor(color)}
                  aria-label={`Выбрать цвет ${color}`}
                />
              ))}
            </div>
          </div>
        </div>

        {loading && <div className="vt-loading">Подключаем общий стол…</div>}
        {openedSheetId && (
          <CharacterSheetDrawer sheetId={openedSheetId} onClose={() => setOpenedSheetId(null)} />
        )}
        {fullSheetId && (
          <div className="vt-sheet-overlay" role="dialog" aria-modal="true">
            <div className="vt-sheet-overlay__backdrop" onClick={() => setFullSheetId(null)} />
            <div className="vt-sheet-overlay__panel">
              <button
                type="button"
                className="vt-sheet-overlay__close"
                aria-label="Закрыть лист"
                onClick={() => setFullSheetId(null)}
              >
                <i className="fa-solid fa-xmark" aria-hidden />
              </button>
              <iframe
                title="Character sheet"
                src={`/character-sheet?uid=${encodeURIComponent(fullSheetId)}`}
                className="vt-sheet-overlay__frame"
              />
            </div>
          </div>
        )}
      </div>
    </VirtualTableContext.Provider>
  );
};

export default VirtualTablePage;

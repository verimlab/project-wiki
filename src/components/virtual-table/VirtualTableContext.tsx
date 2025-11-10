// src/components/virtual-table/VirtualTableContext.tsx
import React, { type PointerEvent } from 'react';
import { type Timestamp } from 'firebase/firestore';

// --- Типы (скопированы из старого файла) ---
export type TokenSize = 'sm' | 'md' | 'lg';

export type Token = {
  id: string;
  label: string;
  color: string;
  size: TokenSize;
  imageUrl: string | null;
  x: number; // world-space px
  y: number; // world-space px
  initiative: number | null;
  characterSheetId: string | null;
};

export type RollResult = {
  id: string;
  notation: string;
  value: number;
  timestamp: Date;
};

export type BoardConfig = {
  backgroundUrl: string | null;
  backgroundName: string | null;
  gridSize: number;
  snapToGrid: boolean;
  showCoordinates: boolean;
  showGrid: boolean;
};

type BoardMeasurementPoint = { x: number; y: number };

export type BoardMeasurement = {
  start: BoardMeasurementPoint | null;
  end: BoardMeasurementPoint | null;
  meters: number | null;
  color?: string | null;
  authorId?: string | null;
};

export type BoardDoc = BoardConfig & {
  tokens: Token[];
  updatedAt?: Timestamp | null;
  updatedBy?: string | null;
  measurement?: BoardMeasurement | null;
  latestPing?: {
    id: string;
    x: number;
    y: number;
    createdAt?: Timestamp | null;
    createdBy?: string | null;
    color?: string | null;
  };
};

export type DragState = {
  tokenId: string;
  offsetX: number;
  offsetY: number;
};

export type BoardMeta = {
  updatedAt: Date | null;
  updatedBy: string | null;
};

// --- Интерфейс Контекста ---

type VirtualTableContextState = {
  config: BoardConfig;
  tokens: Token[];
  meta: BoardMeta;
  canEdit: boolean;
  loading: boolean;
  uploading: boolean;
  focusedTokenId: string | null;
  dragState: DragState | null;
  panX: number;
  panY: number;
  zoom: number;
  mapWidth: number | null;
  mapHeight: number | null;
  openedSheetId: string | null;
  rollHistory: RollResult[];
  userColor: string;
};

type VirtualTableContextActions = {
  persistPatch: (patch: Partial<BoardDoc>) => Promise<void>;
  mutateTokens: (mutator: (prev: Token[]) => Token[], persist?: boolean) => void;
  setFocusedTokenId: (id: string | null) => void;
  beginDrag: (tokenId: string, event: PointerEvent<HTMLButtonElement>) => void;
  handleBackgroundUpload: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleBackgroundReset: () => void;
  setMapDimensions: (width: number, height: number) => void;
  setOpenedSheetId: (sheetId: string | null) => void;
  handleRoll: (notation: string) => void;
  setUserColor: (color: string) => void;
};

// --- Контекст ---

export const VirtualTableContext = React.createContext<
  (VirtualTableContextState & VirtualTableContextActions) | null
>(null);

// --- Хук для удобного доступа ---

export const useVirtualTable = () => {
  const context = React.useContext(VirtualTableContext);
  if (!context) {
    throw new Error('useVirtualTable должен использоваться внутри VirtualTablePage');
  }
  return context;
};

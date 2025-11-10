// src/components/virtual-table/VTSidebar.tsx
import React, { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualTable, type Token, type TokenSize } from './VirtualTableContext';
import { createId } from '../../utils/id'; // Убедись, что этот путь верный (e.g., ../../utils/id)
import './VTSidebar.css';
import { collection, getDocs } from 'firebase/firestore';
import { db, storage } from '../../firebase';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

// --- Константы (перенесены сюда) ---
const TOKEN_COLORS = ['#f8b4d9', '#c1fba4', '#9ad0ff', '#ffe194', '#fca5a5', '#c5b4ff', '#8de6d1'];
const SIZE_OPTIONS: Array<{ id: TokenSize; label: string }> = [
  { id: 'sm', label: 'Малый' },
  { id: 'md', label: 'Средний' },
  { id: 'lg', label: 'Крупный' },
];
const GRID_OPTIONS = [40, 56, 64, 80]; // <-- Перенесено из VTPHeader

// --- 1. Панель Фона ---
const VTBackgroundPanel: React.FC = () => {
  const { config, meta, canEdit, uploading, handleBackgroundUpload, handleBackgroundReset } =
    useVirtualTable();

  const lastUpdatedText = meta.updatedAt
    ? meta.updatedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : 'ещё нет данных';

  return (
    <section className="vt-panel-card">
      <header className="vt-panel-header">
        <div>
          <p className="vt-panel-eyebrow">фон сцены</p>
          <h2>Общий бэкграунд</h2>
        </div>
        <span className="vt-panel-pill">Обновлено {lastUpdatedText}</span>
      </header>
      <p className="vt-panel-note">
        Картинка хранится в Firebase Storage и автоматически открывается у всех игроков.
      </p>

      <label className={canEdit ? 'vt-upload' : 'vt-upload is-disabled'}>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleBackgroundUpload}
          disabled={!canEdit || uploading}
        />
        <i className="fa-solid fa-upload" aria-hidden />
        <span>{uploading ? 'Загрузка...' : 'Загрузить фон'}</span>
      </label>

      {config.backgroundUrl ? (
        <figure className="vt-backdrop-preview">
          <img src={config.backgroundUrl} alt="Фон сцены" />
          <figcaption>
            <span>{config.backgroundName ?? 'Файл без названия'}</span>
            {canEdit && (
              <button type="button" onClick={handleBackgroundReset} className="vt-link-button">
                Сбросить фон
              </button>
            )}
          </figcaption>
        </figure>
      ) : (
        <p className="vt-backdrop-empty">Фон не загружен — используется стандартный градиент.</p>
      )}
      {!canEdit && <p className="vt-muted">Только мастер может менять фон.</p>}
    </section>
  );
};

// --- 2. Панель Настроек (Новая!) ---
const VTSettingsPanel: React.FC = () => {
  const { config, canEdit, persistPatch } = useVirtualTable();

  // Локальные обработчики, которые вызывают глобальное действие
  const handleToggleCoordinates = (checked: boolean) => {
    if (!canEdit) return;
    void persistPatch({ showCoordinates: checked });
  };
  const handleToggleSnap = (checked: boolean) => {
    if (!canEdit) return;
    void persistPatch({ snapToGrid: checked });
  };
  const handleToggleGrid = (checked: boolean) => {
    if (!canEdit) return;
    void persistPatch({ showGrid: checked });
  };
  const handleGridSizeChange = (value: number) => {
    if (!canEdit) return;
    void persistPatch({ gridSize: value });
  };

  return (
    <section className="vt-panel-card">
      <header className="vt-panel-header">
        <div>
          <p className="vt-panel-eyebrow">настройки стола</p>
          <h2>Управление сценой</h2>
        </div>
      </header>
      <div className="vt-settings-controls">
        <label className="vt-toggle">
          <input
            type="checkbox"
            checked={config.showCoordinates}
            onChange={(event) => handleToggleCoordinates(event.target.checked)}
            disabled={!canEdit}
          />
          <span>Координаты</span>
        </label>
        <label className="vt-toggle">
          <input
            type="checkbox"
            checked={config.snapToGrid}
            onChange={(event) => handleToggleSnap(event.target.checked)}
            disabled={!canEdit}
          />
          <span>Привязка к сетке</span>
        </label>
        <label className="vt-toggle">
          <input
            type="checkbox"
            checked={config.showGrid}
            onChange={(event) => handleToggleGrid(event.target.checked)}
            disabled={!canEdit}
          />
          <span>Отображать сетку</span>
        </label>
        <label className="vt-select">
          <span>Размер клетки</span>
          <select
            value={config.gridSize}
            onChange={(event) => handleGridSizeChange(Number(event.target.value))}
            disabled={!canEdit}
          >
            {GRID_OPTIONS.map((size) => (
              <option value={size} key={size}>
                {size}px
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
};

// --- 3. Панель Фигурок ---
type CharacterSheetSummary = {
  id: string;
  name: string;
  color: string;
  size: TokenSize;
};

const VTTokensPanel: React.FC = () => {
  const { tokens, canEdit, focusedTokenId, mutateTokens, setFocusedTokenId, config, mapWidth, mapHeight } =
    useVirtualTable();

  // Эта панель хранит СВОЕ локальное состояние для формы
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenColor, setNewTokenColor] = useState(TOKEN_COLORS[0]);
  const [newTokenSize, setNewTokenSize] = useState<TokenSize>('md');
  const [newTokenImageFile, setNewTokenImageFile] = useState<File | null>(null);
  const [isTokenFormBusy, setIsTokenFormBusy] = useState(false);
  const [tokenImageUploadId, setTokenImageUploadId] = useState<string | null>(null);
  const tokenImageInputRef = useRef<HTMLInputElement | null>(null);
  const [allCharacters, setAllCharacters] = useState<CharacterSheetSummary[]>([]);
  const [selectedSheetId, setSelectedSheetId] = useState<string>('null');

  useEffect(() => {
    let active = true;
    const fetchCharacters = async () => {
      try {
        const snap = await getDocs(collection(db, 'characterSheets'));
        if (!active) return;
        const mapped: CharacterSheetSummary[] = snap.docs.map((docSnapshot) => {
          const data = docSnapshot.data() as Record<string, any>;
          const sheet = (data.sheet ?? {}) as Record<string, any>;
          const nameCandidate =
            typeof sheet.name === 'string' && sheet.name.trim().length
              ? sheet.name
              : typeof data.displayName === 'string' && data.displayName.trim().length
                ? data.displayName
                : 'Без имени';
          const colorCandidate =
            (typeof sheet.tokenColor === 'string' && sheet.tokenColor) ||
            (typeof sheet.color === 'string' && sheet.color) ||
            TOKEN_COLORS[0];
          const sizeCandidate = (sheet.tokenSize as TokenSize) ?? 'md';
          return {
            id: docSnapshot.id,
            name: nameCandidate,
            color: colorCandidate,
            size: sizeCandidate,
          };
        });
        setAllCharacters(mapped);
      } catch (error) {
        console.error('VTTokensPanel: failed to load character sheets', error);
      }
    };
    void fetchCharacters();
    return () => {
      active = false;
    };
  }, []);

  const uploadTokenImage = async (file: File, tokenId: string) => {
    const storagePath = `virtualTables/default/tokens/${tokenId}-${Date.now()}-${file.name}`;
    const imageRef = ref(storage, storagePath);
    await uploadBytes(imageRef, file, { cacheControl: 'public,max-age=86400' });
    return await getDownloadURL(imageRef);
  };

  const handleAddToken = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit || isTokenFormBusy) return;
    const isNpc = selectedSheetId === 'null';
    const trimmed = newTokenName.trim();
    if (isNpc && !trimmed) return;
    const character = isNpc ? null : allCharacters.find((char) => char.id === selectedSheetId);
    if (!isNpc && !character) {
      window.alert('Не удалось найти выбранного персонажа.');
      return;
    }
    const tokenId = createId('token');
    setIsTokenFormBusy(true);
    try {
      let uploadedImageUrl: string | null = null;
      if (newTokenImageFile) {
        uploadedImageUrl = await uploadTokenImage(newTokenImageFile, tokenId);
      }
      mutateTokens((prev) => {
        const spacing = Math.max(config.gridSize, 32);
        const column = prev.length % 6;
        const row = Math.floor(prev.length / 6);
        const padding = spacing * 2;
        let tokenX = padding + column * spacing;
        let tokenY = padding + row * spacing;
        if (mapWidth && mapHeight) {
          const clampValue = (value: number, min: number, max: number) =>
            Math.min(Math.max(value, min), max);
          tokenX = clampValue(tokenX, 0, mapWidth);
          tokenY = clampValue(tokenY, 0, mapHeight);
        }
        if (isNpc) {
          const token: Token = {
            id: tokenId,
            label: trimmed,
            color: newTokenColor,
            size: newTokenSize,
            imageUrl: uploadedImageUrl,
            x: tokenX,
            y: tokenY,
            initiative: null,
            characterSheetId: null,
          };
          return [...prev, token];
        }
        const token: Token = {
          id: tokenId,
          label: character!.name,
          color: character!.color,
          size: character!.size,
          imageUrl: uploadedImageUrl,
          x: tokenX,
          y: tokenY,
          initiative: null,
          characterSheetId: character!.id,
        };
        return [...prev, token];
      });
      setNewTokenName('');
      if (selectedSheetId === 'null') {
        setNewTokenColor(TOKEN_COLORS[0]);
        setNewTokenSize('md');
      }
      setNewTokenImageFile(null);
      if (tokenImageInputRef.current) {
        tokenImageInputRef.current.value = '';
      }
    } catch (error) {
      console.error('VTTokensPanel: failed to add token', error);
      window.alert('Не удалось сохранить фигурку. Проверьте соединение.');
    } finally {
      setIsTokenFormBusy(false);
    }
  };

  const handleRemoveToken = (tokenId: string) => {
    if (!canEdit) return;
    mutateTokens((prev) => prev.filter((token) => token.id !== tokenId));
    if (focusedTokenId === tokenId) {
      setFocusedTokenId(null);
    }
  };

  const handleInitiativeChange = (tokenId: string, next: number | null) => {
    if (!canEdit) return;
    mutateTokens((prev) =>
      prev.map((token) => (token.id === tokenId ? { ...token, initiative: next } : token)),
    );
  };

  const handleClearTokens = () => {
    if (!canEdit || tokens.length === 0) return;
    if (window.confirm('Очистить поле боя и удалить все фигурки?')) {
      mutateTokens(() => []);
      setFocusedTokenId(null);
    }
  };

  const handleTokenImageChange = async (tokenId: string, files: FileList | null) => {
    if (!canEdit || !files || files.length === 0) return;
    const file = files[0];
    setTokenImageUploadId(tokenId);
    try {
      const imageUrl = await uploadTokenImage(file, tokenId);
      mutateTokens((prev) =>
        prev.map((token) => (token.id === tokenId ? { ...token, imageUrl } : token)),
      );
    } catch (error) {
      console.error('VTTokensPanel: failed to upload token image', error);
      window.alert('Не удалось загрузить изображение токена.');
    } finally {
      setTokenImageUploadId((current) => (current === tokenId ? null : current));
    }
  };

  const handleTokenImageReset = (tokenId: string) => {
    if (!canEdit) return;
    mutateTokens((prev) =>
      prev.map((token) => (token.id === tokenId ? { ...token, imageUrl: null } : token)),
    );
  };

  const sortedTokens = useMemo(
    () => tokens.slice().sort((a, b) => (b.initiative ?? -999) - (a.initiative ?? -999)),
    [tokens],
  );

  return (
    <section className="vt-panel-card">
      <header className="vt-panel-header">
        <div>
          <p className="vt-panel-eyebrow">игроки</p>
          <h2>Фигурки и инициатива</h2>
        </div>
        {canEdit && (
          <button type="button" className="vt-link-button" onClick={handleClearTokens}>
            Очистить поле
          </button>
        )}
      </header>

      {/* --- Форма добавления --- */}
      <form className="vt-token-form" onSubmit={handleAddToken}>
        <label htmlFor="vt-token-character">Привязать персонажа</label>
        <select
          id="vt-token-character"
          value={selectedSheetId}
          onChange={(event) => setSelectedSheetId(event.target.value)}
          disabled={!canEdit}
        >
          <option value="null">-- Создать NPC вручную --</option>
          {allCharacters.map((char) => (
            <option key={char.id} value={char.id}>
              {char.name}
            </option>
          ))}
        </select>

        {selectedSheetId === 'null' && (
          <>
            <label htmlFor="vt-token-name">Имя</label>
            <input
              id="vt-token-name"
              type="text"
              placeholder="Кара'нокт, сквайр, NPC…"
              value={newTokenName}
              onChange={(event) => setNewTokenName(event.target.value)}
              disabled={!canEdit}
            />
            <label>Цвет и размер</label>
            <div className="vt-token-form-row">
              <div className="vt-color-row" role="listbox">
                {TOKEN_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={color === newTokenColor ? 'vt-color is-active' : 'vt-color'}
                    style={{ backgroundColor: color }}
                    onClick={() => canEdit && setNewTokenColor(color)}
                    disabled={!canEdit}
                  />
                ))}
              </div>
              <select
                value={newTokenSize}
                onChange={(event) => setNewTokenSize(event.target.value as TokenSize)}
                disabled={!canEdit}
              >
                {SIZE_OPTIONS.map((size) => (
                  <option key={size.id} value={size.id}>
                    {size.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
        <label className={canEdit ? 'vt-token-upload' : 'vt-token-upload is-disabled'}>
          <input
            ref={tokenImageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => setNewTokenImageFile(event.target.files?.[0] ?? null)}
            disabled={!canEdit}
          />
          <i className="fa-solid fa-image" aria-hidden />
          <div className="vt-token-upload__body">
            <strong>Изображение токена</strong>
            <span>{newTokenImageFile ? newTokenImageFile.name : 'PNG, JPEG или WebP до 5 МБ'}</span>
          </div>
        </label>
        <button type="submit" className="vt-primary-button" disabled={!canEdit || isTokenFormBusy}>
          {isTokenFormBusy ? 'Сохраняем...' : 'Добавить фигурку'}
        </button>
      </form>

      {/* --- Список Инициативы --- */}
      <div className="vt-initiative">
        {tokens.length === 0 && <p className="vt-initiative-empty">Список пуст.</p>}
        {sortedTokens.map((token) => (
          <article
            key={`panel-${token.id}`}
            className={token.id === focusedTokenId ? 'vt-init-row is-active' : 'vt-init-row'}
          >
            <button
              type="button"
              className="vt-init-chip"
              onClick={() => setFocusedTokenId(token.id)}
              style={{ borderColor: token.color }}
            >
              <span
                className={token.imageUrl ? 'vt-init-dot has-image' : 'vt-init-dot'}
                style={
                  token.imageUrl
                    ? { backgroundImage: `url(${token.imageUrl})` }
                    : { backgroundColor: token.color }
                }
              />
              <span className="vt-init-name">{token.label}</span>
            </button>
            <input
              type="number"
              className="vt-init-input"
              value={token.initiative ?? ''}
              placeholder="иниц."
              onChange={(event) => {
                const raw = event.target.value;
                handleInitiativeChange(token.id, raw === '' ? null : Number(raw));
              }}
              disabled={!canEdit}
            />
            {canEdit && (
              <div className="vt-init-actions">
                <label
                  className={
                    tokenImageUploadId === token.id
                      ? 'vt-icon-button vt-icon-button--file is-busy'
                      : 'vt-icon-button vt-icon-button--file'
                  }
                  aria-label={`Загрузить картинку для ${token.label}`}
                >
                  <i className="fa-solid fa-image" aria-hidden />
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => {
                      void handleTokenImageChange(token.id, event.target.files);
                      event.target.value = '';
                    }}
                    disabled={tokenImageUploadId === token.id}
                  />
                </label>
                {token.imageUrl && (
                  <button
                    type="button"
                    className="vt-icon-button"
                    onClick={() => handleTokenImageReset(token.id)}
                    aria-label={`Удалить картинку ${token.label}`}
                  >
                    <i className="fa-solid fa-circle-minus" aria-hidden />
                  </button>
                )}
                <button
                  type="button"
                  className="vt-icon-button"
                  onClick={() => handleRemoveToken(token.id)}
                  aria-label={`Удалить ${token.label}`}
                >
                  <i className="fa-solid fa-xmark" aria-hidden />
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
};

type VTSidebarProps = {
  isOpen: boolean;
  onToggle: () => void;
};

// --- 4. Главный компонент Сайдбара ---
export const VTSidebar: React.FC<VTSidebarProps> = ({ isOpen, onToggle }) => (
  <aside className={isOpen ? 'vt-sidebar' : 'vt-sidebar is-collapsed'}>
    <button
      type="button"
      className="vt-sidebar-toggle"
      onClick={onToggle}
      aria-label={isOpen ? 'Свернуть панель' : 'Развернуть панель'}
      aria-expanded={isOpen}
    >
      <i className={`fa-solid ${isOpen ? 'fa-chevron-right' : 'fa-chevron-left'}`} aria-hidden />
    </button>
    <div className="vt-sidebar-content" aria-hidden={!isOpen}>
      <VTSettingsPanel />
      <VTBackgroundPanel />
      <VTTokensPanel />
    </div>
  </aside>
);

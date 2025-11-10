// src/components/virtual-table/VTPHeader.tsx
import React from 'react';
import { useVirtualTable } from './VirtualTableContext';
import './VTPHeader.css';

const GRID_OPTIONS = [40, 56, 64, 80];

export const VTPHeader: React.FC = () => {
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
    <header className="vt-heading">
      <div>
        <p className="vt-eyebrow">живой стол</p>
        <h1>Виртуальный стол</h1>
        <p className="vt-lead">
          Все изменения автоматически синхронизируются через Firestore.
        </p>
      </div>
      <div className="vt-heading-controls">
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
    </header>
  );
};
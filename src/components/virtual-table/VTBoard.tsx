// src/components/virtual-table/VTBoard.tsx
import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import { useVirtualTable } from './VirtualTableContext';
import { VTToken } from './VTToken';
import './VTBoard.css';

const coordinateMarks = Array.from({ length: 9 }, (_, index) => (index + 1) * 10);
const DEFAULT_BACKDROP = 'linear-gradient(180deg, #010c1c, #021637)';
const FALLBACK_BOARD_SIZE = { width: 2048, height: 1152 };

type MeasurementData = {
  start: { x: number; y: number } | null;
  end: { x: number; y: number } | null;
  meters: number | null;
  color?: string | null;
};

type PingView = { id: string; x: number; y: number; color?: string | null };
type VTBoardProps = {
  measurements?: MeasurementData[];
  pings?: PingView[];
};

export const VTBoard = forwardRef<HTMLDivElement, VTBoardProps>(({ measurements = [], pings }, ref) => {
  const { config, tokens, canEdit, panX, panY, zoom, setMapDimensions } = useVirtualTable();
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!config.backgroundUrl) {
      setImageSize(null);
      setMapDimensions(FALLBACK_BOARD_SIZE.width, FALLBACK_BOARD_SIZE.height);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.src = config.backgroundUrl;
    img.onload = () => {
      if (cancelled) return;
      const size = { width: img.naturalWidth, height: img.naturalHeight };
      setImageSize(size);
      setMapDimensions(size.width, size.height);
    };
    img.onerror = () => {
      if (cancelled) return;
      setImageSize(null);
    };
    return () => {
      cancelled = true;
    };
  }, [config.backgroundUrl]);

  const boardWidth = imageSize?.width ?? FALLBACK_BOARD_SIZE.width;
  const boardHeight = imageSize?.height ?? FALLBACK_BOARD_SIZE.height;

  const boardStyle = useMemo(
    () =>
      ({
        '--vt-grid-size': `${config.gridSize}px`,
        width: `${boardWidth}px`,
        height: `${boardHeight}px`,
        transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
        transformOrigin: '0 0',
        backgroundImage: config.backgroundUrl
          ? `linear-gradient(rgba(2, 8, 20, 0.25), rgba(2, 8, 20, 0.25)), url(${config.backgroundUrl})`
          : DEFAULT_BACKDROP,
        backgroundRepeat: 'no-repeat',
        backgroundSize: config.backgroundUrl ? `${boardWidth}px ${boardHeight}px` : 'auto',
      }) as React.CSSProperties,
    [boardHeight, boardWidth, config.backgroundUrl, config.gridSize, panX, panY, zoom],
  );

  const boardClasses = [
    'vt-board',
    config.showCoordinates ? 'is-coords' : '',
    config.showGrid ? 'has-grid' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const measurementElements = useMemo(() => {
    if (!measurements || measurements.length === 0) return null;
    const labelBg = 'rgba(5, 12, 28, 0.85)';
    return measurements
      .map((measurement, index) => {
        if (!measurement?.start || !measurement?.end) return null;
        const dx = measurement.end.x - measurement.start.x;
        const dy = measurement.end.y - measurement.start.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 4) return null;
        const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
        const label = measurement.meters != null ? `${measurement.meters.toFixed(1)} м` : '';
        const color = measurement.color ?? '#fcd34d';
        return (
          <div
            key={`measure-${measurement.start.x}-${measurement.start.y}-${index}`}
            className="vt-measure"
            style={{
              left: `${measurement.start.x}px`,
              top: `${measurement.start.y}px`,
              width: `${distance}px`,
              transform: `rotate(${angleDeg}deg)`,
              background: color,
              boxShadow: `0 0 12px ${color}55`,
            }}
          >
            <span
              className="vt-measure__label"
              style={{
                transform: `rotate(${-angleDeg}deg)`,
                background: labelBg,
                borderColor: `${color}80`,
                color,
              }}
            >
              {label}
            </span>
          </div>
        );
      })
      .filter(Boolean);
  }, [measurements]);

  const pingElements = useMemo(() => {
    if (!pings || pings.length === 0) return null;
    return pings.map((ping) => {
      const color = ping.color ?? 'rgba(255, 99, 132, 1)';
      return (
        <div
          key={ping.id}
          className="vt-ping"
          style={{
            left: `${ping.x}px`,
            top: `${ping.y}px`,
            borderColor: color,
            boxShadow: `0 0 16px ${color}55`,
          }}
        />
      );
    });
  }, [pings]);

  return (
    <section className="vt-stage vt-stage--immersive">
      <div className="vt-board-wrapper">
        <div className={boardClasses} style={boardStyle} ref={ref}>
          {config.showCoordinates && (
            <>
              <ul className="vt-axis vt-axis-x">
                {coordinateMarks.map((mark) => (
                  <li key={`x-${mark}`} style={{ left: `${mark}%` }}>
                    {mark}
                  </li>
                ))}
              </ul>
              <ul className="vt-axis vt-axis-y">
                {coordinateMarks.map((mark) => (
                  <li key={`y-${mark}`} style={{ top: `${mark}%` }}>
                    {mark}
                  </li>
                ))}
              </ul>
            </>
          )}
          {tokens.length === 0 && (
            <div className="vt-empty">
              <i className="fa-solid fa-chess-knight" aria-hidden />
              <p>На карте пока нет фигур. {canEdit ? 'Добавьте их в панели.' : 'Ожидаем действия мастера.'}</p>
            </div>
          )}
          {tokens.map((token) => (
            <VTToken key={token.id} token={token} />
          ))}
          {measurementElements}
          {pingElements}
        </div>
      </div>
    </section>
  );
});

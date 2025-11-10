// src/components/virtual-table/VTToken.tsx
import React from 'react';
import { useVirtualTable, type Token } from './VirtualTableContext';
import './VTToken.css';

type VTTokenProps = {
  token: Token;
};

export const VTToken: React.FC<VTTokenProps> = ({ token }) => {
  const { focusedTokenId, canEdit, setFocusedTokenId, beginDrag, setOpenedSheetId } = useVirtualTable();

  const isActive = token.id === focusedTokenId;
  const symbol = token.label.slice(0, token.size === 'lg' ? 3 : 2).toUpperCase();
  const tokenClass = [
    'vt-token',
    `vt-token--${token.size}`,
    token.imageUrl ? 'has-image' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const tokenStyle: React.CSSProperties = token.imageUrl
    ? { backgroundColor: 'rgba(5, 12, 28, 0.92)', borderColor: 'rgba(255, 255, 255, 0.5)' }
    : { backgroundColor: token.color };

  return (
    <div
      className={isActive ? 'vt-token-wrapper is-active' : 'vt-token-wrapper'}
      style={{ left: `${token.x}px`, top: `${token.y}px` }}
    >
      <button
        type="button"
        className={tokenClass}
        style={tokenStyle}
        onPointerDown={(event) => beginDrag(token.id, event)}
        onClick={() => setFocusedTokenId(token.id)}
        onDoubleClick={() => {
          if (token.characterSheetId) {
            setOpenedSheetId(token.characterSheetId);
          }
        }}
        aria-label={`Фигура ${token.label}`}
        disabled={!canEdit}
      >
        {token.imageUrl && (
          <span className="vt-token-avatar" aria-hidden>
            <img src={token.imageUrl} alt="" loading="lazy" />
          </span>
        )}
        {!token.imageUrl && <span className="vt-token-symbol">{symbol}</span>}
        {typeof token.initiative === 'number' && (
          <span className="vt-token-initiative">{token.initiative}</span>
        )}
      </button>
      <span className="vt-token-caption">{token.label}</span>
    </div>
  );
};

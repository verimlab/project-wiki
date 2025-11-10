import React from 'react';
import './VTToolbar.css';

type VTToolbarProps = {
  onRecenter: () => void;
  onOpenDiceRoller: () => void;
};

export const VTToolbar: React.FC<VTToolbarProps> = ({ onRecenter, onOpenDiceRoller }) => {
  return (
    <div className="vt-toolbar">
      <button type="button" className="vt-tool-button" onClick={onOpenDiceRoller} aria-label="Бросить кубики">
        <i className="fa-solid fa-dice-d20" aria-hidden />
      </button>
      <button type="button" className="vt-tool-button" onClick={onRecenter} aria-label="Центрировать карту">
        <i className="fa-solid fa-crosshairs" aria-hidden />
      </button>
    </div>
  );
};

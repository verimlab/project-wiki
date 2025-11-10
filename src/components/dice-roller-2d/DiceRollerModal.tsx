import React, { useState } from 'react';
import { useVirtualTable } from '../virtual-table/VirtualTableContext';
import { createId } from '../../utils/id';
import './DiceRollerModal.css';

type RollPart = {
  id: string;
  count: number;
  die: number;
};

type DiceRollerModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const DIE_TYPES = [4, 6, 8, 10, 12, 20];

export const DiceRollerModal: React.FC<DiceRollerModalProps> = ({ isOpen, onClose }) => {
  const { handleRoll } = useVirtualTable();
  const [parts, setParts] = useState<RollPart[]>(() => [{ id: createId('roll-part'), count: 1, die: 20 }]);

  if (!isOpen) return null;

  const handlePartChange = (id: string, field: 'count' | 'die', value: number) => {
    const normalizedValue = Number.isNaN(value) ? (field === 'count' ? 1 : 20) : value;
    setParts((prev) =>
      prev.map((part) =>
        part.id === id
          ? {
              ...part,
              [field]:
                field === 'count'
                  ? Math.max(1, normalizedValue)
                  : DIE_TYPES.includes(normalizedValue) ? normalizedValue : 20,
            }
          : part,
      ),
    );
  };

  const handleAddPart = () => {
    setParts((prev) => [...prev, { id: createId('roll-part'), count: 1, die: 6 }]);
  };

  const handleRemovePart = (id: string) => {
    setParts((prev) => (prev.length > 1 ? prev.filter((part) => part.id !== id) : prev));
  };

  const handleSubmit = () => {
    parts.forEach((part) => {
      const count = Math.max(1, part.count);
      const die = DIE_TYPES.includes(part.die) ? part.die : 20;
      handleRoll(`${count}d${die}`);
    });
    onClose();
  };

  return (
    <div className="vt-dice-modal-overlay" onClick={onClose}>
      <div className="vt-dice-modal-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <header className="vt-dice-modal-header">
          <h3>Конструктор броска</h3>
          <button type="button" className="vt-dice-modal-close" onClick={onClose} aria-label="Закрыть">
            <i className="fa-solid fa-xmark" aria-hidden />
          </button>
        </header>
        <div className="vt-dice-modal-rows">
          {parts.map((part) => (
            <div key={part.id} className="vt-dice-modal-row">
              <input
                type="number"
                min={1}
                value={part.count}
                onChange={(event) => handlePartChange(part.id, 'count', parseInt(event.target.value, 10))}
              />
              <span>d</span>
              <select value={part.die} onChange={(event) => handlePartChange(part.id, 'die', parseInt(event.target.value, 10))}>
                {DIE_TYPES.map((die) => (
                  <option key={die} value={die}>
                    {die}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => handleRemovePart(part.id)} aria-label="Удалить группу">
                <i className="fa-solid fa-xmark" aria-hidden />
              </button>
            </div>
          ))}
        </div>
        <div className="vt-dice-modal-actions">
          <button type="button" onClick={handleAddPart} className="vt-dice-modal-secondary">
            + Добавить кубик
          </button>
          <button type="button" onClick={handleSubmit} className="vt-dice-modal-primary">
            Бросить
          </button>
        </div>
      </div>
    </div>
  );
};

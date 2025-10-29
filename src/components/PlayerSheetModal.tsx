import React from 'react';
import type { CharacterSheet } from '../types/sheet';
import { STAT_META } from '../constants';
import type { StatKey } from '../types/sheet';
interface PlayerSheetModalProps {
  sheet: CharacterSheet;
  onClose: () => void;
}

const PlayerSheetModal: React.FC<PlayerSheetModalProps> = ({ sheet, onClose }) => {
  const getStatValue = (statKey: StatKey) => {
    const statArray = sheet.stats?.[statKey];
    if (!Array.isArray(statArray)) return 0;
    return statArray.filter(Boolean).length;
  };

  const fmtPair = (current?: number, max?: number) => {
    const c = typeof current === 'number' ? current : 0;
    const m = typeof max === 'number' ? max : 0;
    if (typeof current !== 'number' && typeof max !== 'number') return '-';
    return `${c} / ${m || '?'}`;
  };

  const fmtNum = (val?: number) => (typeof val === 'number' && !Number.isNaN(val) ? String(val) : '-');
  const fmtText = (val?: string) => (val && String(val).trim().length ? String(val) : '-');

  return (
    <div className="sheet-modal-backdrop" onClick={onClose}>
      <div className="sheet-modal" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-modal-header">
          <div>
            <h2>{sheet.name || 'Безымянный'}</h2>
            <p>
              {sheet.race || 'Раса не указана'}, Уровень {sheet.charLevel || 1}
            </p>
          </div>
          <button className="sheet-modal-close" onClick={onClose} aria-label="Закрыть">
            <i className="fa-solid fa-xmark" />
          </button>
        </header>

        <div className="sheet-modal-body">
          <section>
            <h3><i className="fa-solid fa-heart-pulse" /> Ресурсы</h3>
            <div className="sheet-modal-stats">
              <div className="sheet-modal-stat"><span className="sheet-modal-stat__label">Опыт</span><span className="sheet-modal-stat__value">{fmtPair(sheet.expCurrent, sheet.expMax)}</span></div>
              <div className="sheet-modal-stat"><span className="sheet-modal-stat__label">Здоровье</span><span className="sheet-modal-stat__value">{fmtPair(sheet.healthCurrent, sheet.healthMax)}</span></div>
              <div className="sheet-modal-stat"><span className="sheet-modal-stat__label">Мана</span><span className="sheet-modal-stat__value">{fmtPair(sheet.manaCurrent, sheet.manaMax)}</span></div>
            </div>
          </section>

          <section>
            <h3><i className="fa-solid fa-person-running" /> Базовые</h3>
            <div className="sheet-modal-stats">
              <div className="sheet-modal-stat"><span className="sheet-modal-stat__label">Уровень</span><span className="sheet-modal-stat__value">{fmtNum(sheet.charLevel)}</span></div>
              <div className="sheet-modal-stat"><span className="sheet-modal-stat__label">Скорость</span><span className="sheet-modal-stat__value">{fmtNum(sheet.speed)}</span></div>
              <div className="sheet-modal-stat"><span className="sheet-modal-stat__label">Класс брони</span><span className="sheet-modal-stat__value">{fmtNum(sheet.ac)}</span></div>
              <div className="sheet-modal-stat"><span className="sheet-modal-stat__label">Тип</span><span className="sheet-modal-stat__value">{fmtText(sheet.type)}</span></div>
              <div className="sheet-modal-stat"><span className="sheet-modal-stat__label">Возраст</span><span className="sheet-modal-stat__value">{fmtText(sheet.age)}</span></div>
            </div>
          </section>

          <section>
            <h3><i className="fa-solid fa-star" /> Характеристики</h3>
            <div className="sheet-modal-stats">
              {STAT_META.map(({ key, label }) => (
                <div key={key} className="sheet-modal-stat">
                  <span className="sheet-modal-stat__label">{label}</span>
                  <span className="sheet-modal-stat__value">{getStatValue(key)}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3><i className="fa-solid fa-scroll" /> Навыки</h3>
            {sheet.skills && sheet.skills.length > 0 ? (
              <ul className="sheet-modal-list">
                {sheet.skills.map((skill, index) => (
                  <li key={index}>{skill.name}</li>
                ))}
              </ul>
            ) : (
              <p>Навыки не указаны.</p>
            )}
          </section>

          <section>
            <h3><i className="fa-solid fa-backpack" /> Инвентарь</h3>
            {sheet.inventory && sheet.inventory.length > 0 ? (
              <ul className="sheet-modal-list">
                {sheet.inventory.map((item) => (
                  <li key={item.id}>
                    {item.name} {item.quantity > 1 ? `(x${item.quantity})` : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Инвентарь пуст.</p>
            )}
          </section>

          {sheet.notes && (
            <section>
              <h3><i className="fa-solid fa-note-sticky" /> Заметки</h3>
              <p className="sheet-modal-notes">{sheet.notes}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayerSheetModal;

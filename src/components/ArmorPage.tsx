import React, { useMemo, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import './ArmorPage.css';

export type Armor = {
  id: string;
  name: string;
  ac: string; // e.g., "11 + Ловк.", "16"
  category: 'Лёгкий' | 'Средний' | 'Тяжёлый' | 'Щиты';
  properties?: string[]; // e.g., "помеха скрытности", "требуется Сила 15"
  description?: string;
};

export const ARMOR: Armor[] = [
  // Лёгкие
  { id: 'padded', name: 'Стёганый', ac: '11 + Ловк.', category: 'Лёгкий', properties: ['помеха скрытности'], description: 'Мягкая подбитая броня. Комфортная, но плохо скрывает шум.' },
  { id: 'leather', name: 'Кожаный', ac: '11 + Ловк.', category: 'Лёгкий', description: 'Гибкая защита из обработанной кожи. Не мешает скрытности.' },
  { id: 'studded-leather', name: 'Кожаный, проклёпанный', ac: '12 + Ловк.', category: 'Лёгкий', description: 'Кожа, усиленная металлическими заклёпками для лучшей защиты.' },

  // Средние
  { id: 'hide', name: 'Шкуры', ac: '12 + Ловк. (макс. +2)', category: 'Средний', description: 'Необработанные шкуры. Простая и доступная защита.' },
  { id: 'chain-shirt', name: 'Кольчужная рубаха', ac: '13 + Ловк. (макс. +2)', category: 'Средний', description: 'Скрываемая под одеждой кольчужная защита корпуса.' },
  { id: 'scale-mail', name: 'Чешуйчатый', ac: '14 + Ловк. (макс. +2)', category: 'Средний', properties: ['помеха скрытности'], description: 'Металлические чешуйки на кожаной основе; шумит при движении.' },
  { id: 'breastplate', name: 'Кираса', ac: '14 + Ловк. (макс. +2)', category: 'Средний', description: 'Твёрдая нагрудная плита, оставляющая подвижность.' },
  { id: 'half-plate', name: 'Полулаты', ac: '15 + Ловк. (макс. +2)', category: 'Средний', properties: ['помеха скрытности'], description: 'Частичное латное покрытие: хорошая защита, но шумная.' },

  // Тяжёлые
  { id: 'ring-mail', name: 'Клёпаная', ac: '14', category: 'Тяжёлый', properties: ['помеха скрытности'], description: 'Кольца на подкладке. Бюджетная тяжёлая броня.' },
  { id: 'chain-mail', name: 'Кольчуга', ac: '16', category: 'Тяжёлый', properties: ['требуется Сила 13', 'помеха скрытности'], description: 'Полная кольчужная защита, требующая физической подготовки.' },
  { id: 'splint', name: 'Пластинчатая', ac: '17', category: 'Тяжёлый', properties: ['требуется Сила 15', 'помеха скрытности'], description: 'Жёсткие пластины на ткани; высокая защита.' },
  { id: 'plate', name: 'Латы', ac: '18', category: 'Тяжёлый', properties: ['требуется Сила 15', 'помеха скрытности'], description: 'Полный латный доспех, высшая степень защиты.' },

  // Щиты
  { id: 'shield', name: 'Щит', ac: '+2 к КД', category: 'Щиты', description: 'Добавляет +2 к КД при использовании.' },
];

const groupBy = (list: Armor[]) => {
  const order: Record<Armor['category'], number> = { 'Лёгкий': 0, 'Средний': 1, 'Тяжёлый': 2, 'Щиты': 3 };
  const map = new Map<Armor['category'], Armor[]>();
  for (const a of list) {
    if (!map.has(a.category)) map.set(a.category, []);
    map.get(a.category)!.push(a);
  }
  return Array.from(map.entries())
    .sort((a, b) => order[a[0]] - order[b[0]])
    .map(([category, items]) => ({ category, items }));
};

const ArmorPage: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const groups = useMemo(() => groupBy(ARMOR), []);
  const selected = useMemo(() => ARMOR.find((a) => a.id === selectedId) || null, [selectedId]);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (selectedId) return;
    const target = searchParams.get('id');
    if (target && ARMOR.some((a) => a.id === target)) {
      setSelectedId(target);
    }
  }, [selectedId, searchParams]);

  return (
    <div className="ap-root">
      <header className="ap-header">
        <Link to="/" className="ap-back"><i className="fa-solid fa-arrow-left" /> На главную</Link>
        <div>
          <h1>Броня</h1>
          <p className="ap-sub">Каталог брони. Выберите элемент слева, чтобы увидеть характеристики.</p>
        </div>
      </header>

      <div className="ap-layout">
        <aside className="ap-list" aria-label="Список брони">
          {groups.map(({ category, items }) => (
            <section key={category} className="ap-group">
              <h3 className="ap-group-title">{category}</h3>
              <ul className="ap-items">
                {items.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      className={`ap-item ${selectedId === a.id ? 'is-active' : ''}`}
                      onClick={() => setSelectedId(a.id)}
                    >
                      <span className="ap-item-icon"><i className="fa-solid fa-shield-halved" /></span>
                      <span className="ap-item-main">
                        <span className="ap-item-name">{a.name}</span>
                        <span className="ap-item-meta">{a.ac}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </aside>

        <section className="ap-details" aria-live="polite">
          {!selected && (
            <div className="ap-details-empty">
              <i className="fa-solid fa-wand-magic-sparkles" />
              <p>Выберите броню слева, чтобы увидеть её характеристики.</p>
            </div>
          )}
          {selected && (
            <div className="ap-details-card">
              <header className="ap-details-header">
                <h2>{selected.name}</h2>
                <span className="ap-chip">{selected.category}</span>
              </header>

              <section className="ap-block">
                <h4 className="ap-block-title">Класс Доспеха</h4>
                <div className="ap-block-body"><strong className="ap-ac">{selected.ac}</strong></div>
              </section>

              <section className="ap-block">
                <h4 className="ap-block-title">Свойства</h4>
                <div className="ap-block-body">
                  {selected.properties && selected.properties.length > 0 ? (
                    <span className="ap-props">{selected.properties.join(', ')}</span>
                  ) : (
                    <span className="ap-props">—</span>
                  )}
                </div>
              </section>

              <section className="ap-block">
                <h4 className="ap-block-title">Описание</h4>
                <div className="ap-block-body"><p className="ap-desc">{selected.description || '—'}</p></div>
              </section>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ArmorPage;

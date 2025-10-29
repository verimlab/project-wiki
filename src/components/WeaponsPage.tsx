import React, { useMemo, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import './WeaponsPage.css';

export type Weapon = {
  id: string;
  name: string;
  damage?: string;
  type?: string; // рубя, колю, дробя etc.
  group?: string; // e.g., Клинки, Древковое, Дальнобойное, Прочее
  properties?: string[]; // e.g., финт, лёгкое, двуручное, метательное (6/18м)
  description?: string;
};

export const WEAPONS: Weapon[] = [
  { id: 'sword', name: 'Меч', damage: '1d6', type: 'руба', group: 'Клинки', properties: ['одноручное'], description: 'Классическое оружие ближнего боя. Баланс между скоростью и уроном.' },
  { id: 'short-sword', name: 'Короткий меч', damage: '1d6', type: 'колю', group: 'Клинки', properties: ['финт', 'лёгкое'], description: 'Компактный клинок для манёвренного боя и дуэлей.' },
  { id: 'long-sword', name: 'Длинный меч', damage: '1d8', type: 'руба', group: 'Клинки', properties: ['универсальное'], description: 'Универсальный клинок — может применяться в одной или двух руках.' },
  { id: 'rapier', name: 'Рапира', damage: '1d8', type: 'колю', group: 'Клинки', properties: ['финт'], description: 'Узкий клинок для точных колющих ударов.' },
  { id: 'sabre', name: 'Сабля', damage: '1d6', type: 'руба', group: 'Клинки', properties: ['финт', 'лёгкое'], description: 'Изогнутый клинок, эффективен в рубящих атаках.' },
  { id: 'greatsword', name: 'Двуручный меч', damage: '2d6', type: 'руба', group: 'Клинки', properties: ['двуручное', 'тяжёлое'], description: 'Массивный клинок для мощных ударов двумя руками.' },
  { id: 'dagger', name: 'Кинжал', damage: '1d4', type: 'колю', group: 'Клинки', properties: ['финт', 'лёгкое', 'метательное (6/18м)'], description: 'Маленький, но смертоносный клинок. Удобен для скрытного и метательного боя.' },
  { id: 'knife', name: 'Нож', damage: '1d4', type: 'колю', group: 'Клинки', properties: ['лёгкое', 'метательное (6/18м)'], description: 'Бытовой нож, который нередко используется как оружие.' },

  { id: 'spear', name: 'Копьё', damage: '1d6', type: 'колю', group: 'Древковое', properties: ['универсальное', 'метательное (6/18м)'], description: 'Древковое оружие с хорошей дистанцией укола и возможностью броска.' },
  { id: 'javelin', name: 'Метательное копьё', damage: '1d6', type: 'колю', group: 'Древковое', properties: ['метательное (9/27м)'], description: 'Облегчённое копьё, предназначенное для бросков.' },
  { id: 'pike', name: 'Пика', damage: '1d10', type: 'колю', group: 'Древковое', properties: ['двуручное', 'длинное'], description: 'Очень длинное копьё, удерживает врагов на расстоянии.' },
  { id: 'halberd', name: 'Алебарда', damage: '1d10', type: 'руба', group: 'Древковое', properties: ['двуручное', 'тяжёлое', 'длинное'], description: 'Комбинация копья и секиры для разнообразных приёмов.' },

  { id: 'axe', name: 'Топор', damage: '1d6', type: 'руба', group: 'Дробящее/Рубящее', properties: ['одноручное'], description: 'Компактный рубящий инструмент и оружие.' },
  { id: 'battle-axe', name: 'Боевой топор', damage: '1d8', type: 'руба', group: 'Дробящее/Рубящее', properties: ['универсальное'], description: 'Усиленная версия топора, эффективная в бою.' },
  { id: 'sekyra', name: 'Секира', damage: '1d12', type: 'руба', group: 'Дробящее/Рубящее', properties: ['двуручное', 'тяжёлое'], description: 'Тяжёлая секира наносит разрушительные удары.' },
  { id: 'mace', name: 'Булава', damage: '1d6', type: 'дробя', group: 'Дробящее/Рубящее', properties: ['одноручное'], description: 'Дробящее оружие против брони и костей.' },
  { id: 'warhammer', name: 'Боевой молот', damage: '1d8', type: 'дробя', group: 'Дробящее/Рубящее', properties: ['универсальное'], description: 'Массивная голова молота пробивает защиту противника.' },
  { id: 'hammer', name: 'Молоток', damage: '1d4', type: 'дробя', group: 'Дробящее/Рубящее', properties: ['лёгкое'], description: 'Небольшой инструмент, который годится и как оружие.' },
  { id: 'staff', name: 'Посох', damage: '1d6', type: 'дробя', group: 'Дробящее/Рубящее', properties: ['двуручное', 'длинное'], description: 'Деревянный шест — опора мага и грозное оружие.' },
  { id: 'sickle', name: 'Серп', damage: '1d4', type: 'руба', group: 'Дробящее/Рубящее', properties: ['финт', 'лёгкое'], description: 'Изогнутое лезвие, удобное для цепляющих ударов.' },
  { id: 'scythe', name: 'Коса', damage: '2d4', type: 'руба', group: 'Дробящее/Рубящее', properties: ['двуручное', 'тяжёлое'], description: 'Длинное лезвие на древке, требующее опыта в обращении.' },

  { id: 'longbow', name: 'Лук длинный', damage: '1d8', type: 'колю', group: 'Дальнобойное', properties: ['двуручное', 'дальность (45/180м)'], description: 'Мощный дальнобойный лук для выстрелов на большие дистанции.' },
  { id: 'shortbow', name: 'Лук короткий', damage: '1d6', type: 'колю', group: 'Дальнобойное', properties: ['двуручное', 'дальность (24/96м)'], description: 'Компактный лук, удобный в тесных местах.' },
  { id: 'crossbow', name: 'Арбалет', damage: '1d8', type: 'колю', group: 'Дальнобойное', properties: ['двуручное', 'перезарядка'], description: 'Стреляет болтами с высокой пробивной силой.' },
  { id: 'hand-crossbow', name: 'Арбалет ручной', damage: '1d6', type: 'колю', group: 'Дальнобойное', properties: ['одноручное', 'перезарядка'], description: 'Компактный арбалет одной руки для быстрых выстрелов.' },
  { id: 'sling', name: 'Праща', damage: '1d4', type: 'дробя', group: 'Дальнобойное', properties: ['дальность (9/36м)'], description: 'Простое, но эффективное метательное оружие.' },
  { id: 'dart', name: 'Дротик', damage: '1d4', type: 'колю', group: 'Дальнобойное', properties: ['метательное (6/18м)'], description: 'Лёгкое копьё для метания на короткую дистанцию.' },

  { id: 'shield', name: 'Щит', damage: '1d4', type: 'дробя', group: 'Прочее', properties: ['импровизированное'], description: 'Средство защиты, которое при необходимости можно использовать для удара.' },
  { id: 'smallsword', name: 'Шпага', damage: '1d6', type: 'колю', group: 'Клинки', properties: ['финт', 'лёгкое'], description: 'Тонкий колющий клинок, рассчитанный на точность и скорость.' },
  { id: 'whip', name: 'Кнут', damage: '1d4', type: 'руб/реж', group: 'Прочее', properties: ['длинное', 'финт'], description: 'Гибкое оружие с увеличенной дистанцией удара.' },
];

const groupBy = (list: Weapon[]) => {
  const map = new Map<string, Weapon[]>();
  for (const w of list) {
    const key = w.group || 'Прочее';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(w);
  }
  return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
};

const WeaponsPage: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const groups = useMemo(() => groupBy(WEAPONS), []);
  const selected = useMemo(() => WEAPONS.find((w) => w.id === selectedId) || null, [selectedId]);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (selectedId) return;
    const target = searchParams.get('id');
    if (target && WEAPONS.some((w) => w.id === target)) {
      setSelectedId(target);
    }
  }, [selectedId, searchParams]);

  return (
    <div className="wp-root">
      <header className="wp-header">
        <Link to="/" className="wp-back"><i className="fa-solid fa-arrow-left" /> На главную</Link>
        <div>
          <h1>Оружие</h1>
          <p className="wp-sub">Каталог вооружения. Выберите предмет из списка, чтобы увидеть его характеристики.</p>
        </div>
      </header>

      <div className="wp-layout">
        <aside className="wp-list" aria-label="Список оружия">
          {groups.map(({ group, items }) => (
            <section key={group} className="wp-group">
              <h3 className="wp-group-title">{group}</h3>
              <ul className="wp-items">
                {items.map((w) => (
                  <li key={w.id}>
                    <button
                      type="button"
                      className={`wp-item ${selectedId === w.id ? 'is-active' : ''}`}
                      onClick={() => setSelectedId(w.id)}
                    >
                      <span className="wp-item-icon"><i className="fa-solid fa-feather" /></span>
                      <span className="wp-item-main">
                        <span className="wp-item-name">{w.name}</span>
                        {(w.damage || w.type) && (
                          <span className="wp-item-meta">{w.damage || ''} {w.type || ''}</span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </aside>

        <section className="wp-details" aria-live="polite">
          {!selected && (
            <div className="wp-details-empty">
              <i className="fa-solid fa-wand-magic-sparkles" />
              <p>Выберите оружие из списка слева, чтобы увидеть его характеристики.</p>
            </div>
          )}
          {selected && (
            <div className="wp-details-card">
              <header className="wp-details-header">
                <h2>{selected.name}</h2>
                <span className="wp-chip">{selected.group || 'Прочее'}</span>
              </header>
              <section className="wp-block">
                <h4 className="wp-block-title">Урон</h4>
                <div className="wp-block-body"><strong className="wp-damage">{selected.damage || '—'}</strong><span className="wp-type">{selected.type ? `\u00A0 ${selected.type}` : ''}</span></div>
              </section>
              <section className="wp-block">
                <h4 className="wp-block-title">Свойства</h4>
                <div className="wp-block-body">
                  {selected.properties && selected.properties.length > 0 ? (
                    <span className="wp-props">{selected.properties.join(', ')}</span>
                  ) : (
                    <span className="wp-props">—</span>
                  )}
                </div>
              </section>
              <section className="wp-block">
                <h4 className="wp-block-title">Описание</h4>
                <div className="wp-block-body"><p className="wp-desc">{selected.description || '—'}</p></div>
              </section>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default WeaponsPage;

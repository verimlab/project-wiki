import React, { useMemo, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ARMOR, WEAPONS, type Armor, type Weapon } from '../data/equipment';
import './EquipmentPage.css';
import './WeaponsPage.css'; // Re-use styles
import './ArmorPage.css';   // Re-use styles

type Item = (Armor & { itemType: 'armor' }) | (Weapon & { itemType: 'weapon' });

const groupWeapons = (list: Weapon[]) => {
  const map = new Map<string, Weapon[]>();
  for (const w of list) {
    const key = w.group || 'Прочее';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(w);
  }
  return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
};

const groupArmor = (list: Armor[]) => {
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

const ALL_ITEMS: Item[] = [
  ...WEAPONS.map(w => ({ ...w, itemType: 'weapon' as const })),
  ...ARMOR.map(a => ({ ...a, itemType: 'armor' as const }))
];

const EquipmentPage: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const weaponGroups = useMemo(() => groupWeapons(WEAPONS), []);
  const armorGroups = useMemo(() => groupArmor(ARMOR), []);
  const selectedItem = useMemo(() => ALL_ITEMS.find((item) => item.id === selectedId) || null, [selectedId]);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (selectedId) return;
    const targetId = searchParams.get('id');
    if (targetId && ALL_ITEMS.some((item) => item.id === targetId)) {
      setSelectedId(targetId);
    }
  }, [selectedId, searchParams]);

  return (
    <div className="eq-root">
      <header className="eq-header">
        <Link to="/" className="eq-back"><i className="fa-solid fa-arrow-left" /> На главную</Link>
        <div>
          <h1>Снаряжение</h1>
          <p className="eq-sub">Каталог оружия и брони. Выберите предмет для просмотра характеристик.</p>
        </div>
      </header>

      <div className="eq-layout">
        {/* Weapons List */}
        <aside className="eq-list" aria-label="Список оружия">
          {weaponGroups.map(({ group, items }) => (
            <section key={group} className="eq-group">
              <h3 className="eq-group-title">{group}</h3>
              <ul className="eq-items">
                {items.map((w) => (
                  <li key={w.id}>
                    <button
                      type="button"
                      className={`eq-item ${selectedId === w.id ? 'is-active' : ''}`}
                      onClick={() => setSelectedId(w.id)}
                    >
                      <span className="eq-item-icon"><i className="fa-solid fa-khanda" /></span>
                      <span className="eq-item-main">
                        <span className="eq-item-name">{w.name}</span>
                        {(w.damage || w.type) && (
                          <span className="eq-item-meta">{w.damage || ''} {w.type || ''}</span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </aside>

        {/* Details View */}
        <section className="wp-details ap-details" aria-live="polite">
          {!selectedItem && (
            <div className="wp-details-empty ap-details-empty">
              <i className="fa-solid fa-wand-magic-sparkles" />
              <p>Выберите предмет из списков, чтобы увидеть его характеристики.</p>
            </div>
          )}
          {selectedItem?.itemType === 'weapon' && (
            <div className="wp-details-card">
              <header className="wp-details-header">
                <h2>{selectedItem.name}</h2>
                <span className="wp-chip">{selectedItem.group || 'Прочее'}</span>
              </header>
              <section className="wp-block">
                <h4 className="wp-block-title">Урон</h4>
                <div className="wp-block-body"><strong className="wp-damage">{selectedItem.damage || '—'}</strong><span className="wp-type">{selectedItem.type ? `\u00A0 ${selectedItem.type}` : ''}</span></div>
              </section>
              <section className="wp-block">
                <h4 className="wp-block-title">Свойства</h4>
                <div className="wp-block-body"><span className="wp-props">{selectedItem.properties?.join(', ') || '—'}</span></div>
              </section>
              <section className="wp-block">
                <h4 className="wp-block-title">Описание</h4>
                <div className="wp-block-body"><p className="wp-desc">{selectedItem.description || '—'}</p></div>
              </section>
            </div>
          )}
          {selectedItem?.itemType === 'armor' && (
             <div className="ap-details-card">
              <header className="ap-details-header">
                <h2>{selectedItem.name}</h2>
                <span className="ap-chip">{selectedItem.category}</span>
              </header>
              <section className="ap-block">
                <h4 className="ap-block-title">Класс Доспеха</h4>
                <div className="ap-block-body"><strong className="ap-ac">{selectedItem.ac}</strong></div>
              </section>
              <section className="ap-block">
                <h4 className="ap-block-title">Свойства</h4>
                <div className="ap-block-body"><span className="ap-props">{selectedItem.properties?.join(', ') || '—'}</span></div>
              </section>
              <section className="ap-block">
                <h4 className="ap-block-title">Описание</h4>
                <div className="ap-block-body"><p className="ap-desc">{selectedItem.description || '—'}</p></div>
              </section>
            </div>
          )}
        </section>

        {/* Armor List */}
        <aside className="eq-list" aria-label="Список брони">
          {armorGroups.map(({ category, items }) => (
            <section key={category} className="eq-group">
              <h3 className="eq-group-title">{category}</h3>
              <ul className="eq-items">
                {items.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      className={`eq-item ${selectedId === a.id ? 'is-active' : ''}`}
                      onClick={() => setSelectedId(a.id)}
                    >
                      <span className="eq-item-icon"><i className="fa-solid fa-shield-halved" /></span>
                      <span className="eq-item-main">
                        <span className="eq-item-name">{a.name}</span>
                        <span className="eq-item-meta">{a.ac}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </aside>
      </div>
    </div>
  );
};

export default EquipmentPage;
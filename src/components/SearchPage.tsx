import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLoreArticles } from '../hooks/useLoreArticles';
import { buildDefaultArticles } from '../data/loreDefaults';
import { SECTION_BY_ID, SECTION_IDS } from '../constants/loreSections';
import type { ArticlesMap, SectionId } from '../types/lore';
import { WEAPONS } from './WeaponsPage';
import type { Weapon } from './WeaponsPage';
import { ARMOR } from './ArmorPage';
import type { Armor } from './ArmorPage';
import './SearchPage.css';

type ResultKind = 'lore' | 'weapon' | 'armor';

type SearchItem = {
  id: string;
  kind: ResultKind;
  title: string;
  text: string;
  url: string;
  sectionId?: SectionId;
  badge?: string;
};

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    // remove combining marks without requiring Unicode property escapes
    .replace(/[\u0300-\u036f]+/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const useIndex = (articles: ArticlesMap) => {
  return useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = [];
    for (const sectionId of SECTION_IDS as SectionId[]) {
      const sectionMeta = SECTION_BY_ID[sectionId];
      const list = articles[sectionId] ?? [];
      for (const a of list) {
        items.push({
          id: `lore:${sectionId}:${a.id}`,
          kind: 'lore',
          title: a.title,
          text: normalize([a.summary, a.tags?.join(' '), a.content].filter(Boolean).join(' \n ')),
          url: `/lore/${sectionId}?article=${a.id}`,
          sectionId,
          badge: sectionMeta?.label,
        });
      }
    }
    for (const w of WEAPONS as Weapon[]) {
      items.push({
        id: `weapon:${w.id}`,
        kind: 'weapon',
        title: w.name,
        text: normalize([w.description, w.type, w.group, (w.properties || []).join(' ')].filter(Boolean).join(' \n ')),
        url: `/weapons?id=${w.id}`,
        badge: 'Оружие',
      });
    }
    for (const a of ARMOR as Armor[]) {
      items.push({
        id: `armor:${a.id}`,
        kind: 'armor',
        title: a.name,
        text: normalize([a.description, a.category, (a.properties || []).join(' ')].filter(Boolean).join(' \n ')),
        url: `/armor?id=${a.id}`,
        badge: 'Броня',
      });
    }
    return items;
  }, [articles]);
};

const SearchPage: React.FC = () => {
  const defaults = useMemo(() => buildDefaultArticles(), []);
  const { articles } = useLoreArticles(defaults);

  const index = useIndex(articles);

  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState<string>(() => searchParams.get('q') || '');
  const [kind, setKind] = useState<ResultKind | 'all'>(() => (searchParams.get('type') as any) || 'all');
  const [section, setSection] = useState<SectionId | 'all'>(() => (searchParams.get('section') as SectionId) || 'all');

  useEffect(() => {
    const next: Record<string, string> = {};
    if (query) next.q = query;
    if (kind && kind !== 'all') next.type = kind;
    if (section && section !== 'all') next.section = section;
    setSearchParams(next);
  }, [query, kind, section, setSearchParams]);

  const normalizedQ = normalize(query);

  const filtered = useMemo(() => {
    const byKind = (item: SearchItem) => (kind === 'all' ? true : item.kind === kind);
    const bySection = (item: SearchItem) => (section === 'all' || item.sectionId === section || item.kind !== 'lore');
    const byQuery = (item: SearchItem) => {
      if (!normalizedQ) return true;
      const hay = `${normalize(item.title)} ${item.text}`;
      return hay.includes(normalizedQ);
    };
    return index.filter((it) => byKind(it) && bySection(it) && byQuery(it));
  }, [index, kind, section, normalizedQ]);

  const grouped = useMemo(() => {
    const groups: Record<ResultKind, SearchItem[]> = { lore: [], weapon: [], armor: [] };
    for (const item of filtered) {
      groups[item.kind].push(item);
    }
    return groups;
  }, [filtered]);

  return (
    <div className="search-root">
      <header className="search-header">
        <div>
          <h1 className="search-title">Поиск</h1>
          <p className="search-subtitle">Статьи, разделы, оружие и броня</p>
        </div>
        <Link to="/" className="lore-btn search-back"><i className="fa-solid fa-arrow-left" /> На главную</Link>
      </header>

      <section className="search-controls">
        <input
          className="search-input"
          type="text"
          placeholder="Поиск по сайту..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="search-filters">
          <select className="search-select" value={kind} onChange={(e) => setKind((e.target.value as any) || 'all')}>
            <option value="all">Все категории</option>
            <option value="lore">Лор</option>
            <option value="weapon">Оружие</option>
            <option value="armor">Броня</option>
          </select>
          <select className="search-select" value={section} onChange={(e) => setSection((e.target.value as SectionId) || 'all')}>
            <option value="all">Все разделы лора</option>
            {(SECTION_IDS as SectionId[]).map((sid) => (
              <option key={sid} value={sid}>{SECTION_BY_ID[sid]?.label}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="search-results">
        {(['lore', 'weapon', 'armor'] as ResultKind[]).map((k) => (
          <div key={k} className="search-section">
            <h3 className="search-group-title">
              {k === 'lore' ? 'Лор' : k === 'weapon' ? 'Оружие' : 'Броня'}
              <span className="search-group-count">({grouped[k].length})</span>
            </h3>
            <div className="search-cards">
              {grouped[k].map((item) => (
                <Link key={item.id} to={item.url} className="search-card">
                  <div className="search-card-head">
                    <strong className="search-card-title">{item.title}</strong>
                    {item.badge && (<span className="search-card-badge">{item.badge}</span>)}
                  </div>
                  <small className="search-card-text">{item.text}</small>
                </Link>
              ))}
              {grouped[k].length === 0 && (
                <div className="search-empty">Нет результатов</div>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
};

export default SearchPage;

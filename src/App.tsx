// src/App.tsx

import React from 'react';
// [ИСПРАВЛЕНО] ❗️ Убираем BrowserRouter, он уже есть в main.tsx
import { Route, Routes } from 'react-router-dom'; 

import TopBar from './components/TopBar';
import { useAuth } from './components/AuthContext';

// --- Твои страницы ---
import HomePage from './components/HomePage';
import CharacterSheetPage from './components/CharacterSheetPage';
import GmHubPage from './components/GmHubPage';
import PlayerSheetsListPage from './components/PlayerSheetsListPage';
import CombatPage from './components/CombatPage';
import PlayerCombatPage from './components/PlayerCombatPage';
import GmEditorPage from './components/GmEditorPage';
import EquipmentPage from './components/EquipmentPage';
import GmSkillsPage from './components/GmSkillsPage';
import GmPlayerNotesPage from './components/GmPlayerNotesPage';
import LoreSectionPage from './components/LoreSectionPage';
import PlayerNotesCloudPage from './components/PlayerNotesCloudPage';
import CampaignPage from './components/CampaignPage';
import UserProfilePage from './components/UserProfilePage';
import GazettePage from './components/GazettePage';
import ItemsPage from './components/GmItemsPage';
import RulesPage from './components/RulesPage';
import CombatRulePage from './components/CombatRulePage';
// [ИЗМЕНЕНО] ❗️ Импортируем новую страницу правил
import ActionEconomyRulePage from './components/ActionEconomyRulePage';
import NotFoundPage from './components/NotFoundPage';


// --- Провайдеры Поиска ---
import { SearchProvider } from './components/SearchContext'; 
import GlobalSearchResults from './components/GlobalSearchResults';

const App: React.FC = () => {
  const { loading, role } = useAuth();

  if (loading && role === null) {
    return (
      <div className="hw-root">
        <header className="hw-topbar">
          <div className="hw-brand">
            <span className="hw-brand-icon" aria-hidden>
              <i className="fa-regular fa-gem" />
            </span>
            <span>Project Wiki</span>
          </div>
          <div style={{ marginLeft: 'auto', opacity: 0.8 }}>Загрузка…</div>
        </header>
        <main className="hw-main" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
          <div style={{ color: '#cfe6ff', opacity: 0.8 }}>Подготавливаем ваш профиль…</div>
        </main>
      </div>
    );
  }

  return (
    // [ИСПРАВЛЕНО] ❗️ Оборачиваем только в SearchProvider
    <SearchProvider>
        {/* [ИСПРАВЛЕНО] ❗️ BrowserRouter убран */}
        <TopBar />
        <GlobalSearchResults />
        
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/profile" element={<UserProfilePage />} />
          <Route path="/character-sheet" element={<CharacterSheetPage />} />
          <Route path="/gm-hub" element={<GmHubPage />} />
          <Route path="/player-sheets" element={<PlayerSheetsListPage />} />
          <Route path="/combat" element={<CombatPage />} />
          <Route path="/combat/:combatId" element={<CombatPage />} />
          <Route path="/p-combat/:combatId" element={<PlayerCombatPage />} />
          <Route path="/equipment" element={<EquipmentPage />} />
          <Route path="/gm-editor" element={<GmEditorPage />} />
          <Route path="/gm-skills" element={<GmSkillsPage />} />
          <Route path="/gm-player-notes" element={<GmPlayerNotesPage />} />
          <Route path="/notes" element={<PlayerNotesCloudPage />} />
          <Route path="/lore/:sectionId" element={<LoreSectionPage />} />
          <Route path="/campaign" element={<CampaignPage />} />
          <Route path="/gazette" element={<GazettePage />} />
          <Route path="/gm-items" element={<ItemsPage />} />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/rules/combat" element={<CombatRulePage />} />
          {/* [ИЗМЕНЕНО] ❗️ Добавляем новый роут для правила */}
          <Route path="/rules/action-economy" element={<ActionEconomyRulePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        {/* [ИСПРАВЛЕНО] ❗️ BrowserRouter убран */}
    </SearchProvider>
  );
};

export default App;

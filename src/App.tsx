// src/App.tsx

import React from 'react';
import { Route, Routes } from 'react-router-dom';
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

const App: React.FC = () => {
  return (
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
    </Routes>
  );
};

export default App;
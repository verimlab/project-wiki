import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './components/HomePage';
import CharacterSheetPage from './src/components/CharacterSheetPage';
import GmHubPage from './src/components/GmHubPage';
import PlayerSheetsListPage from './src/components/PlayerSheetsListPage';
import CombatPage from './src/components/CombatPage';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/character-sheet" element={<CharacterSheetPage />} />
        <Route path="/gm-hub" element={<GmHubPage />} />
        <Route path="/player-sheets" element={<PlayerSheetsListPage />} />
        <Route path="/combat" element={<CombatPage />} />
        <Route path="/combat/:combatId" element={<CombatPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;

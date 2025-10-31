import React from 'react';
import { Link } from 'react-router-dom';
import './GmHubPage.css';


const GmHubPage: React.FC = () => {
  return (
    <div className="gm-hub-root">
      <header className="gm-hub-header">
        <div>
          <h1>GM Hub</h1>
          <p>Инструменты для ведущего кампании.</p>
        </div>
        <Link className="gm-hub-back" to="/" aria-label="Назад на главную">
          <i className="fa-solid fa-arrow-left-long" aria-hidden />
          <span>Назад</span>
        </Link>
      </header>

      <main className="gm-hub-main">
        <div className="gm-hub-grid">
          <Link to="/player-sheets" className="gm-hub-card">
            <span className="gm-hub-card__icon"><i className="fa-solid fa-users" /></span>
            <span className="gm-hub-card__title">Листы игроков</span>
            <span className="gm-hub-card__desc">Просматривайте и открывайте листы персонажей игроков.</span>
          </Link>

          <Link to="/combat" className="gm-hub-card">
            <span className="gm-hub-card__icon"><i className="fa-solid fa-crosshairs" /></span>
            <span className="gm-hub-card__title">В бой!</span>
            <span className="gm-hub-card__desc">Создайте бой с удобным трекером инициативы.</span>
          </Link>

          <Link to="/gm-editor" className="gm-hub-card">
            <span className="gm-hub-card__icon"><i className="fa-solid fa-pen-to-square" /></span>
            <span className="gm-hub-card__title">Редактор</span>
            <span className="gm-hub-card__desc">Переход к редактору.</span>
          </Link>

          <Link to="/gm-skills" className="gm-hub-card">
            <span className="gm-hub-card__icon"><i className="fa-solid fa-wand-magic-sparkles" /></span>
            <span className="gm-hub-card__title">Редактор навыков</span>
            <span className="gm-hub-card__desc">Добавляйте, редактируйте и синхронизируйте все навыки для персонажей.</span>
          </Link>

          <Link to="/gm-player-notes" className="gm-hub-card">
            <span className="gm-hub-card__icon"><i className="fa-regular fa-note-sticky" /></span>
            <span className="gm-hub-card__title">Заметки игроков</span>
            <span className="gm-hub-card__desc">Просмотр заметок игроков (только для GM).</span>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default GmHubPage;

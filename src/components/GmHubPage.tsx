import React from 'react';
import { Link } from 'react-router-dom';
import './GmHubPage.css';

const T = {
  back: String.fromCharCode(0x041D,0x0430,0x0437,0x0430,0x0434),
  backHome: String.fromCharCode(0x041D,0x0430,0x0437,0x0430,0x0434,0x0020,0x043D,0x0430,0x0020,0x0433,0x043B,0x0430,0x0432,0x043D,0x0443,0x044E),
  go: String.fromCharCode(0x041F,0x0435,0x0440,0x0435,0x0439,0x0442,0x0438),
  sheets: String.fromCharCode(0x041B,0x0438,0x0441,0x0442,0x044B,0x0020,0x0438,0x0433,0x0440,0x043E,0x043A,0x043E,0x0432),
  combat: String.fromCharCode(0x0412,0x0020,0x0431,0x043E,0x0439),
  editor: String.fromCharCode(0x0420,0x0435,0x0434,0x0430,0x043A,0x0442,0x043E,0x0440),
  skillsEditor: String.fromCharCode(0x0420,0x0435,0x0434,0x0430,0x043A,0x0442,0x043E,0x0440,0x0020,0x043D,0x0430,0x0432,0x044B,0x043A,0x043E,0x0432),
  notes: String.fromCharCode(0x0417,0x0430,0x043C,0x0435,0x0442,0x043A,0x0438,0x0020,0x0438,0x0433,0x0440,0x043E,0x043A,0x043E,0x0432),
};

const GmHubPage: React.FC = () => {
  return (
    <div className="gm-hub-root">
      <header className="gm-hub-header">
        <div>
          <h1>GM Hub</h1>
        </div>
        <Link className="gm-hub-back" to="/" aria-label={T.backHome}>
          <i className="fa-solid fa-arrow-left-long" aria-hidden />
          <span>{T.back}</span>
        </Link>
      </header>

      <main className="gm-hub-main">
        <div className="gm-hub-grid">
          <Link to="/player-sheets" className="gm-hub-card">
            <div className="gm-hub-card-header">
              <span className="gm-hub-card__title">{T.sheets}</span>
              <span className="gm-hub-card__icon"><i className="fa-solid fa-users" /></span>
            </div>
            <span className="gm-hub-card__cta">{T.go} <i className="fa-solid fa-arrow-right-long" /></span>
          </Link>

          <Link to="/combat" className="gm-hub-card">
            <div className="gm-hub-card-header">
              <span className="gm-hub-card__title">{T.combat}</span>
              <span className="gm-hub-card__icon"><i className="fa-solid fa-crosshairs" /></span>
            </div>
            <span className="gm-hub-card__cta">{T.go} <i className="fa-solid fa-arrow-right-long" /></span>
          </Link>

          <Link to="/gm-editor" className="gm-hub-card">
            <div className="gm-hub-card-header">
              <span className="gm-hub-card__title">{T.editor}</span>
              <span className="gm-hub-card__icon"><i className="fa-solid fa-pen-to-square" /></span>
            </div>
            <span className="gm-hub-card__cta">{T.go} <i className="fa-solid fa-arrow-right-long" /></span>
          </Link>

          <Link to="/gm-skills" className="gm-hub-card">
            <div className="gm-hub-card-header">
              <span className="gm-hub-card__title">{T.skillsEditor}</span>
              <span className="gm-hub-card__icon"><i className="fa-solid fa-wand-magic-sparkles" /></span>
            </div>
            <span className="gm-hub-card__cta">{T.go} <i className="fa-solid fa-arrow-right-long" /></span>
          </Link>

          <Link to="/gm-player-notes" className="gm-hub-card">
            <div className="gm-hub-card-header">
              <span className="gm-hub-card__title">{T.notes}</span>
              <span className="gm-hub-card__icon"><i className="fa-regular fa-note-sticky" /></span>
            </div>
            <span className="gm-hub-card__cta">{T.go} <i className="fa-solid fa-arrow-right-long" /></span>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default GmHubPage;

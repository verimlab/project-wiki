import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage: React.FC = () => {
  return (
    <div className="container">
      <section className="hero">
        <h2>Ой, какой кошмар!😊</h2>
        <p>
          Похоже, вы попали в неизведанные сектора. Запрошенная страница не существует
          или была перемещена.
        </p>
        <div style={{ marginTop: 20 }}>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              borderRadius: 999,
              border: '1px solid rgba(120,160,255,0.18)',
              background: 'rgba(21,32,58,0.65)',
              color: '#f1f5ff',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textDecoration: 'none',
              boxShadow: 'none',
            }}
          >
            На главную
          </Link>
        </div>
      </section>
    </div>
  );
};

export default NotFoundPage;

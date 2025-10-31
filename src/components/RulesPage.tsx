// src/components/RulesPage.tsx

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../firebase';
import './RulesPage.css'; // Создадим его следующим шагом

const rulesSectors = [
  {
    id: 'combat',
    label: 'Бой',
    iconClass: 'fa-solid fa-khanda',
    path: '/rules/combat',
  },
  // Здесь можно будет добавлять другие правила (например, "Магия", "Навыки")
];

const RulesPage: React.FC = () => {
  const [, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="hw-root">
      {/* Используем общий TopBar */}

      <main className="hw-main">
        <section className="hw-hero">
          <h1 className="neon">ПРАВИЛА</h1>
          <p className="subtitle">
            Правила первой редакции НРИ "Система". Правила могут меняться и во
            время игры на усмотрение мастера. Может предоставляться не
            актуальная информация, в случае появления вопросов обращайтесь к
            мастеру.
          </p>
        </section>

        <section className="hw-grid" aria-label="Разделы правил">
          {rulesSectors.map((s) => (
            <Link
              key={s.id}
              className="hw-card"
              to={s.path}
              aria-label={s.label}
            >
              <div className="hw-card-header">
                <span className="hw-card-icon">
                  <i className={s.iconClass} aria-hidden />
                </span>
                <span className="hw-card-title">{s.label}</span>
              </div>
              <span className="hw-card-cta">
                Читать <i className="fa-solid fa-arrow-right" aria-hidden />
              </span>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
};

export default RulesPage;
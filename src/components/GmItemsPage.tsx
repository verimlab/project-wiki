// src/components/GmItemsPage.tsx

import React, { useState, useEffect, type FormEvent } from 'react';
// ===== ИСПРАВЛЕНИЕ: было 'in', стало 'from' =====
import { type User, onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  query,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  getDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Link } from 'react-router-dom';
import './GmItemsPage.css';

// Типы (без изменений)
type Item = {
  id: string;
  name: string;
  description: string;
  type: string;
};
type ItemFormData = Omit<Item, 'id'>;

const ItemsPage: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'gm' | 'player' | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Состояние модального окна (без изменений)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [currentItem, setCurrentItem] = useState<Item | null>(null);
  const [formData, setFormData] = useState<ItemFormData>({
    name: '',
    description: '',
    type: 'Общий',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    console.log('[ItemsPage] useEffect запущен.');

    const fetchItems = async () => {
      console.log('[ItemsPage] Загрузка предметов...');
      try {
        const itemsCollection = collection(db, 'items');
        const q = query(itemsCollection, orderBy('name'));
        const querySnapshot = await getDocs(q);
        const itemsList = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Item[];
        setItems(itemsList);
        setError(null);
        console.log(`[ItemsPage] ${itemsList.length} предметов загружено.`);
      } catch (err) {
        console.error('[ItemsPage] Ошибка загрузки предметов:', err);
        setError('Не удалось загрузить предметы.');
      }
    };

    // ===== ИСПРАВЛЕНИЕ: Теперь 'nextUser' будет иметь правильный тип 'User | null' =====
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      
      if (!nextUser) {
        // 1. Нет пользователя
        console.log('[Auth] Пользователь не найден (вышел из системы).');
        setRole(null);
        setItems([]);
        setError(null);
        setIsLoading(false);
        return;
      }

      // 2. Пользователь есть, ищем его роль в Firestore
      console.log(`[Auth] Пользователь найден: ${nextUser.email}. Ищем роль в Firestore...`);
      try {
        // 2a. Делаем запрос в 'users' по UID пользователя
        const userDocRef = doc(db, 'users', nextUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        let userRole: 'gm' | 'player' = 'player'; // Роль по умолчанию

        if (userDocSnap.exists()) {
          // Документ найден
          const userData = userDocSnap.data();
          console.log('[Auth] Документ пользователя из Firestore:', userData);
          
          if (userData.role === 'gm') {
            userRole = 'gm';
          }
        } else {
          // Документ не найден
          console.warn(`[Auth] Документ (uid: ${nextUser.uid}) не найден в коллекции 'users'.`);
        }
        
        setRole(userRole);
        console.log(`[Auth] Итоговая роль (из Firestore) определена как: ${userRole}`);

        // 2b. Загружаем предметы (после определения роли)
        await fetchItems(); 

      } catch (err) {
        console.error('[Auth] Ошибка при получении роли из Firestore или загрузке:', err);
        setRole('player');
        console.log('[Auth] Роль принудительно установлена в "player" из-за ошибки.');
        setError('Произошла ошибка при проверке роли.');
      } finally {
        // 3. Завершаем загрузку
        console.log('[Auth] Проверка роли и загрузка данных завершены. Убираем экран загрузки.');
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []); // Пустой массив, выполняется 1 раз

  
  // --- Функции управления модальным окном (без изменений) ---
  const openCreateModal = () => {
    setModalMode('create');
    setCurrentItem(null);
    setFormData({ name: '', description: '', type: 'Общий' });
    setIsModalOpen(true);
  };

  const openEditModal = (item: Item) => {
    setModalMode('edit');
    setCurrentItem(item);
    setFormData({
      name: item.name,
      description: item.description,
      type: item.type,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setError(null);
    setIsSaving(false);
  };

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // --- CRUD операции (без изменений) ---
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      setError('Название предмета не может быть пустым.');
      return;
    }
    setIsSaving(true);
    setError(null);

    try {
      if (modalMode === 'create') {
        const docRef = await addDoc(collection(db, 'items'), formData);
        setItems((prev) => [...prev, { id: docRef.id, ...formData }].sort((a, b) => a.name.localeCompare(b.name)));
      } else if (modalMode === 'edit' && currentItem) {
        const itemDoc = doc(db, 'items', currentItem.id);
        await updateDoc(itemDoc, formData);
        setItems((prev) =>
          prev
            .map((item) =>
              item.id === currentItem.id ? { ...item, ...formData } : item
            )
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      }
      closeModal();
    } catch (err) {
      console.error('Ошибка сохранения:', err);
      setError('Не удалось сохранить предмет.');
      setIsSaving(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот предмет?')) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'items', itemId));
      setItems((prev) => prev.filter((item) => item.id !== itemId));
    } catch (err) {
      console.error('Ошибка удаления:', err);
      setError('Не удалось удалить предмет.');
    }
  };

  // --- Рендеринг (без изменений) ---

  if (isLoading) {
    return (
      <div className="hw-root itm-loader">
        <p>Загрузка (ожидание роли)...</p>
      </div>
    );
  }

  return (
    <div className="hw-root itm-page">
      <header className="itm-header">
        <div className="itm-header-content">
          <Link to="/" className="itm-back-link" title="На главную">
            <i className="fa-solid fa-arrow-left" />
          </Link>
          <h1>Предметы</h1>

          {/* Проверка роли ГМ */}
          {role === 'gm' && (
            <button
              className="hw-modal-primary"
              type="button"
              onClick={openCreateModal}
            >
              <i className="fa-solid fa.fa-plus" /> Создать предмет
            </button>
          )}
        </div>
      </header>

      <main className="itm-main">
        {!user ? (
          <div className="itm-loader">
            <h2>Доступ запрещен</h2>
            <p>Пожалуйста, войдите в аккаунт, чтобы просмотреть предметы.</p>
            <Link to="/" className="hw-modal-secondary">На главную</Link>
          </div>
        ) : error ? (
           <div className="itm-loader">
             <h2 style={{color: '#ff8b7a'}}>Ошибка</h2>
             <p>{error}</p>
           </div>
        ) : items.length === 0 ? (
          <p>Предметов пока нет. {role === 'gm' ? 'Начните с создания нового!' : 'ГМ еще не добавил их.'}</p>
        ) : (
          <div className="itm-list">
            {items.map((item) => (
              <div key={item.id} className="itm-item-card">
                <div className="itm-item-header">
                  <span className="itm-item-type">{item.type}</span>
                  <h3 className="itm-item-name">{item.name}</h3>
                </div>
                <p className="itm-item-desc">{item.description || 'Нет описания'}</p>

                {/* Проверка роли ГМ */}
                {role === 'gm' && (
                  <div className="itm-item-actions">
                    <button
                      className="itm-btn-edit"
                      onClick={() => openEditModal(item)}
                      title="Редактировать"
                    >
                      <i className="fa-solid fa-pen" />
                    </button>
                    <button
                      className="itm-btn-delete"
                      onClick={() => handleDelete(item.id)}
                      title="Удалить"
                    >
                      <i className="fa-solid fa-trash" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Модальное окно (без изменений) */}
      {isModalOpen && role === 'gm' && (
        <div className="hw-modal-backdrop" role="presentation" onClick={closeModal}>
          <div
            className="hw-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(600px, 100%)' }}
          >
            <header className="hw-modal-header">
              <div>
                <h2 id="item-modal-title">
                  {modalMode === 'create' ? 'Создать предмет' : 'Редактировать предмет'}
                </h2>
              </div>
              <button className="hw-modal-close" type="button" onClick={closeModal} aria-label="Закрыть">
                <i className="fa-solid fa-xmark" aria-hidden />
              </button>
            </header>

            <form className="hw-modal-body itm-form" onSubmit={handleSubmit}>
              <div className="itm-form-group">
                <label htmlFor="name">Название</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleFormChange}
                  required
                />
              </div>

              <div className="itm-form-group">
                <label htmlFor="type">Тип предмета</label>
                <input
                  id="type"
                  name="type"
                  type="text"
                  value={formData.type}
                  onChange={handleFormChange}
                  placeholder="Напр: Зелье, Квестовый, Оружие"
                />
              </div>

              <div className="itm-form-group">
                <label htmlFor="description">Описание</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  rows={6}
                />
              </div>

              {error && <div className="hw-dice-error" style={{ marginBottom: 0 }}>{error}</div>}

              <footer className="hw-modal-actions" style={{ marginTop: '20px' }}>
                <button
                  className="hw-modal-primary"
                  type="submit"
                  disabled={isSaving}
                >
                  {isSaving ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button
                  className="hw-modal-secondary"
                  type="button"
                  onClick={closeModal}
                  disabled={isSaving}
                >
                  Отмена
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemsPage;
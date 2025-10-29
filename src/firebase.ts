import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import type { Analytics } from 'firebase/analytics';
import { getStorage } from 'firebase/storage';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAZyXx_WF4NpYo-Ioij3eToJmIj5x_UhGc',
  authDomain: 'project-wiki-445ed.firebaseapp.com',
  projectId: 'project-wiki-445ed',
  storageBucket: 'project-wiki-445ed.firebasestorage.app',
  messagingSenderId: '1027017083987',
  appId: '1:1027017083987:web:f94d562a3bf9c9adb1caa6',
  measurementId: 'G-WCPYB6NTJC'
};

export const firebaseApp = initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const db = getFirestore(firebaseApp);

export const analyticsPromise: Promise<Analytics | null> =
  typeof window !== 'undefined'
    ? isSupported()
      .then((supported) => (supported ? getAnalytics(firebaseApp) : null))
      .catch(() => null)
    : Promise.resolve(null);

export const storage = getStorage(firebaseApp);
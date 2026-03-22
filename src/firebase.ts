import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBjWRoGz8rK7TSLSVl7Db3lpthZaocj4e4',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'jbmrsports-kabaddi-auction.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://jbmrsports-kabaddi-auction-default-rtdb.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'jbmrsports-kabaddi-auction',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'jbmrsports-kabaddi-auction.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '504039947633',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:504039947633:web:9ca94aac68005d589f8ad0',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-F604TVD0RN'
};

const app = initializeApp(firebaseConfig);
export const rtdb = getDatabase(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const login = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);

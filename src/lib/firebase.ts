// Firebase Configuration and Services
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, User, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, Timestamp, FieldValue, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD2dpOd5vI7BYIAl1sBuumeKJ7wB2Ep06w",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "farm2market-99.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "farm2market-99",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "farm2market-99.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "766264273875",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:766264273875:web:4d16eb47367395315edd26",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-7Q02N1DQ5C"
};

console.log('Firebase config:', firebaseConfig);

// Initialize Firebase
let app;
try {
  app = initializeApp(firebaseConfig);
  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Firebase initialization failed:', error);
  // Create a mock app for development
  app = { name: 'mock-app' };
}

// Initialize services
let auth, db, storage, functions, googleProvider;

try {
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  functions = getFunctions(app);
  googleProvider = new GoogleAuthProvider();
  console.log('Firebase services initialized successfully');

  const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';
  if (useEmulators) {
    const emulatorHost = (import.meta.env.VITE_FIREBASE_EMULATOR_HOST as string | undefined) || '127.0.0.1';
    const firestorePort = Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT || 8081);
    const functionsPort = Number(import.meta.env.VITE_FUNCTIONS_EMULATOR_PORT || 5001);
    const authPort = Number(import.meta.env.VITE_AUTH_EMULATOR_PORT || 9099);
    const useAuthEmulator = import.meta.env.VITE_USE_AUTH_EMULATOR === 'true';

    if (db) {
      connectFirestoreEmulator(db, emulatorHost, firestorePort);
    }
    if (functions) {
      connectFunctionsEmulator(functions, emulatorHost, functionsPort);
    }
    if (useAuthEmulator && auth) {
      connectAuthEmulator(auth, `http://${emulatorHost}:${authPort}`, { disableWarnings: true });
    }
    console.log('Firebase emulator connections enabled.');
  }
} catch (error) {
  console.error('Firebase services initialization failed:', error);
  // Create mock services for development
  auth = null;
  db = null;
  storage = null;
  functions = null;
  googleProvider = null;
}

export { auth, db, storage, functions, googleProvider };

export default app;

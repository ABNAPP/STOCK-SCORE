import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Validate that all required environment variables are present
const requiredEnvVars = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value || value === 'undefined')
  .map(([key]) => {
    // Convert camelCase to UPPER_CASE
    const upperKey = key.replace(/([A-Z])/g, '_$1').toUpperCase();
    return `VITE_FIREBASE_${upperKey}`;
  });

if (missingVars.length > 0) {
  const errorMessage = `Missing required Firebase environment variables: ${missingVars.join(', ')}\n\n` +
    `Please add these to your .env.local file (for local development) or ` +
    `Vercel Environment Variables (for production).\n\n` +
    `Go to: Vercel Dashboard → Your Project → Settings → Environment Variables`;
  
  console.error('🔥 Firebase Configuration Error:', errorMessage);
  console.error('Missing variables:', missingVars);
  
  // In production, throw error to be caught by error boundaries
  if (import.meta.env.PROD) {
    throw new Error(errorMessage);
  }
}

const firebaseConfig = {
  apiKey: requiredEnvVars.apiKey || 'missing-api-key',
  authDomain: requiredEnvVars.authDomain || 'missing-auth-domain',
  projectId: requiredEnvVars.projectId || 'missing-project-id',
  storageBucket: requiredEnvVars.storageBucket || 'missing-storage-bucket',
  messagingSenderId: requiredEnvVars.messagingSenderId || 'missing-messaging-sender-id',
  appId: requiredEnvVars.appId || 'missing-app-id'
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error('🔥 Firebase initialization error:', errorMessage);
  console.error('Full error:', error);
  
  // Re-throw with more context
  throw new Error(
    `Firebase initialization failed: ${errorMessage}\n\n` +
    `This usually means:\n` +
    `1. Environment variables are missing (check Vercel or .env.local)\n` +
    `2. Firebase configuration values are incorrect\n` +
    `3. Network connectivity issues`
  );
}

export { auth, db };
export default app;


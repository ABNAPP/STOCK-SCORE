import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getFunctions, Functions } from 'firebase/functions';

// Validate that all required environment variables are present
const requiredEnvVars = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Debug: Log environment variables (masked for security)
if (import.meta.env.DEV) {
  console.log('🔍 Firebase Config Check:', {
    apiKey: requiredEnvVars.apiKey ? `${requiredEnvVars.apiKey.substring(0, 10)}...` : 'MISSING',
    authDomain: requiredEnvVars.authDomain || 'MISSING',
    projectId: requiredEnvVars.projectId || 'MISSING',
    storageBucket: requiredEnvVars.storageBucket || 'MISSING',
    messagingSenderId: requiredEnvVars.messagingSenderId || 'MISSING',
    appId: requiredEnvVars.appId ? `${requiredEnvVars.appId.substring(0, 20)}...` : 'MISSING',
  });
}

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
let functions: Functions;

try {
  // Validate API key format (Firebase API keys start with AIza)
  if (firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('AIza') && firebaseConfig.apiKey !== 'missing-api-key') {
    console.warn('⚠️ Firebase API Key format looks incorrect. It should start with "AIza"');
  }
  
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  functions = getFunctions(app);
  console.log('✅ Firebase initialized successfully');
  console.log('📍 Firebase Project ID:', firebaseConfig.projectId);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error('🔥 Firebase initialization error:', errorMessage);
  console.error('Full error:', error);
  
  // Check if it's an API key error
  if (errorMessage.includes('api-key-not-valid') || errorMessage.includes('API key')) {
    const detailedError = 
      `Firebase API Key Error: ${errorMessage}\n\n` +
      `This means your Firebase API key is invalid or incorrect.\n\n` +
      `How to fix:\n` +
      `1. Go to Firebase Console: https://console.firebase.google.com\n` +
      `2. Select your project: stock-score-df698\n` +
      `3. Go to Project Settings (gear icon) → General tab\n` +
      `4. Scroll down to "Your apps" section\n` +
      `5. If you have a web app, click on it, otherwise:\n` +
      `   - Click the web icon (</>)\n` +
      `   - Register a new app with a name\n` +
      `6. Copy the ENTIRE apiKey from the config object (it should start with "AIza")\n` +
      `7. Go to Vercel → Your Project → Settings → Environment Variables\n` +
      `8. Update VITE_FIREBASE_API_KEY with the correct value\n` +
      `9. Make sure you select all environments (Production, Preview, Development)\n` +
      `10. Redeploy your application\n\n` +
      `Current API Key (first 10 chars): ${firebaseConfig.apiKey?.substring(0, 10) || 'MISSING'}...\n` +
      `Make sure it starts with "AIza" and is the FULL key from Firebase Console.`;
    
    throw new Error(detailedError);
  }
  
  // Re-throw with more context for other errors
  throw new Error(
    `Firebase initialization failed: ${errorMessage}\n\n` +
    `This usually means:\n` +
    `1. Environment variables are missing (check Vercel or .env.local)\n` +
    `2. Firebase configuration values are incorrect\n` +
    `3. Network connectivity issues\n\n` +
    `Current config values:\n` +
    `- API Key: ${firebaseConfig.apiKey ? firebaseConfig.apiKey.substring(0, 10) + '...' : 'MISSING'}\n` +
    `- Project ID: ${firebaseConfig.projectId || 'MISSING'}\n` +
    `- Auth Domain: ${firebaseConfig.authDomain || 'MISSING'}`
  );
}

export { auth, db, functions };
export default app;


import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { ApiKeys } from '../config/apiKeys';

const APP_CONFIG_API_KEYS_PATH = 'appConfig/apiKeys';

/**
 * Get API keys from Firestore (admin-only document).
 * Returns null if document does not exist or on error.
 */
export async function getApiKeysFromFirestore(): Promise<ApiKeys | null> {
  try {
    const ref = doc(db, 'appConfig', 'apiKeys');
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    return {
      eodhd: typeof data.eodhd === 'string' ? data.eodhd : undefined,
      marketstack: typeof data.marketstack === 'string' ? data.marketstack : undefined,
      finnhub: typeof data.finnhub === 'string' ? data.finnhub : undefined,
      alphaVantage: typeof data.alphaVantage === 'string' ? data.alphaVantage : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Save API keys to Firestore (admin-only).
 * Call only from admin UI.
 */
export async function setApiKeysInFirestore(keys: ApiKeys): Promise<void> {
  const ref = doc(db, 'appConfig', 'apiKeys');
  await setDoc(ref, {
    eodhd: keys.eodhd ?? '',
    marketstack: keys.marketstack ?? '',
    finnhub: keys.finnhub ?? '',
    alphaVantage: keys.alphaVantage ?? '',
  });
}

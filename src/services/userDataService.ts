/**
 * User Data Service
 *
 * Provides functionality to save and load shared manual data to Firebase Firestore.
 * This includes Entry/Exit values and Currency values.
 * Threshold values are managed by ThresholdContext/industryThresholds collection.
 * Falls back to localStorage if user is not authenticated or Firestore is unavailable.
 */

import { 
  doc, 
  setDoc, 
  getDoc, 
  collection,
  writeBatch,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { User } from 'firebase/auth';
import { logger } from '../utils/logger';
import { isCurrencyString } from '../utils/typeGuards';

// Firestore collection names
const COLLECTIONS = {
  SHARED_DATA: 'sharedData',
  ENTRY_EXIT: 'entryExit',
  CURRENCY: 'currency',
} as const;

// LocalStorage keys (fallback)
const STORAGE_KEYS = {
  ENTRY_EXIT: 'entryExitValues',
  CURRENCY: 'tachart-currency-map',
} as const;

/**
 * Get shared data document reference
 */
function getSharedDataDoc(dataType: string) {
  return doc(db, COLLECTIONS.SHARED_DATA, dataType);
}

/**
 * Save Entry/Exit values to Firestore
 * 
 * Saves Entry/Exit values (entry1, entry2, exit1, exit2, currency, dateOfUpdate)
 * to Firestore. Falls back to localStorage if user is not authenticated.
 * Also saves to localStorage as backup even when using Firestore.
 * 
 * @param user - Firebase user object, or null if not authenticated
 * @param values - Entry/Exit values to save, keyed by ticker symbol
 * 
 * @example
 * ```typescript
 * await saveEntryExitValues(user, {
 *   'AAPL': { entry1: 150, entry2: 155, exit1: 160, exit2: 165, currency: 'USD', dateOfUpdate: '2024-01-01' }
 * });
 * ```
 */
export async function saveEntryExitValues(
  user: User | null,
  values: Record<string, { entry1: number; entry2: number; exit1: number; exit2: number; currency: string; dateOfUpdate: string | null }>
): Promise<void> {
  if (!user) {
    // Fallback to localStorage
    try {
      localStorage.setItem(STORAGE_KEYS.ENTRY_EXIT, JSON.stringify(values));
    } catch (error) {
      logger.error('Error saving EntryExit values to localStorage', error, { component: 'userDataService', operation: 'saveEntryExitValues' });
    }
    return;
  }

  try {
    const docRef = doc(db, COLLECTIONS.SHARED_DATA, COLLECTIONS.ENTRY_EXIT);
    await setDoc(docRef, {
      values,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    
    // Also save to localStorage as backup
    try {
      localStorage.setItem(STORAGE_KEYS.ENTRY_EXIT, JSON.stringify(values));
    } catch (error) {
      logger.warn('Failed to save EntryExit values to localStorage backup', { component: 'userDataService', operation: 'saveEntryExitValues', error });
    }
  } catch (error) {
    logger.error('Error saving EntryExit values to Firestore', error, { component: 'userDataService', operation: 'saveEntryExitValues' });
    // Fallback to localStorage
    try {
      localStorage.setItem(STORAGE_KEYS.ENTRY_EXIT, JSON.stringify(values));
    } catch (localError) {
      logger.error('Error saving EntryExit values to localStorage fallback', localError, { component: 'userDataService', operation: 'saveEntryExitValues' });
    }
  }
}

/**
 * Load Entry/Exit values from Firestore
 * 
 * Loads Entry/Exit values from Firestore. Falls back to localStorage if
 * user is not authenticated or Firestore is unavailable. Also migrates
 * currency data from old separate collection if it exists.
 * 
 * @param user - Firebase user object, or null if not authenticated
 * @returns Entry/Exit values keyed by ticker symbol, or null if not found
 * 
 * @example
 * ```typescript
 * const values = await loadEntryExitValues(user);
 * if (values) {
 *   const aaplEntry = values['AAPL'];
 * }
 * ```
 */
export async function loadEntryExitValues(
  user: User | null
): Promise<Record<string, { entry1: number; entry2: number; exit1: number; exit2: number; currency: string; dateOfUpdate: string | null }> | null> {
  if (!user) {
    // Fallback to localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ENTRY_EXIT);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      logger.error('Error loading EntryExit values from localStorage', error, { component: 'userDataService', operation: 'loadEntryExitValues' });
    }
    return null;
  }

  try {
    const docRef = doc(db, COLLECTIONS.SHARED_DATA, COLLECTIONS.ENTRY_EXIT);
    const docSnap = await getDoc(docRef);
    
    let values: Record<string, { entry1: number; entry2: number; exit1: number; exit2: number; currency: string; dateOfUpdate: string | null }> = {};
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      values = data.values || {};
    }
    
    // Migrate currency from old separate collection if it exists
    try {
      const currencyDocRef = doc(db, COLLECTIONS.SHARED_DATA, COLLECTIONS.CURRENCY);
      const currencyDocSnap = await getDoc(currencyDocRef);
      
      if (currencyDocSnap.exists()) {
        const currencyData = currencyDocSnap.data();
        const currencyValues = currencyData.values || {};
        
        // Merge currency into entryExit values
        for (const [key, currency] of Object.entries(currencyValues)) {
          if (!values[key]) {
            values[key] = { entry1: 0, entry2: 0, exit1: 0, exit2: 0, currency: isCurrencyString(currency) ? currency : 'USD', dateOfUpdate: null };
          } else if (!values[key].currency) {
            values[key].currency = isCurrencyString(currency) ? currency : 'USD';
          }
        }
      }
    } catch (currencyError) {
      // If currency migration fails, continue without it
      logger.warn('Failed to migrate currency data', { component: 'userDataService', operation: 'loadEntryExitValues', error: currencyError });
    }
    
    // Ensure all values have currency field
    for (const key in values) {
      if (!values[key].currency) {
        values[key].currency = 'USD';
      }
    }
    
    if (Object.keys(values).length > 0) {
      // Also save to localStorage as backup
      try {
        localStorage.setItem(STORAGE_KEYS.ENTRY_EXIT, JSON.stringify(values));
      } catch (error) {
        logger.warn('Failed to save EntryExit values to localStorage backup', { component: 'userDataService', operation: 'saveEntryExitValues', error });
      }
      
      return values;
    }
    
    // If no Firestore data, try localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ENTRY_EXIT);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure all values have currency field
        for (const key in parsed) {
          if (!parsed[key].currency) {
            parsed[key].currency = 'USD';
          }
        }
        return parsed;
      }
    } catch (error) {
      logger.error('Error loading EntryExit values from localStorage', error, { component: 'userDataService', operation: 'loadEntryExitValues' });
    }
    
    // Also try to migrate from old currency localStorage
    try {
      const currencyStored = localStorage.getItem(STORAGE_KEYS.CURRENCY);
      if (currencyStored) {
        const currencyParsed = JSON.parse(currencyStored);
        const migrated: Record<string, { entry1: number; entry2: number; exit1: number; exit2: number; currency: string; dateOfUpdate: string | null }> = {};
        for (const [key, currency] of Object.entries(currencyParsed)) {
            migrated[key] = { entry1: 0, entry2: 0, exit1: 0, exit2: 0, currency: isCurrencyString(currency) ? currency : 'USD', dateOfUpdate: null };
        }
        if (Object.keys(migrated).length > 0) {
          return migrated;
        }
      }
    } catch (error) {
      logger.warn('Failed to migrate currency from localStorage', { component: 'userDataService', operation: 'loadEntryExitValues', error });
    }
    
    return null;
  } catch (error) {
    logger.error('Error loading EntryExit values from Firestore', error, { component: 'userDataService', operation: 'loadEntryExitValues' });
    // Fallback to localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ENTRY_EXIT);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure all values have currency field
        for (const key in parsed) {
          if (!parsed[key].currency) {
            parsed[key].currency = 'USD';
          }
        }
        return parsed;
      }
    } catch (localError) {
      logger.error('Error loading EntryExit values from localStorage fallback', localError, { component: 'userDataService', operation: 'loadEntryExitValues' });
    }
    return null;
  }
}

/**
 * Save Currency values to Firestore
 * 
 * Saves currency mapping values to Firestore. Falls back to localStorage
 * if user is not authenticated. Also saves to localStorage as backup.
 * 
 * @param user - Firebase user object, or null if not authenticated
 * @param values - Currency values to save, keyed by ticker symbol
 * 
 * @example
 * ```typescript
 * await saveCurrencyValues(user, {
 *   'AAPL': 'USD',
 *   'VOLV-B': 'SEK'
 * });
 * ```
 */
export async function saveCurrencyValues(
  user: User | null,
  values: Record<string, string>
): Promise<void> {
  if (!user) {
    // Fallback to localStorage
    try {
      localStorage.setItem(STORAGE_KEYS.CURRENCY, JSON.stringify(values));
    } catch (error) {
      logger.error('Error saving Currency values to localStorage', error, { component: 'userDataService', operation: 'saveCurrencyValues' });
    }
    return;
  }

  try {
    const docRef = doc(db, COLLECTIONS.SHARED_DATA, COLLECTIONS.CURRENCY);
    await setDoc(docRef, {
      values,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    
    // Also save to localStorage as backup
    try {
      localStorage.setItem(STORAGE_KEYS.CURRENCY, JSON.stringify(values));
    } catch (error) {
      logger.warn('Failed to save Currency values to localStorage backup', { component: 'userDataService', operation: 'saveCurrencyValues', error });
    }
  } catch (error) {
    logger.error('Error saving Currency values to Firestore', error, { component: 'userDataService', operation: 'saveCurrencyValues' });
    // Fallback to localStorage
    try {
      localStorage.setItem(STORAGE_KEYS.CURRENCY, JSON.stringify(values));
    } catch (localError) {
      logger.error('Error saving Currency values to localStorage fallback', localError, { component: 'userDataService', operation: 'saveCurrencyValues' });
    }
  }
}

/**
 * Load Currency values from Firestore
 * 
 * Loads currency mapping values from Firestore. Falls back to localStorage
 * if user is not authenticated or Firestore is unavailable.
 * 
 * @param user - Firebase user object, or null if not authenticated
 * @returns Currency values keyed by ticker symbol, or null if not found
 * 
 * @example
 * ```typescript
 * const currencies = await loadCurrencyValues(user);
 * if (currencies) {
 *   const aaplCurrency = currencies['AAPL']; // 'USD'
 * }
 * ```
 */
export async function loadCurrencyValues(
  user: User | null
): Promise<Record<string, string> | null> {
  if (!user) {
    // Fallback to localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CURRENCY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      logger.error('Error loading Currency values from localStorage', error, { component: 'userDataService', operation: 'loadCurrencyValues' });
    }
    return null;
  }

  try {
    const docRef = doc(db, COLLECTIONS.SHARED_DATA, COLLECTIONS.CURRENCY);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const values = data.values || {};
      
      // Also save to localStorage as backup
      try {
        localStorage.setItem(STORAGE_KEYS.CURRENCY, JSON.stringify(values));
      } catch (error) {
        logger.warn('Failed to save Currency values to localStorage backup', { component: 'userDataService', operation: 'saveCurrencyValues', error });
      }
      
      return values;
    }
    
    // If no Firestore data, try localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CURRENCY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      logger.error('Error loading Currency values from localStorage', error, { component: 'userDataService', operation: 'loadCurrencyValues' });
    }
    
    return null;
  } catch (error) {
    logger.error('Error loading Currency values from Firestore', error, { component: 'userDataService', operation: 'loadCurrencyValues' });
    // Fallback to localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CURRENCY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (localError) {
      logger.error('Error loading Currency values from localStorage fallback', localError, { component: 'userDataService', operation: 'loadCurrencyValues' });
    }
    return null;
  }
}

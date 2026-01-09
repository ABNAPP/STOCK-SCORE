/**
 * User Data Service
 * 
 * Provides functionality to save and load shared manual data to Firebase Firestore.
 * This includes Entry/Exit values, Currency values, and Threshold values.
 * All data is shared between all authenticated users.
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

// Firestore collection names
const COLLECTIONS = {
  SHARED_DATA: 'sharedData',
  ENTRY_EXIT: 'entryExit',
  CURRENCY: 'currency',
  THRESHOLD: 'threshold',
} as const;

// LocalStorage keys (fallback)
const STORAGE_KEYS = {
  ENTRY_EXIT: 'entryExitValues',
  CURRENCY: 'tachart-currency-map',
  THRESHOLD: 'thresholdValues',
} as const;

/**
 * Get shared data document reference
 */
function getSharedDataDoc(dataType: string) {
  return doc(db, COLLECTIONS.SHARED_DATA, dataType);
}

/**
 * Save Entry/Exit values to Firestore
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
      console.error('Error saving EntryExit values to localStorage:', error);
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
      console.warn('Failed to save EntryExit values to localStorage backup:', error);
    }
  } catch (error) {
    console.error('Error saving EntryExit values to Firestore:', error);
    // Fallback to localStorage
    try {
      localStorage.setItem(STORAGE_KEYS.ENTRY_EXIT, JSON.stringify(values));
    } catch (localError) {
      console.error('Error saving EntryExit values to localStorage fallback:', localError);
    }
  }
}

/**
 * Load Entry/Exit values from Firestore
 * Also migrates currency data from old separate collection if it exists
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
      console.error('Error loading EntryExit values from localStorage:', error);
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
            values[key] = { entry1: 0, entry2: 0, exit1: 0, exit2: 0, currency: currency as string || 'USD', dateOfUpdate: null };
          } else if (!values[key].currency) {
            values[key].currency = currency as string || 'USD';
          }
        }
      }
    } catch (currencyError) {
      // If currency migration fails, continue without it
      console.warn('Failed to migrate currency data:', currencyError);
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
        console.warn('Failed to save EntryExit values to localStorage backup:', error);
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
      console.error('Error loading EntryExit values from localStorage:', error);
    }
    
    // Also try to migrate from old currency localStorage
    try {
      const currencyStored = localStorage.getItem(STORAGE_KEYS.CURRENCY);
      if (currencyStored) {
        const currencyParsed = JSON.parse(currencyStored);
        const migrated: Record<string, { entry1: number; entry2: number; exit1: number; exit2: number; currency: string; dateOfUpdate: string | null }> = {};
        for (const [key, currency] of Object.entries(currencyParsed)) {
          migrated[key] = { entry1: 0, entry2: 0, exit1: 0, exit2: 0, currency: currency as string || 'USD', dateOfUpdate: null };
        }
        if (Object.keys(migrated).length > 0) {
          return migrated;
        }
      }
    } catch (error) {
      console.warn('Failed to migrate currency from localStorage:', error);
    }
    
    return null;
  } catch (error) {
    console.error('Error loading EntryExit values from Firestore:', error);
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
      console.error('Error loading EntryExit values from localStorage fallback:', localError);
    }
    return null;
  }
}

/**
 * Save Currency values to Firestore
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
      console.error('Error saving Currency values to localStorage:', error);
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
      console.warn('Failed to save Currency values to localStorage backup:', error);
    }
  } catch (error) {
    console.error('Error saving Currency values to Firestore:', error);
    // Fallback to localStorage
    try {
      localStorage.setItem(STORAGE_KEYS.CURRENCY, JSON.stringify(values));
    } catch (localError) {
      console.error('Error saving Currency values to localStorage fallback:', localError);
    }
  }
}

/**
 * Load Currency values from Firestore
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
      console.error('Error loading Currency values from localStorage:', error);
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
        console.warn('Failed to save Currency values to localStorage backup:', error);
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
      console.error('Error loading Currency values from localStorage:', error);
    }
    
    return null;
  } catch (error) {
    console.error('Error loading Currency values from Firestore:', error);
    // Fallback to localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CURRENCY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (localError) {
      console.error('Error loading Currency values from localStorage fallback:', localError);
    }
    return null;
  }
}

/**
 * Save Threshold values to Firestore
 */
export async function saveThresholdValues(
  user: User | null,
  values: Record<string, {
    irr: number;
    leverageF2Min: number;
    leverageF2Max: number;
    ro40Min: number;
    ro40Max: number;
    cashSdebtMin: number;
    cashSdebtMax: number;
    currentRatioMin: number;
    currentRatioMax: number;
  }>
): Promise<void> {
  if (!user) {
    // Fallback to localStorage
    try {
      localStorage.setItem(STORAGE_KEYS.THRESHOLD, JSON.stringify(values));
    } catch (error) {
      console.error('Error saving Threshold values to localStorage:', error);
    }
    return;
  }

  try {
    const docRef = doc(db, COLLECTIONS.SHARED_DATA, COLLECTIONS.THRESHOLD);
    await setDoc(docRef, {
      values,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    
    // Also save to localStorage as backup
    try {
      localStorage.setItem(STORAGE_KEYS.THRESHOLD, JSON.stringify(values));
    } catch (error) {
      console.warn('Failed to save Threshold values to localStorage backup:', error);
    }
  } catch (error) {
    console.error('Error saving Threshold values to Firestore:', error);
    // Fallback to localStorage
    try {
      localStorage.setItem(STORAGE_KEYS.THRESHOLD, JSON.stringify(values));
    } catch (localError) {
      console.error('Error saving Threshold values to localStorage fallback:', localError);
    }
  }
}

/**
 * Load Threshold values from Firestore
 */
export async function loadThresholdValues(
  user: User | null
): Promise<Record<string, {
  irr: number;
  leverageF2Min: number;
  leverageF2Max: number;
  ro40Min: number;
  ro40Max: number;
  cashSdebtMin: number;
  cashSdebtMax: number;
  currentRatioMin: number;
  currentRatioMax: number;
}> | null> {
  if (!user) {
    // Fallback to localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.THRESHOLD);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading Threshold values from localStorage:', error);
    }
    return null;
  }

  try {
    const docRef = doc(db, COLLECTIONS.SHARED_DATA, COLLECTIONS.THRESHOLD);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const values = data.values || {};
      
      // Also save to localStorage as backup
      try {
        localStorage.setItem(STORAGE_KEYS.THRESHOLD, JSON.stringify(values));
      } catch (error) {
        console.warn('Failed to save Threshold values to localStorage backup:', error);
      }
      
      return values;
    }
    
    // If no Firestore data, try localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.THRESHOLD);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading Threshold values from localStorage:', error);
    }
    
    return null;
  } catch (error) {
    console.error('Error loading Threshold values from Firestore:', error);
    // Fallback to localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.THRESHOLD);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (localError) {
      console.error('Error loading Threshold values from localStorage fallback:', localError);
    }
    return null;
  }
}

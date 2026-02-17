/**
 * User Data Service
 *
 * Provides functionality to save and load shared manual data to Firebase Firestore.
 * This includes Entry/Exit values and Currency values.
 * Threshold values are managed by ThresholdContext/industryThresholds collection.
 * Firestore is the only data source; authentication is required for persistence.
 */

import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { User } from 'firebase/auth';
import { logger } from '../utils/logger';
import { isCurrencyString } from '../utils/typeGuards';

// Firestore collection names
const COLLECTIONS = {
  SHARED_DATA: 'sharedData',
  ENTRY_EXIT: 'entiryExit',
  CURRENCY: 'currency',
} as const;

function toCamelCase(value: string): string {
  const cleaned = value.replace(/&/g, 'and').replace(/[^A-Za-z0-9]+/g, ' ').trim();
  const parts = cleaned.split(' ').filter(Boolean);
  if (parts.length === 0) return '';
  const [first, ...rest] = parts;
  return [
    first.charAt(0).toLowerCase() + first.slice(1),
    ...rest.map((p) => p.charAt(0).toUpperCase() + p.slice(1)),
  ].join('');
}

function shouldPersistEntry(entry: { entry1: number; entry2: number; exit1: number; exit2: number; currency: string; dateOfUpdate: string | null }): boolean {
  const hasValues = entry.entry1 !== 0 || entry.entry2 !== 0 || entry.exit1 !== 0 || entry.exit2 !== 0;
  return hasValues || !!entry.dateOfUpdate;
}

/**
 * Save Entry/Exit values to Firestore
 * 
 * Saves Entry/Exit values (entry1, entry2, exit1, exit2, currency, dateOfUpdate)
 * to Firestore in entiryExit/{camelCaseCompanyName}.
 * Requires authentication; no-op when user is null.
 * 
 * @param user - Firebase user object, or null if not authenticated
 * @param values - Entry/Exit values to save, keyed by ticker symbol
 */
export async function saveEntryExitValues(
  user: User | null,
  values: Record<string, { entry1: number; entry2: number; exit1: number; exit2: number; currency: string; dateOfUpdate: string | null }>
): Promise<void> {
  if (!user) return;

  try {
    const batch = writeBatch(db);
    for (const [companyName, entry] of Object.entries(values)) {
      if (!shouldPersistEntry(entry)) continue;
      const docId = toCamelCase(companyName);
      if (!docId) continue;
      const docRef = doc(db, COLLECTIONS.ENTRY_EXIT, docId);
      batch.set(docRef, { ...entry, companyName }, { merge: true });
    }
    await batch.commit();
  } catch (error) {
    logger.error('Error saving EntryExit values to Firestore', error, { component: 'userDataService', operation: 'saveEntryExitValues' });
    throw error;
  }
}

/**
 * Load Entry/Exit values from Firestore
 * 
 * Loads Entry/Exit values from Firestore. Returns null when user is not authenticated
 * or when no data exists. Also migrates currency data from old separate collection if it exists.
 * 
 * @param user - Firebase user object, or null if not authenticated
 * @returns Entry/Exit values keyed by ticker symbol, or null if not found
 */
export async function loadEntryExitValues(
  user: User | null
): Promise<Record<string, { entry1: number; entry2: number; exit1: number; exit2: number; currency: string; dateOfUpdate: string | null }> | null> {
  if (!user) return null;

  try {
    const values: Record<string, { entry1: number; entry2: number; exit1: number; exit2: number; currency: string; dateOfUpdate: string | null }> = {};
    const snapshot = await getDocs(collection(db, COLLECTIONS.ENTRY_EXIT));
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      const companyName = typeof data.companyName === 'string' ? data.companyName : docSnap.id;
      values[companyName] = {
        entry1: typeof data.entry1 === 'number' ? data.entry1 : 0,
        entry2: typeof data.entry2 === 'number' ? data.entry2 : 0,
        exit1: typeof data.exit1 === 'number' ? data.exit1 : 0,
        exit2: typeof data.exit2 === 'number' ? data.exit2 : 0,
        currency: typeof data.currency === 'string' ? data.currency : 'USD',
        dateOfUpdate: typeof data.dateOfUpdate === 'string' ? data.dateOfUpdate : null,
      };
    });
    
    // Migrate currency from old separate collection if it exists
    try {
      const currencyDocRef = doc(db, COLLECTIONS.SHARED_DATA, COLLECTIONS.CURRENCY);
      const currencyDocSnap = await getDoc(currencyDocRef);
      
      if (currencyDocSnap.exists()) {
        const currencyData = currencyDocSnap.data();
        const currencyValues = currencyData.values || {};
        
        for (const [key, currency] of Object.entries(currencyValues)) {
          if (!values[key]) {
            values[key] = { entry1: 0, entry2: 0, exit1: 0, exit2: 0, currency: isCurrencyString(currency) ? currency : 'USD', dateOfUpdate: null };
          } else if (!values[key].currency) {
            values[key].currency = isCurrencyString(currency) ? currency : 'USD';
          }
        }
      }
    } catch (currencyError) {
      logger.warn('Failed to migrate currency data', { component: 'userDataService', operation: 'loadEntryExitValues', error: currencyError });
    }
    
    // Ensure all values have currency field
    for (const key in values) {
      if (!values[key].currency) {
        values[key].currency = 'USD';
      }
    }
    
    return Object.keys(values).length > 0 ? values : null;
  } catch (error) {
    logger.error('Error loading EntryExit values from Firestore', error, { component: 'userDataService', operation: 'loadEntryExitValues' });
    return null;
  }
}

/**
 * Save Currency values to Firestore
 * 
 * Saves currency mapping values to Firestore. Requires authentication; no-op when user is null.
 * 
 * @param user - Firebase user object, or null if not authenticated
 * @param values - Currency values to save, keyed by ticker symbol
 */
export async function saveCurrencyValues(
  user: User | null,
  values: Record<string, string>
): Promise<void> {
  if (!user) return;

  try {
    const docRef = doc(db, COLLECTIONS.SHARED_DATA, COLLECTIONS.CURRENCY);
    await setDoc(docRef, {
      values,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    logger.error('Error saving Currency values to Firestore', error, { component: 'userDataService', operation: 'saveCurrencyValues' });
    throw error;
  }
}

/**
 * Load Currency values from Firestore
 * 
 * Loads currency mapping values from Firestore. Returns null when user is not authenticated
 * or when no data exists.
 * 
 * @param user - Firebase user object, or null if not authenticated
 * @returns Currency values keyed by ticker symbol, or null if not found
 */
export async function loadCurrencyValues(
  user: User | null
): Promise<Record<string, string> | null> {
  if (!user) return null;

  try {
    const docRef = doc(db, COLLECTIONS.SHARED_DATA, COLLECTIONS.CURRENCY);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return data.values || {};
    }
    
    return null;
  } catch (error) {
    logger.error('Error loading Currency values from Firestore', error, { component: 'userDataService', operation: 'loadCurrencyValues' });
    return null;
  }
}

/**
 * User Data Service
 *
 * Entry/exit reads and writes use value-insight-be (`GET` / `PUT` /entry-exit).
 * Currency-only legacy doc load remains on Firestore for `loadCurrencyValues`.
 */

import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { User } from 'firebase/auth';
import { logger } from '../utils/logger';
import { loadEntryExitValuesFromApi, saveEntryExitValuesToApi, type EntryExitValuesRecord } from './entryExitDataService';

const COLLECTIONS = {
  SHARED_DATA: 'sharedData',
  CURRENCY: 'currency',
} as const;

export type EntryExitValuesMap = EntryExitValuesRecord;

/**
 * Save Entry/Exit values via value-insight-be (Firestore write on server).
 */
export async function saveEntryExitValues(user: User | null, values: EntryExitValuesMap): Promise<void> {
  if (!user) return;

  try {
    await saveEntryExitValuesToApi(user, values);
  } catch (error) {
    logger.error('Error saving EntryExit values via API', error, {
      component: 'userDataService',
      operation: 'saveEntryExitValues',
    });
    throw error;
  }
}

/**
 * Load Entry/Exit values via value-insight-be.
 */
export async function loadEntryExitValues(user: User | null): Promise<EntryExitValuesMap | null> {
  if (!user) return null;

  try {
    return await loadEntryExitValuesFromApi();
  } catch (error) {
    logger.error('Error loading EntryExit values from API', error, {
      component: 'userDataService',
      operation: 'loadEntryExitValues',
    });
    return null;
  }
}

export async function saveCurrencyValues(user: User | null, values: Record<string, string>): Promise<void> {
  if (!user) return;

  try {
    const docRef = doc(db, COLLECTIONS.SHARED_DATA, COLLECTIONS.CURRENCY);
    await setDoc(
      docRef,
      {
        values,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    logger.error('Error saving Currency values to Firestore', error, {
      component: 'userDataService',
      operation: 'saveCurrencyValues',
    });
    throw error;
  }
}

export async function loadCurrencyValues(user: User | null): Promise<Record<string, string> | null> {
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
    logger.error('Error loading Currency values from Firestore', error, {
      component: 'userDataService',
      operation: 'loadCurrencyValues',
    });
    return null;
  }
}

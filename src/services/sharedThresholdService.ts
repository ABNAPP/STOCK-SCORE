/**
 * Shared Threshold Service
 *
 * Manages shared threshold data in Firestore (sharedData/threshold).
 * Read: any authenticated user. Write: admin only.
 * localStorage is read-cache/fallback only.
 */

import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from '../config/firebase';
import { logger } from '../utils/logger';
import { getViewDataWithFallback, setViewData } from './firestoreCacheService';

export interface ThresholdValues {
  irr: number;
  leverageF2Min: number;
  leverageF2Max: number;
  ro40Min: number;
  ro40Max: number;
  cashSdebtMin: number;
  cashSdebtMax: number;
  currentRatioMin: number;
  currentRatioMax: number;
}

const STORAGE_KEY = 'sharedThresholdValues';
const LEGACY_STORAGE_KEY = 'thresholdValues';


/**
 * Load shared threshold values from localStorage (fallback only).
 * Migrates from legacy key (thresholdValues) if present.
 */
export function loadFromLocalStorage(): Record<string, ThresholdValues> | null {
  try {
    let stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      stored = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, ThresholdValues>;
        localStorage.setItem(STORAGE_KEY, stored);
        return parsed;
      }
    } else {
      return JSON.parse(stored);
    }
  } catch (error: unknown) {
    logger.error('Error loading shared threshold from localStorage', error, {
      component: 'sharedThresholdService',
      operation: 'sharedThreshold.loadFailed',
    });
  }
  return null;
}

/**
 * Save to localStorage (read-cache only, never triggers Firestore write).
 */
export function saveToLocalStorage(values: Record<string, ThresholdValues>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch (error: unknown) {
    logger.error('Error saving shared threshold to localStorage', error, {
      component: 'sharedThresholdService',
      operation: 'saveToLocalStorage',
    });
  }
}

/**
 * Load shared threshold values from Firestore.
 * Uses viewData/threshold-industry first (dual-read/cutover), fallback to sharedData/threshold.
 * Requires authenticated user for Firestore read; returns null when no user.
 * Falls back to localStorage on error.
 */
export async function loadSharedThresholdValues(
  user: User | null
): Promise<Record<string, ThresholdValues> | null> {
  if (!user) {
    return loadFromLocalStorage();
  }

  try {
    const result = await getViewDataWithFallback<{ values: Record<string, ThresholdValues> }>('threshold-industry', {
      fallback: async () => {
        const docRef = doc(db, 'sharedData', 'threshold');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const values = (data.values || {}) as Record<string, ThresholdValues>;
          if (Object.keys(values).length > 0) return { values };
        }
        return null;
      },
    });
    if (result && result.data.values && Object.keys(result.data.values).length > 0) {
      saveToLocalStorage(result.data.values);
      return result.data.values;
    }
    return loadFromLocalStorage();
  } catch (error: unknown) {
    logger.error('Error loading shared threshold from Firestore', error, {
      component: 'sharedThresholdService',
      operation: 'sharedThreshold.loadFailed',
    });
    return loadFromLocalStorage();
  }
}

export interface SaveSharedThresholdOptions {
  user: User | null;
  userRole: string | null;
}

/**
 * Save shared threshold values to Firestore.
 * Admin only; throws if userRole !== 'admin'.
 * No retry on permission denied.
 */
export async function saveSharedThresholdValues(
  values: Record<string, ThresholdValues>,
  options: SaveSharedThresholdOptions
): Promise<void> {
  const { user, userRole } = options;

  if (userRole !== 'admin') {
    logger.warn('Threshold save denied: user is not admin', {
      component: 'sharedThresholdService',
      operation: 'sharedThreshold.saveDenied',
    });
    throw new Error('sharedThreshold.saveDenied');
  }

  if (!user) {
    logger.warn('Threshold save denied: no authenticated user', {
      component: 'sharedThresholdService',
      operation: 'sharedThreshold.saveDenied',
    });
    throw new Error('sharedThreshold.saveDenied');
  }

  try {
    const docRef = doc(db, 'sharedData', 'threshold');
    await setDoc(
      docRef,
      {
        values,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      },
      { merge: true }
    );

    await setViewData('threshold-industry', { values }, { source: 'client-refresh', updatedBy: user.uid }).catch((e) =>
      logger.warn('Failed to write viewData threshold-industry', { component: 'sharedThresholdService', error: e })
    );

    saveToLocalStorage(values);
  } catch (error: unknown) {
    logger.error('Error saving shared threshold to Firestore', error, {
      component: 'sharedThresholdService',
      operation: 'sharedThreshold.saveFailed',
    });
    throw error;
  }
}

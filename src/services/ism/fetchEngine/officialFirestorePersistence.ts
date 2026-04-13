/**
 * Official ISM fetch-engine persistence (shared, durable).
 *
 * UI-only concerns (spinners, last tick toast, etc.) belong in React/local component state —
 * not here. Do not use browser `localStorage` as source of truth for motor state.
 */

import type { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { logger } from '../../../utils/logger';
import { ISM_FETCH_ENGINE_FIRESTORE_COLLECTION, ISM_FETCH_ENGINE_FIRESTORE_DOC_ID } from './constants';
import { patchLoadedIsmFetchEngineState } from './statePatch';
import type { IsmFetchEngineState } from './types';

function engineDocRef() {
  return doc(db, ISM_FETCH_ENGINE_FIRESTORE_COLLECTION, ISM_FETCH_ENGINE_FIRESTORE_DOC_ID);
}

/**
 * Load official motor state from Firestore (shared across devices/sessions for the same project).
 */
export async function loadOfficialIsmFetchEngineState(user: User | null): Promise<IsmFetchEngineState | null> {
  if (!user) return null;
  try {
    const snap = await getDoc(engineDocRef());
    if (!snap.exists()) return null;
    const raw = snap.data()?.engineState;
    if (!raw || typeof raw !== 'object') return null;
    const parsed = raw as IsmFetchEngineState;
    if (parsed.schemaVersion !== 1 || !parsed.perSymbol) return null;
    return patchLoadedIsmFetchEngineState(parsed);
  } catch (e) {
    if (e instanceof Error && e.message.includes('permission')) {
      logger.warn('ISM fetch engine Firestore read denied', {
        component: 'ismFetchEngineOfficialPersistence',
        error: e.message,
      });
      return null;
    }
    logger.error(
      'ISM fetch engine Firestore load failed',
      e instanceof Error ? e : new Error(String(e)),
      { component: 'ismFetchEngineOfficialPersistence' }
    );
    return null;
  }
}

/**
 * Persist official motor state to Firestore. Call after ticks when state changed.
 */
export async function saveOfficialIsmFetchEngineState(
  user: User | null,
  state: IsmFetchEngineState
): Promise<void> {
  if (!user) return;
  try {
    const payload = patchLoadedIsmFetchEngineState({ ...state, lastSavedAt: Date.now() });
    await setDoc(
      engineDocRef(),
      {
        engineState: JSON.parse(JSON.stringify(payload)) as IsmFetchEngineState,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    if (e instanceof Error && e.message.includes('permission')) {
      logger.warn('ISM fetch engine Firestore write denied', {
        component: 'ismFetchEngineOfficialPersistence',
        error: e.message,
      });
      return;
    }
    logger.error(
      'ISM fetch engine Firestore save failed',
      e instanceof Error ? e : new Error(String(e)),
      { component: 'ismFetchEngineOfficialPersistence' }
    );
  }
}

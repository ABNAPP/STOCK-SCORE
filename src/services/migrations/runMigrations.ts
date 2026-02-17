/**
 * Runs app migrations at startup.
 * - runPreAuthMigrations: no-op (previously localStorage; Firestore is now the only data source)
 * - runPostAuthMigrations: Firestore migrations, requires authenticated user (call in App when currentUser exists)
 * All migrations are idempotent (safe to run multiple times).
 */

import { logger } from '../../utils/logger';
import { migrateCoreBoardToScoreBoard, runTruncatedCacheMigrations } from '../firestoreCacheService';
import { getApiKeysFromFirestore } from '../appConfigService';
import { setApiKeysCacheFromFirestore } from '../../config/apiKeys';

/** No-op: previously ran localStorage migrations. Firestore is the only data source. */
export function runPreAuthMigrations(): void {
  // No-op
}

/**
 * Runs migrations and post-auth setup that require an authenticated user.
 * Call in App when currentUser exists. Idempotent.
 */
export async function runPostAuthMigrations(): Promise<void> {
  try {
    await migrateCoreBoardToScoreBoard();
  } catch (error) {
    logger.warn('Firestore cache migration failed', {
      component: 'runMigrations',
      operation: 'migrateCoreBoardToScoreBoard',
      error,
    });
  }

  try {
    await runTruncatedCacheMigrations();
  } catch (error) {
    logger.warn('Firestore truncated cache migrations failed', {
      component: 'runMigrations',
      operation: 'runTruncatedCacheMigrations',
      error,
    });
  }

  try {
    const keys = await getApiKeysFromFirestore();
    if (keys) setApiKeysCacheFromFirestore(keys);
  } catch {
    // Ignore; getApiKeys() will use env fallback
  }
}

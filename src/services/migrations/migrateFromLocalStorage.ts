/**
 * Migrate from localStorage cache to Firestore cache.
 * Clears all localStorage cache entries on first load after migration.
 * Idempotent: uses flag 'cache:migrated-to-firestore' to skip if already run.
 */

import { logger } from '../../utils/logger';

const MIGRATION_FLAG = 'cache:migrated-to-firestore';

export function migrateFromLocalStorage(): void {
  try {
    if (localStorage.getItem(MIGRATION_FLAG)) {
      return; // Already migrated
    }

    const keysToRemove: string[] = ['currency_rates_usd'];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('cache:')) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
    localStorage.setItem(MIGRATION_FLAG, 'true');

    logger.info('Migrated from localStorage cache to Firestore cache', {
      component: 'migrateFromLocalStorage',
      operation: 'migrateFromLocalStorage',
      clearedKeys: keysToRemove.length,
    });
  } catch (error) {
    logger.warn('Failed to migrate from localStorage cache', {
      component: 'migrateFromLocalStorage',
      operation: 'migrateFromLocalStorage',
      error,
    });
  }
}

/**
 * Firestore Cache Service
 * 
 * Provides caching functionality with TTL (Time To Live) using Firebase Firestore.
 * Cache is shared between all authenticated users.
 * Uses Firestore collection "appCache" for centralized cache storage.
 */

import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc,
  collection,
  query,
  getDocs,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { logger } from '../utils/logger';
import { DeltaCacheEntry } from './cacheService';

// Re-export CACHE_KEYS for convenience
export { CACHE_KEYS } from './cacheKeys';
import { CACHE_KEYS } from './cacheKeys';

// Default TTL: 30 minutes
const DEFAULT_TTL_MINUTES = parseInt(import.meta.env.VITE_CACHE_DEFAULT_TTL_MINUTES || '30', 10);
export const DEFAULT_TTL = DEFAULT_TTL_MINUTES * 60 * 1000;

// Firestore collection name
const CACHE_COLLECTION = 'appCache';
const CACHE_PREFIX = 'cache:';

/**
 * Firestore cache entry interface (TTL-based)
 */
interface FirestoreCacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  lastUpdated?: Timestamp;
  version?: number; // Optional, for delta sync compatibility
  lastSnapshotAt?: number;
}

/**
 * Get document reference for cache key
 */
function getCacheDocRef(key: string) {
  // Remove 'cache:' prefix if present for cleaner document IDs
  const docId = key.startsWith(CACHE_PREFIX) ? key.slice(CACHE_PREFIX.length) : key;
  return doc(db, CACHE_COLLECTION, docId);
}

/**
 * Get cached data if it exists and is not expired
 * 
 * Retrieves cached data from Firestore. Supports both TTL-based and
 * version-based (delta sync) cache entries. Automatically checks expiration.
 * 
 * @template T - The type of data being retrieved
 * @param key - Cache key to retrieve data for
 * @returns Promise resolving to cached data, or null if not found, expired, or invalid
 * 
 * @example
 * ```typescript
 * // Check cache before fetching
 * const cachedData = await getCachedData<BenjaminGrahamData[]>(CACHE_KEYS.BENJAMIN_GRAHAM);
 * if (cachedData) {
 *   // Use cached data immediately
 *   setData(cachedData);
 * } else {
 *   // Fetch fresh data
 *   const freshData = await fetchBenjaminGrahamData();
 *   await setCachedData(CACHE_KEYS.BENJAMIN_GRAHAM, freshData);
 * }
 * ```
 */
export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const docRef = getCacheDocRef(key);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    const docData = docSnap.data();
    const now = Date.now();
    
    // Check if it's a delta cache entry (has version property)
    if (docData.version !== undefined) {
      const entry = docData as FirestoreCacheEntry<T>;
      
      // Check TTL fallback if provided
      if (entry.ttl && entry.timestamp) {
        const age = now - entry.timestamp;
        if (age > entry.ttl) {
          // Cache expired, try to delete it (may fail for non-editor users)
          await deleteDoc(docRef).catch(err => {
            // Only log if it's not a permission error (expected for non-editor users)
            const isPermissionError = err?.code === 'permission-denied' || 
                                      (err?.name === 'FirebaseError' && err?.code === 'permission-denied');
            if (!isPermissionError) {
              logger.warn('Failed to delete expired cache entry', { 
                component: 'firestoreCacheService', 
                operation: 'getCachedData', 
                key, 
                error: err 
              });
            }
          });
          return null;
        }
      }
      
      return entry.data;
    } else if (docData.timestamp && docData.ttl) {
      // TTL-based cache entry
      const entry = docData as FirestoreCacheEntry<T>;
      const age = now - entry.timestamp;
      
      // Check if cache is expired
      if (age > entry.ttl) {
        // Cache expired, try to delete it (may fail for non-editor users)
        await deleteDoc(docRef).catch(err => {
          // Only log if it's not a permission error (expected for non-editor users)
          const isPermissionError = err?.code === 'permission-denied' || 
                                    (err?.name === 'FirebaseError' && err?.code === 'permission-denied');
          if (!isPermissionError) {
            logger.warn('Failed to delete expired cache entry', { 
              component: 'firestoreCacheService', 
              operation: 'getCachedData', 
              key, 
              error: err 
            });
          }
        });
        return null;
      }
      
      return entry.data;
    }
    
    // Invalid cache entry structure
    logger.warn('Invalid cache entry structure', { 
      component: 'firestoreCacheService', 
      operation: 'getCachedData', 
      key 
    });
    return null;
  } catch (error) {
    logger.warn(`Failed to get cached data for key "${key}"`, { 
      component: 'firestoreCacheService', 
      operation: 'getCachedData', 
      key, 
      error 
    });
    return null;
  }
}

/**
 * Get delta cache entry with version information
 * 
 * Retrieves a delta cache entry including version information for delta sync.
 * This is used to determine the last known version when requesting incremental updates.
 * 
 * @template T - The type of data being retrieved
 * @param key - Cache key to retrieve delta cache entry for
 * @returns Promise resolving to delta cache entry with version info, or null if not found or expired
 */
export async function getDeltaCacheEntry<T>(key: string): Promise<DeltaCacheEntry<T> | null> {
  try {
    const docRef = getCacheDocRef(key);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    const docData = docSnap.data();
    const now = Date.now();
    
    // Check if it's a delta cache entry
    if (docData.version !== undefined) {
      const entry = docData as FirestoreCacheEntry<T>;
      
      // Check TTL fallback if provided
      if (entry.ttl && entry.timestamp) {
        const age = now - entry.timestamp;
        if (age > entry.ttl) {
          // Try to delete expired cache (may fail for non-editor users - that's OK)
          await deleteDoc(docRef).catch(() => {
            // Silently ignore deletion errors (permission errors are expected for non-editor users)
          });
          return null;
        }
      }
      
      return {
        data: entry.data,
        version: entry.version || 0,
        lastSnapshotAt: entry.lastSnapshotAt || entry.timestamp || now,
        lastUpdated: entry.timestamp || now,
        timestamp: entry.timestamp,
        ttl: entry.ttl,
      };
    }
    
    return null;
  } catch (error) {
    logger.warn(`Failed to get delta cache entry for key "${key}"`, { 
      component: 'firestoreCacheService', 
      operation: 'getDeltaCacheEntry', 
      key, 
      error 
    });
    return null;
  }
}

/**
 * Get last version from cache
 * 
 * Convenience function to get the last version number from a delta cache entry.
 * Returns 0 if no cache entry exists, indicating a full sync is needed.
 * 
 * @param key - Cache key to get last version for
 * @returns Promise resolving to last version number (changeId), or 0 if not found
 */
export async function getLastVersion(key: string): Promise<number> {
  const entry = await getDeltaCacheEntry(key);
  return entry?.version || 0;
}

/**
 * Set data in cache with TTL
 * 
 * Stores data in Firestore with a time-to-live (TTL) expiration.
 * 
 * @template T - The type of data being cached
 * @param key - Cache key to store data under
 * @param data - Data to cache
 * @param ttl - Time to live in milliseconds (default: DEFAULT_TTL)
 * 
 * @example
 * ```typescript
 * const data = await fetchBenjaminGrahamData();
 * await setCachedData(CACHE_KEYS.BENJAMIN_GRAHAM, data, DEFAULT_TTL);
 * ```
 */
export async function setCachedData<T>(key: string, data: T, ttl: number = DEFAULT_TTL): Promise<void> {
  try {
    const docRef = getCacheDocRef(key);
    const now = Date.now();
    
    // Determine data size for logging
    const dataSize = Array.isArray(data) ? data.length : 'unknown';
    
    logger.debug('Saving data to Firestore cache', { 
      component: 'firestoreCacheService', 
      operation: 'setCachedData', 
      key,
      dataSize,
      ttlMinutes: Math.round(ttl / 60000)
    });
    
    const entry: FirestoreCacheEntry<T> = {
      data,
      timestamp: now,
      ttl,
      lastUpdated: serverTimestamp() as any, // Firestore will convert this
    };
    
    await setDoc(docRef, entry, { merge: false });
    
    logger.info('Data saved to Firestore cache successfully', { 
      component: 'firestoreCacheService', 
      operation: 'setCachedData', 
      key,
      dataSize,
      ttlMinutes: Math.round(ttl / 60000)
    });
  } catch (error) {
    logger.error(`Failed to set cached data for key "${key}"`, { 
      component: 'firestoreCacheService', 
      operation: 'setCachedData', 
      key, 
      error 
    });
    throw error;
  }
}

/**
 * Set delta cache entry with version information
 * 
 * Stores data in Firestore with version information for delta sync support.
 * Tracks whether the entry is a full snapshot or an incremental update.
 * 
 * @template T - The type of data being cached
 * @param key - Cache key to store data under
 * @param data - Data to cache
 * @param version - Current version (changeId) from the server
 * @param isSnapshot - Whether this is a full snapshot (true) or incremental update (false)
 * @param ttl - Optional TTL for fallback compatibility with legacy cache
 */
export async function setDeltaCacheEntry<T>(
  key: string,
  data: T,
  version: number,
  isSnapshot: boolean = false,
  ttl?: number
): Promise<void> {
  try {
    const docRef = getCacheDocRef(key);
    const now = Date.now();
    
    // Get existing entry to preserve lastSnapshotAt if not a snapshot
    const existing = await getDeltaCacheEntry<T>(key);
    
    const entry: FirestoreCacheEntry<T> = {
      data,
      version,
      timestamp: ttl ? now : undefined,
      ttl,
      lastSnapshotAt: isSnapshot ? now : (existing?.lastSnapshotAt || now),
      lastUpdated: serverTimestamp() as any, // Firestore will convert this
    };
    
    await setDoc(docRef, entry, { merge: false });
  } catch (error) {
    logger.warn(`Failed to set delta cache entry for key "${key}"`, { 
      component: 'firestoreCacheService', 
      operation: 'setDeltaCacheEntry', 
      key, 
      error 
    });
    throw error;
  }
}

/**
 * Get cache age in milliseconds
 * 
 * Returns the age of a cache entry in milliseconds, or null if the cache
 * doesn't exist or is invalid.
 * 
 * @param key - Cache key to get age for
 * @returns Promise resolving to cache age in milliseconds, or null if not found
 */
export async function getCacheAge(key: string): Promise<number | null> {
  try {
    const docRef = getCacheDocRef(key);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    const docData = docSnap.data();
    const now = Date.now();
    
    // Check if it's a delta cache entry
    if (docData.version !== undefined) {
      const entry = docData as FirestoreCacheEntry<unknown>;
      if (entry.timestamp) {
        return now - entry.timestamp;
      }
      // Fallback to lastUpdated if timestamp not available
      if (entry.lastUpdated) {
        const lastUpdated = entry.lastUpdated as Timestamp;
        return now - lastUpdated.toMillis();
      }
      return null;
    } else if (docData.timestamp) {
      // TTL-based cache entry
      return now - docData.timestamp;
    }
    
    return null;
  } catch (error) {
    logger.warn(`Failed to get cache age for key "${key}"`, { 
      component: 'firestoreCacheService', 
      operation: 'getCacheAge', 
      key, 
      error 
    });
    return null;
  }
}

/**
 * Generic helper: migrate a wrongly named cache document to the correct document ID.
 * Used for one-time migrations (e.g. eIndustry -> peIndustry) from substring(8) bug.
 * Not exported.
 */
async function migrateCacheDocument(
  oldDocId: string,
  cacheKey: string,
  migrationFlag: string
): Promise<boolean> {
  try {
    if (localStorage.getItem(migrationFlag) === 'true') {
      return true;
    }
  } catch (error) {
    logger.warn('Could not check migration flag', {
      component: 'firestoreCacheService',
      operation: 'migrateCacheDocument',
      oldDocId,
      migrationFlag,
      error,
    });
  }

  try {
    const oldRef = doc(db, CACHE_COLLECTION, oldDocId);
    const oldSnap = await getDoc(oldRef);

    if (!oldSnap.exists()) {
      try {
        localStorage.setItem(migrationFlag, 'true');
      } catch {
        /* ignore */
      }
      return true;
    }

    const oldData = oldSnap.data() as FirestoreCacheEntry<unknown>;
    const correctRef = getCacheDocRef(cacheKey);
    const correctSnap = await getDoc(correctRef);

    if (correctSnap.exists()) {
      try {
        await deleteDoc(oldRef);
        logger.info('Deleted old cache document (correct document already exists)', {
          component: 'firestoreCacheService',
          operation: 'migrateCacheDocument',
          oldDocId,
          cacheKey,
        });
      } catch (deleteError: unknown) {
        const err = deleteError as { code?: string; name?: string };
        const isPermissionError =
          err?.code === 'permission-denied' ||
          (err?.name === 'FirebaseError' && err?.code === 'permission-denied');
        if (isPermissionError) {
          logger.warn('Could not delete old document (insufficient permissions). Migration will be retried later.', {
            component: 'firestoreCacheService',
            operation: 'migrateCacheDocument',
            oldDocId,
          });
          return true;
        }
        logger.error('Failed to delete old cache document', deleteError, {
          component: 'firestoreCacheService',
          operation: 'migrateCacheDocument',
          oldDocId,
          cacheKey,
        });
        return false;
      }
    } else {
      try {
        if (oldData.version !== undefined) {
          await setDeltaCacheEntry(
            cacheKey,
            oldData.data,
            oldData.version ?? 0,
            oldData.lastSnapshotAt !== undefined,
            oldData.ttl
          );
        } else {
          await setCachedData(cacheKey, oldData.data, oldData.ttl ?? DEFAULT_TTL);
        }

        try {
          await deleteDoc(oldRef);
          logger.info('Migrated cache document to correct ID and deleted old document', {
            component: 'firestoreCacheService',
            operation: 'migrateCacheDocument',
            oldDocId,
            cacheKey,
          });
        } catch (deleteError: unknown) {
          const err = deleteError as { code?: string; name?: string };
          const isPermissionError =
            err?.code === 'permission-denied' ||
            (err?.name === 'FirebaseError' && err?.code === 'permission-denied');
          if (isPermissionError) {
            logger.warn('Migrated but could not delete old document (insufficient permissions). Migration will be retried later.', {
              component: 'firestoreCacheService',
              operation: 'migrateCacheDocument',
              oldDocId,
              cacheKey,
            });
            return true;
          }
          logger.error('Migrated but failed to delete old document', deleteError, {
            component: 'firestoreCacheService',
            operation: 'migrateCacheDocument',
            oldDocId,
            cacheKey,
          });
          return true;
        }
      } catch (copyError) {
        logger.error('Failed to copy cache document to correct ID', copyError, {
          component: 'firestoreCacheService',
          operation: 'migrateCacheDocument',
          oldDocId,
          cacheKey,
        });
        return false;
      }
    }

    try {
      localStorage.setItem(migrationFlag, 'true');
    } catch {
      /* ignore */
    }
    return true;
  } catch (error) {
    logger.error('Failed to migrate cache document', error, {
      component: 'firestoreCacheService',
      operation: 'migrateCacheDocument',
      oldDocId,
      cacheKey,
      migrationFlag,
    });
    return false;
  }
}

/**
 * Migrate cache from coreBoard to scoreBoard
 * 
 * This function migrates data from the incorrectly named 'coreBoard' document
 * to the correct 'scoreBoard' document in Firestore. This is a one-time migration
 * that runs automatically on app start.
 * 
 * Migration logic:
 * - If coreBoard exists and scoreBoard doesn't: copy coreBoard to scoreBoard, then delete coreBoard
 * - If both exist: keep scoreBoard (it's the correct one), delete coreBoard
 * - If neither exists: nothing to migrate
 * 
 * @returns Promise resolving to true if migration succeeded or was already done, false on error
 */
export async function migrateCoreBoardToScoreBoard(): Promise<boolean> {
  const MIGRATION_FLAG = 'firestore:migration:coreBoard-to-scoreBoard';
  
  // Check if migration already completed
  try {
    if (localStorage.getItem(MIGRATION_FLAG) === 'true') {
      return true; // Already migrated
    }
  } catch (error) {
    // If localStorage is not available, continue anyway
    logger.warn('Could not check migration flag', {
      component: 'firestoreCacheService',
      operation: 'migrateCoreBoardToScoreBoard',
      error,
    });
  }

  try {
    const coreBoardRef = doc(db, CACHE_COLLECTION, 'coreBoard');
    const scoreBoardRef = doc(db, CACHE_COLLECTION, 'scoreBoard');
    
    // Check if coreBoard exists
    const coreBoardSnap = await getDoc(coreBoardRef);
    
    if (!coreBoardSnap.exists()) {
      // No coreBoard to migrate, mark as done
      try {
        localStorage.setItem(MIGRATION_FLAG, 'true');
      } catch {
        // Ignore localStorage errors
      }
      return true; // Nothing to migrate
    }

    const coreBoardData = coreBoardSnap.data() as FirestoreCacheEntry<unknown>;
    
    // Check if scoreBoard already exists
    const scoreBoardSnap = await getDoc(scoreBoardRef);
    
    if (scoreBoardSnap.exists()) {
      // scoreBoard already exists (correct name), just delete coreBoard
      try {
        await deleteDoc(coreBoardRef);
        logger.info('Deleted old coreBoard document (scoreBoard already exists)', {
          component: 'firestoreCacheService',
          operation: 'migrateCoreBoardToScoreBoard',
        });
      } catch (deleteError: any) {
        // Check if it's a permission error
        const isPermissionError = deleteError?.code === 'permission-denied' || 
                                  (deleteError?.name === 'FirebaseError' && deleteError?.code === 'permission-denied');
        
        if (isPermissionError) {
          logger.warn('Could not delete coreBoard (insufficient permissions). Migration will be retried later.', {
            component: 'firestoreCacheService',
            operation: 'migrateCoreBoardToScoreBoard',
          });
          // Don't set flag - allow retry later
          return true; // Not a critical error
        }
        
        // Other error
        logger.error('Failed to delete coreBoard document', deleteError, {
          component: 'firestoreCacheService',
          operation: 'migrateCoreBoardToScoreBoard',
        });
        return false;
      }
    } else {
      // scoreBoard doesn't exist, copy coreBoard to scoreBoard
      try {
        // Determine cache type and copy accordingly
        if (coreBoardData.version !== undefined) {
          // Delta cache entry
          await setDeltaCacheEntry(
            CACHE_KEYS.SCORE_BOARD,
            coreBoardData.data,
            coreBoardData.version || 0,
            coreBoardData.lastSnapshotAt !== undefined,
            coreBoardData.ttl
          );
        } else {
          // TTL-based cache entry
          await setCachedData(
            CACHE_KEYS.SCORE_BOARD,
            coreBoardData.data,
            coreBoardData.ttl || DEFAULT_TTL
          );
        }
        
        // Now delete coreBoard
        try {
          await deleteDoc(coreBoardRef);
          logger.info('Migrated coreBoard to scoreBoard and deleted old document', {
            component: 'firestoreCacheService',
            operation: 'migrateCoreBoardToScoreBoard',
          });
        } catch (deleteError: any) {
          // Check if it's a permission error
          const isPermissionError = deleteError?.code === 'permission-denied' || 
                                    (deleteError?.name === 'FirebaseError' && deleteError?.code === 'permission-denied');
          
          if (isPermissionError) {
            logger.warn('Migrated coreBoard to scoreBoard but could not delete old document (insufficient permissions). Migration will be retried later.', {
              component: 'firestoreCacheService',
              operation: 'migrateCoreBoardToScoreBoard',
            });
            // Don't set flag - allow retry later
            return true; // Migration succeeded, deletion can be done later
          }
          
          // Other error
          logger.error('Migrated coreBoard to scoreBoard but failed to delete old document', deleteError, {
            component: 'firestoreCacheService',
            operation: 'migrateCoreBoardToScoreBoard',
          });
          // Still return true since migration succeeded
        }
      } catch (copyError) {
        logger.error('Failed to copy coreBoard to scoreBoard', copyError, {
          component: 'firestoreCacheService',
          operation: 'migrateCoreBoardToScoreBoard',
        });
        return false;
      }
    }
    
    // Mark migration as complete
    try {
      localStorage.setItem(MIGRATION_FLAG, 'true');
    } catch {
      // Ignore localStorage errors
    }
    
    return true;
  } catch (error) {
    logger.error('Failed to migrate coreBoard to scoreBoard', error, {
      component: 'firestoreCacheService',
      operation: 'migrateCoreBoardToScoreBoard',
    });
    return false;
  }
}

/**
 * Migrate eIndustry -> peIndustry (truncated cache doc ID from substring(8) bug).
 */
export async function migrateEIndustryToPeIndustry(): Promise<boolean> {
  return migrateCacheDocument(
    'eIndustry',
    CACHE_KEYS.PE_INDUSTRY,
    'firestore:migration:eIndustry-to-peIndustry'
  );
}

/**
 * Migrate enjaminGraham -> benjaminGraham (truncated cache doc ID from substring(8) bug).
 */
export async function migrateEnjaminGrahamToBenjaminGraham(): Promise<boolean> {
  return migrateCacheDocument(
    'enjaminGraham',
    CACHE_KEYS.BENJAMIN_GRAHAM,
    'firestore:migration:enjaminGraham-to-benjaminGraham'
  );
}

/**
 * Migrate ma -> sma (truncated cache doc ID from substring(8) bug).
 */
export async function migrateMaToSma(): Promise<boolean> {
  return migrateCacheDocument('ma', CACHE_KEYS.SMA, 'firestore:migration:ma-to-sma');
}

/**
 * Run all truncated-cache-document migrations (eIndustry, enjaminGraham, ma).
 * Call at app start after auth, alongside migrateCoreBoardToScoreBoard.
 */
export async function runTruncatedCacheMigrations(): Promise<void> {
  await migrateEIndustryToPeIndustry();
  await migrateEnjaminGrahamToBenjaminGraham();
  await migrateMaToSma();
}

/**
 * Clear cache for a specific key or all cache entries
 * 
 * Removes cache entries from Firestore. If a key is provided, only that
 * entry is removed. If no key is provided, all cache entries are removed.
 * 
 * Note: Cache clearing requires editor/admin permissions. If the user doesn't
 * have permission, this function will silently fail (cache will expire via TTL anyway).
 * 
 * @param key - Optional cache key to clear. If not provided, clears all cache entries
 */
export async function clearCache(key?: string): Promise<void> {
  try {
    if (key) {
      const docRef = getCacheDocRef(key);
      logger.debug('Clearing specific cache entry', { 
        component: 'firestoreCacheService', 
        operation: 'clearCache', 
        key 
      });
      await deleteDoc(docRef);
      logger.info('Cache entry cleared successfully', { 
        component: 'firestoreCacheService', 
        operation: 'clearCache', 
        key 
      });
    } else {
      // Clear all cache entries
      logger.debug('Clearing all cache entries from Firestore', { 
        component: 'firestoreCacheService', 
        operation: 'clearCache' 
      });
      const cacheCollection = collection(db, CACHE_COLLECTION);
      const q = query(cacheCollection);
      const querySnapshot = await getDocs(q);
      
      const docCount = querySnapshot.docs.length;
      logger.info(`Found ${docCount} cache entries to clear`, { 
        component: 'firestoreCacheService', 
        operation: 'clearCache',
        docCount 
      });
      
      if (docCount === 0) {
        logger.debug('No cache entries found to clear', { 
          component: 'firestoreCacheService', 
          operation: 'clearCache' 
        });
        return;
      }
      
      const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
      const deleteResults = await Promise.allSettled(deletePromises);
      
      // Count successful and failed deletions
      const successful = deleteResults.filter(r => r.status === 'fulfilled').length;
      const failed = deleteResults.filter(r => r.status === 'rejected').length;
      
      logger.info('Cache clearing completed', { 
        component: 'firestoreCacheService', 
        operation: 'clearCache',
        total: docCount,
        successful,
        failed 
      });
      
      if (failed > 0) {
        const failedDocs = deleteResults
          .map((result, index) => result.status === 'rejected' ? querySnapshot.docs[index].id : null)
          .filter(Boolean);
        logger.warn('Some cache entries failed to delete', { 
          component: 'firestoreCacheService', 
          operation: 'clearCache',
          failedCount: failed,
          failedDocs 
        });
      }
    }
  } catch (error: any) {
    // Check if this is a permission-denied error
    // This is expected for non-editor users (viewer1, viewer2)
    // Cache will expire naturally via TTL, so this is not critical
    const isPermissionError = error?.code === 'permission-denied' || 
                              (error?.name === 'FirebaseError' && error?.code === 'permission-denied');
    
    if (isPermissionError) {
      // Log permission errors at info level so they're visible during refresh
      logger.info('Cache clear skipped (insufficient permissions - cache will expire via TTL)', { 
        component: 'firestoreCacheService', 
        operation: 'clearCache', 
        key,
        note: 'This is expected for non-editor users. Cache will expire naturally via TTL.'
      });
      return; // Don't throw - this is expected for non-editor users
    }
    
    // For other errors, log a warning but don't throw
    // Cache clearing is not critical to app functionality
    logger.warn('Failed to clear cache', { 
      component: 'firestoreCacheService', 
      operation: 'clearCache', 
      key, 
      error 
    });
    // Don't throw - allow refresh to continue even if cache clear fails
  }
}

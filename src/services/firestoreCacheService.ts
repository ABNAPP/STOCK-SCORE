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
export { CACHE_KEYS } from './cacheService';

// Default TTL: 3 hours (180 minutes)
const DEFAULT_TTL_MINUTES = parseInt(import.meta.env.VITE_CACHE_DEFAULT_TTL_MINUTES || '180', 10);
export const DEFAULT_TTL = DEFAULT_TTL_MINUTES * 60 * 1000;

// Firestore collection name
const CACHE_COLLECTION = 'appCache';

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
  const docId = key.startsWith('cache:') ? key.substring(7) : key;
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
    
    const entry: FirestoreCacheEntry<T> = {
      data,
      timestamp: now,
      ttl,
      lastUpdated: serverTimestamp() as any, // Firestore will convert this
    };
    
    await setDoc(docRef, entry, { merge: false });
  } catch (error) {
    logger.warn(`Failed to set cached data for key "${key}"`, { 
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
      await deleteDoc(docRef);
    } else {
      // Clear all cache entries
      const cacheCollection = collection(db, CACHE_COLLECTION);
      const q = query(cacheCollection);
      const querySnapshot = await getDocs(q);
      
      const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
      await Promise.all(deletePromises);
    }
  } catch (error: any) {
    // Check if this is a permission-denied error
    // This is expected for non-editor users (viewer1, viewer2)
    // Cache will expire naturally via TTL, so this is not critical
    const isPermissionError = error?.code === 'permission-denied' || 
                              (error?.name === 'FirebaseError' && error?.code === 'permission-denied');
    
    if (isPermissionError) {
      // Silently handle permission errors - cache will expire via TTL anyway
      logger.debug('Cache clear skipped (insufficient permissions - cache will expire via TTL)', { 
        component: 'firestoreCacheService', 
        operation: 'clearCache', 
        key 
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

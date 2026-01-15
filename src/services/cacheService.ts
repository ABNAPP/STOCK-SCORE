/**
 * Cache Service
 * 
 * Provides caching functionality with TTL (Time To Live) and version-based caching for delta sync.
 * Uses localStorage to cache data and reduce network requests.
 */

import { logger } from '../utils/logger';
import { isCacheEntry, isDeltaCacheEntry } from '../utils/typeGuards';
import { deflate, inflate } from 'pako';

/**
 * Legacy cache interface (TTL-based)
 * 
 * Used for traditional time-to-live based caching where entries expire
 * after a certain amount of time.
 * 
 * @template T - The type of data being cached
 */
interface CacheEntry<T> {
  /** The cached data */
  data: T;
  /** Timestamp when the data was cached (milliseconds since epoch) */
  timestamp: number;
  /** Time to live in milliseconds - cache expires after this duration */
  ttl: number;
}

/**
 * Delta sync cache interface (version-based)
 * 
 * Used for version-based caching with delta sync, where entries are
 * identified by version numbers and can be incrementally updated.
 * 
 * @template T - The type of data being cached
 */
export interface DeltaCacheEntry<T> {
  /** The cached data */
  data: T;
  /** Last changeId/version number - used for delta sync */
  version: number;
  /** Timestamp of last full snapshot (milliseconds since epoch) */
  lastSnapshotAt: number;
  /** Timestamp of last update (milliseconds since epoch) */
  lastUpdated: number;
  /** Legacy: timestamp for TTL fallback compatibility */
  timestamp?: number;
  /** Optional TTL for fallback compatibility with legacy cache */
  ttl?: number;
}

// Cache keys for different data types
export const CACHE_KEYS = {
  BENJAMIN_GRAHAM: 'cache:benjaminGraham',
  SMA: 'cache:sma',
  PE_INDUSTRY: 'cache:peIndustry',
  SCORE_BOARD: 'cache:scoreBoard',
  THRESHOLD_INDUSTRY: 'cache:thresholdIndustry',
} as const;

// Default TTL: Configurable via environment variable, default 20 minutes
const DEFAULT_TTL_MINUTES = parseInt(import.meta.env.VITE_CACHE_DEFAULT_TTL_MINUTES || '20', 10);
export const DEFAULT_TTL = DEFAULT_TTL_MINUTES * 60 * 1000;

// Fresh threshold: Configurable via environment variable, default 5 minutes
const FRESH_THRESHOLD_MINUTES = parseInt(import.meta.env.VITE_CACHE_FRESH_THRESHOLD_MINUTES || '5', 10);
export const FRESH_THRESHOLD_MS = FRESH_THRESHOLD_MINUTES * 60 * 1000;

// Cache statistics storage key
const STATS_STORAGE_KEY = 'cache:stats';

// LRU order storage key
const LRU_ORDER_STORAGE_KEY = 'cache:lru:order';

// Maximum cache size (8 MB in bytes)
const MAX_CACHE_SIZE_BYTES = 8 * 1024 * 1024;

// Quota warning threshold (80%)
const QUOTA_WARNING_THRESHOLD = 0.8;

// Cache statistics interface
export interface CacheStats {
  hits: Record<string, number>;
  misses: Record<string, number>;
  sizes: Record<string, number>; // Size in bytes (approximate)
  lastAccessed: Record<string, number>; // Timestamp of last access
}

/**
 * Get cache statistics
 * 
 * Retrieves overall cache statistics including hits, misses, sizes, and last access times
 * for all cached entries. Statistics are stored in localStorage.
 * 
 * @returns Cache statistics object with hits, misses, sizes, and lastAccessed records
 * 
 * @example
 * ```typescript
 * const stats = getCacheStats();
 * console.log(`Total hits: ${Object.values(stats.hits).reduce((a, b) => a + b, 0)}`);
 * ```
 */
export function getCacheStats(): CacheStats {
  try {
    const statsJson = localStorage.getItem(STATS_STORAGE_KEY);
    if (statsJson) {
      return JSON.parse(statsJson);
    }
  } catch (error) {
    logger.warn('Failed to load cache statistics', { component: 'cacheService', operation: 'getCacheStats', error });
  }
  
  return {
    hits: {},
    misses: {},
    sizes: {},
    lastAccessed: {},
  };
}

/**
 * Get LRU order (list of cache keys in order of access, most recent first)
 */
function getLRUOrder(): string[] {
  try {
    const orderJson = localStorage.getItem(LRU_ORDER_STORAGE_KEY);
    if (orderJson) {
      return JSON.parse(orderJson);
    }
  } catch (error) {
    logger.warn('Failed to load LRU order', { component: 'cacheService', operation: 'getLRUOrder', error });
  }
  return [];
}

/**
 * Update LRU order - move key to front (most recently used)
 */
function updateLRUOrder(key: string): void {
  try {
    const order = getLRUOrder();
    // Remove key if it exists
    const index = order.indexOf(key);
    if (index > -1) {
      order.splice(index, 1);
    }
    // Add to front (most recently used)
    order.unshift(key);
    localStorage.setItem(LRU_ORDER_STORAGE_KEY, JSON.stringify(order));
  } catch (error) {
    // Silently fail - LRU order is not critical
    if (import.meta.env.DEV) {
      logger.warn('Failed to update LRU order', { component: 'cacheService', operation: 'updateLRUOrder', error });
    }
  }
}

/**
 * Remove key from LRU order
 */
function removeFromLRUOrder(key: string): void {
  try {
    const order = getLRUOrder();
    const index = order.indexOf(key);
    if (index > -1) {
      order.splice(index, 1);
      localStorage.setItem(LRU_ORDER_STORAGE_KEY, JSON.stringify(order));
    }
  } catch (error) {
    // Silently fail
    if (import.meta.env.DEV) {
      logger.warn('Failed to remove from LRU order', { component: 'cacheService', operation: 'removeFromLRUOrder', error });
    }
  }
}

/**
 * Compress JSON string using gzip (pako)
 * Returns base64-encoded compressed string with compression marker
 */
function compressData(data: string): string {
  try {
    // Convert string to Uint8Array for compression
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(data);
    const compressed = deflate(uint8Array);
    
    // Convert compressed Uint8Array to base64 string
    const binaryString = String.fromCharCode(...compressed);
    const base64 = btoa(binaryString);
    
    // Add compression marker prefix
    return 'gz:' + base64;
  } catch (error) {
    logger.warn('Failed to compress data, storing uncompressed', { component: 'cacheService', operation: 'compressData', error });
    return data; // Fallback to uncompressed
  }
}

/**
 * Decompress base64-encoded gzip string
 * Returns decompressed JSON string
 */
function decompressData(compressedData: string): string {
  try {
    // Check if data is compressed (has 'gz:' prefix)
    if (compressedData.startsWith('gz:')) {
      const base64 = compressedData.slice(3); // Remove 'gz:' prefix
      const binaryString = atob(base64);
      const uint8Array = Uint8Array.from(binaryString, c => c.charCodeAt(0));
      const decompressed = inflate(uint8Array);
      
      // Convert decompressed Uint8Array back to string
      const decoder = new TextDecoder();
      return decoder.decode(decompressed);
    }
    
    // Not compressed, return as-is
    return compressedData;
  } catch (error) {
    // If decompression fails, assume it's uncompressed JSON (for backward compatibility)
    logger.warn('Failed to decompress data, assuming uncompressed', { component: 'cacheService', operation: 'decompressData', error });
    return compressedData.startsWith('gz:') ? compressedData.slice(3) : compressedData;
  }
}

/**
 * Check localStorage quota usage
 * Returns usage as a percentage (0-1) or null if quota cannot be determined
 */
export function checkQuotaUsage(): number | null {
  try {
    // Try to estimate quota usage by checking if we can store a test string
    // This is an approximation since browsers don't expose quota directly
    const testKey = '__quota_test__';
    const testData = 'x'.repeat(1024); // 1KB test
    
    try {
      localStorage.setItem(testKey, testData);
      localStorage.removeItem(testKey);
      
      // Calculate approximate usage from cache stats
      const totalSize = getTotalCacheSize();
      // Estimate localStorage limit (typically 5-10MB, use 10MB as conservative estimate)
      const estimatedQuota = 10 * 1024 * 1024;
      return Math.min(1, totalSize / estimatedQuota);
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        return 1; // Quota exceeded
      }
      return null;
    }
  } catch (error) {
    return null;
  }
}

/**
 * Warn if quota usage exceeds threshold
 */
function warnOnQuotaThreshold(threshold: number = QUOTA_WARNING_THRESHOLD): void {
  const usage = checkQuotaUsage();
  if (usage !== null && usage >= threshold) {
    const percentage = (usage * 100).toFixed(1);
    logger.warn(`localStorage quota usage is at ${percentage}%`, {
      component: 'cacheService',
      operation: 'warnOnQuotaThreshold',
      usage,
      threshold,
    });
  }
}

/**
 * Evict least recently used cache entries until size is below limit
 * 
 * **LRU Eviction Strategy:**
 * - Why LRU? Most recently used data is likely to be needed again soon
 * - Evicts from least recently used (end of LRU order array) first
 * - Evicts until size is at 70% of target (leaves headroom for new entries)
 * - Preserves stats and LRU order keys (they're small and needed for operation)
 * 
 * **Edge Case: localStorage quota exceeded**
 * - If quota is exceeded, this function is called aggressively (50% of max size)
 * - Ensures app continues functioning even when storage is full
 * - Silent eviction - doesn't show errors to user
 */
function evictLRUEntries(targetSizeBytes: number = MAX_CACHE_SIZE_BYTES): void {
  try {
    const stats = getCacheStats();
    const order = getLRUOrder();
    let currentSize = getTotalCacheSize();
    
    if (currentSize <= targetSizeBytes) {
      return;
    }
    
    // Evict from least recently used (end of array) until size is acceptable
    // Leave some headroom (evict until we're at 70% of target)
    const evictionTarget = targetSizeBytes * 0.7;
    
    for (let i = order.length - 1; i >= 0 && currentSize > evictionTarget; i--) {
      const key = order[i];
      
      // Skip stats and LRU order keys
      if (key === STATS_STORAGE_KEY || key === LRU_ORDER_STORAGE_KEY) {
        continue;
      }
      
      // Skip non-cache keys
      if (!key.startsWith('cache:')) {
        continue;
      }
      
      // Remove the cache entry
      localStorage.removeItem(key);
      
      // Update size estimate
      const entrySize = stats.sizes[key] || 0;
      currentSize -= entrySize;
      
      // Remove from stats
      delete stats.hits[key];
      delete stats.misses[key];
      delete stats.sizes[key];
      delete stats.lastAccessed[key];
      
      // Remove from LRU order
      order.splice(i, 1);
    }
    
    // Save updated stats and order
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
    localStorage.setItem(LRU_ORDER_STORAGE_KEY, JSON.stringify(order));
    
    if (order.length < getLRUOrder().length) {
      logger.debug('Evicted cache entries due to size limit', {
        component: 'cacheService',
        operation: 'evictLRUEntries',
        remainingSize: currentSize,
        targetSize: targetSizeBytes,
      });
    }
  } catch (error) {
    logger.warn('Failed to evict LRU entries', { component: 'cacheService', operation: 'evictLRUEntries', error });
  }
}

/**
 * Update cache statistics
 */
function updateCacheStats(
  key: string,
  type: 'hit' | 'miss',
  size?: number
): void {
  try {
    const stats = getCacheStats();
    
    if (type === 'hit') {
      stats.hits[key] = (stats.hits[key] || 0) + 1;
    } else {
      stats.misses[key] = (stats.misses[key] || 0) + 1;
    }
    
    stats.lastAccessed[key] = Date.now();
    
    if (size !== undefined) {
      stats.sizes[key] = size;
    }
    
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch (error) {
    // Silently fail - stats are not critical
    if (import.meta.env.DEV) {
      logger.warn('Failed to update cache statistics', { component: 'cacheService', operation: 'updateCacheStats', error });
    }
  }
}

/**
 * Get cache statistics for a specific key
 * 
 * Retrieves detailed statistics for a specific cache key including hit rate,
 * total hits/misses, cache size, and last access time.
 * 
 * @param key - The cache key to get statistics for
 * @returns Object containing hits, misses, hitRate (%), size (bytes), and lastAccessed timestamp
 * 
 * @example
 * ```typescript
 * const stats = getCacheStatsForKey(CACHE_KEYS.BENJAMIN_GRAHAM);
 * console.log(`Hit rate: ${stats.hitRate}%`);
 * console.log(`Cache size: ${stats.size} bytes`);
 * ```
 */
export function getCacheStatsForKey(key: string): {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  lastAccessed: number | null;
} {
  const stats = getCacheStats();
  
  const hits = stats.hits[key] || 0;
  const misses = stats.misses[key] || 0;
  const total = hits + misses;
  const hitRate = total > 0 ? (hits / total) * 100 : 0;
  
  return {
    hits,
    misses,
    hitRate: Math.round(hitRate * 100) / 100, // Round to 2 decimal places
    size: stats.sizes[key] || 0,
    lastAccessed: stats.lastAccessed[key] || null,
  };
}

/**
 * Get total cache size (approximate, in bytes)
 * 
 * Calculates the total size of all cached entries by summing up individual cache sizes.
 * This is an approximation as it doesn't account for localStorage overhead.
 * 
 * @returns Total cache size in bytes (approximate)
 * 
 * @example
 * ```typescript
 * const totalSize = getTotalCacheSize();
 * console.log(`Total cache: ${(totalSize / 1024).toFixed(2)} KB`);
 * ```
 */
export function getTotalCacheSize(): number {
  const stats = getCacheStats();
  return Object.values(stats.sizes).reduce((sum, size) => sum + size, 0);
}

/**
 * Reset cache statistics
 * 
 * Resets cache statistics for a specific key or all keys.
 * If no key is provided, all statistics are cleared.
 * 
 * @param key - Optional cache key to reset statistics for. If not provided, resets all statistics
 * 
 * @example
 * ```typescript
 * // Reset statistics for a specific key
 * resetCacheStats(CACHE_KEYS.BENJAMIN_GRAHAM);
 * 
 * // Reset all statistics
 * resetCacheStats();
 * ```
 */
export function resetCacheStats(key?: string): void {
  try {
    if (key) {
      const stats = getCacheStats();
      delete stats.hits[key];
      delete stats.misses[key];
      delete stats.sizes[key];
      delete stats.lastAccessed[key];
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
    } else {
      localStorage.removeItem(STATS_STORAGE_KEY);
    }
  } catch (error) {
    logger.warn('Failed to reset cache statistics', { component: 'cacheService', operation: 'resetCacheStats', error });
  }
}

/**
 * Get cached data if it exists and is not expired
 * 
 * Retrieves cached data from localStorage. Supports both TTL-based (legacy) and
 * version-based (delta sync) cache entries. Automatically removes expired entries
 * and updates cache statistics.
 * 
 * @template T - The type of data being retrieved
 * @param key - Cache key to retrieve data for
 * @returns Cached data, or null if not found, expired, or invalid
 * 
 * @example
 * ```typescript
 * // Check cache before fetching
 * const cachedData = getCachedData<BenjaminGrahamData[]>(CACHE_KEYS.BENJAMIN_GRAHAM);
 * if (cachedData) {
 *   // Use cached data immediately (no loading state)
 *   setData(cachedData);
 * } else {
 *   // Fetch fresh data
 *   const freshData = await fetchBenjaminGrahamData();
 *   setCachedData(CACHE_KEYS.BENJAMIN_GRAHAM, freshData);
 * }
 * ```
 */
export function getCachedData<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) {
      updateCacheStats(key, 'miss');
      return null;
    }

    // Decompress data if compressed
    const decompressed = decompressData(cached);
    const cachedSize = new Blob([cached]).size;
    const parsed = JSON.parse(decompressed);
    const now = Date.now();

    // Check if it's a delta cache entry (has version property)
    if (isDeltaCacheEntry<T>(parsed)) {
      const entry = parsed;
      
      // Check TTL fallback if provided
      if (entry.ttl && entry.timestamp) {
        const age = now - entry.timestamp;
        if (age > entry.ttl) {
          localStorage.removeItem(key);
          removeFromLRUOrder(key);
          updateCacheStats(key, 'miss');
          return null;
        }
      }
      
      // Update LRU order (mark as recently used)
      updateLRUOrder(key);
      updateCacheStats(key, 'hit', cachedSize);
      return entry.data;
    } else if (isCacheEntry<T>(parsed)) {
      // Legacy TTL-based cache entry
      const entry = parsed;
      const age = now - entry.timestamp;

      // Check if cache is expired
      if (age > entry.ttl) {
        // Cache expired, remove it
        localStorage.removeItem(key);
        removeFromLRUOrder(key);
        updateCacheStats(key, 'miss');
        return null;
      }

      // Update LRU order (mark as recently used)
      updateLRUOrder(key);
      updateCacheStats(key, 'hit', cachedSize);
      return entry.data;
    }
  } catch (error) {
    // If parsing fails or localStorage is unavailable, return null
    logger.warn(`Failed to get cached data for key "${key}"`, { component: 'cacheService', operation: 'getCachedData', key, error });
    updateCacheStats(key, 'miss');
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
 * @returns Delta cache entry with version info, or null if not found or expired
 * 
 * @example
 * ```typescript
 * const entry = getDeltaCacheEntry<ScoreBoardData[]>(CACHE_KEYS.SCORE_BOARD);
 * if (entry) {
 *   const lastVersion = entry.version;
 *   // Request changes since lastVersion
 * }
 * ```
 */
export function getDeltaCacheEntry<T>(key: string): DeltaCacheEntry<T> | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) {
      return null;
    }

    // Decompress data if compressed
    const decompressed = decompressData(cached);
    const parsed = JSON.parse(decompressed);
    const now = Date.now();

    // Check if it's a delta cache entry
    if (isDeltaCacheEntry<T>(parsed)) {
      const entry = parsed;
      
      // Check TTL fallback if provided
      if (entry.ttl && entry.timestamp) {
        const age = now - entry.timestamp;
        if (age > entry.ttl) {
          localStorage.removeItem(key);
          return null;
        }
      }
      
      return entry;
    }
    
    // Legacy cache entry - migrate it by returning null (will be replaced with delta cache)
    return null;
  } catch (error) {
    logger.warn(`Failed to get delta cache entry for key "${key}"`, { component: 'cacheService', operation: 'getDeltaCacheEntry', key, error });
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
 * @returns Last version number (changeId), or 0 if not found
 * 
 * @example
 * ```typescript
 * const lastVersion = getLastVersion(CACHE_KEYS.SCORE_BOARD);
 * // Use lastVersion to request incremental updates
 * ```
 */
export function getLastVersion(key: string): number {
  const entry = getDeltaCacheEntry(key);
  return entry?.version || 0;
}

/**
 * Set data in cache with TTL (legacy method, creates TTL-based entry)
 * 
 * Stores data in localStorage with a time-to-live (TTL) expiration.
 * This is the legacy caching method. For delta sync, use setDeltaCacheEntry instead.
 * 
 * @template T - The type of data being cached
 * @param key - Cache key to store data under
 * @param data - Data to cache
 * @param ttl - Time to live in milliseconds (default: DEFAULT_TTL)
 * 
 * @example
 * ```typescript
 * const data = await fetchBenjaminGrahamData();
 * setCachedData(CACHE_KEYS.BENJAMIN_GRAHAM, data, DEFAULT_TTL);
 * ```
 */
export function setCachedData<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
  try {
    // Check quota before storing
    warnOnQuotaThreshold();
    
    // Evict if needed before storing
    evictLRUEntries();
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };

    const serialized = JSON.stringify(entry);
    
    // Compress data before storage
    const compressed = compressData(serialized);
    const size = new Blob([compressed]).size;

    // Check if adding this entry would exceed max size
    const currentSize = getTotalCacheSize();
    if (currentSize + size > MAX_CACHE_SIZE_BYTES) {
      // Try to evict more aggressively
      evictLRUEntries(MAX_CACHE_SIZE_BYTES * 0.7);
    }

    localStorage.setItem(key, compressed);
    
    // Update LRU order (mark as recently used)
    updateLRUOrder(key);
    
    // Update cache statistics with size
    const stats = getCacheStats();
    stats.sizes[key] = size;
    stats.lastAccessed[key] = Date.now();
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
    
    // Check quota after storing
    warnOnQuotaThreshold();
  } catch (error) {
    // Edge case: localStorage quota exceeded
    // If localStorage is full or unavailable, log warning but don't throw
    // This allows the app to continue functioning without cache
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      logger.warn('localStorage quota exceeded, cache not saved', { component: 'cacheService', operation: 'setCachedData', key });
      // Try to evict aggressively (50% of max) and retry - this is a last resort
      // If this fails, the app continues without caching (graceful degradation)
      evictLRUEntries(MAX_CACHE_SIZE_BYTES * 0.5);
    } else {
      logger.warn(`Failed to set cached data for key "${key}"`, { component: 'cacheService', operation: 'setCachedData', key, error });
    }
  }
}

/**
 * Set delta cache entry with version information
 * 
 * Stores data in localStorage with version information for delta sync support.
 * Tracks whether the entry is a full snapshot or an incremental update.
 * 
 * @template T - The type of data being cached
 * @param key - Cache key to store data under
 * @param data - Data to cache
 * @param version - Current version (changeId) from the server
 * @param isSnapshot - Whether this is a full snapshot (true) or incremental update (false)
 * @param ttl - Optional TTL for fallback compatibility with legacy cache
 * 
 * @example
 * ```typescript
 * // Store a full snapshot
 * setDeltaCacheEntry(CACHE_KEYS.SCORE_BOARD, data, version, true);
 * 
 * // Store an incremental update
 * setDeltaCacheEntry(CACHE_KEYS.SCORE_BOARD, updatedData, newVersion, false);
 * ```
 */
export function setDeltaCacheEntry<T>(
  key: string,
  data: T,
  version: number,
  isSnapshot: boolean = false,
  ttl?: number
): void {
  try {
    // Check quota before storing
    warnOnQuotaThreshold();
    
    // Evict if needed before storing
    evictLRUEntries();
    
    const now = Date.now();
    const existing = getDeltaCacheEntry<T>(key);
    
    const entry: DeltaCacheEntry<T> = {
      data,
      version,
      lastSnapshotAt: isSnapshot ? now : (existing?.lastSnapshotAt || now),
      lastUpdated: now,
      timestamp: ttl ? now : undefined, // Only set timestamp if TTL is provided
      ttl,
    };

    const serialized = JSON.stringify(entry);
    
    // Compress data before storage
    const compressed = compressData(serialized);
    const size = new Blob([compressed]).size;
    
    // Check if adding this entry would exceed max size
    const currentSize = getTotalCacheSize();
    if (currentSize + size > MAX_CACHE_SIZE_BYTES) {
      // Try to evict more aggressively
      evictLRUEntries(MAX_CACHE_SIZE_BYTES * 0.7);
    }
    
    localStorage.setItem(key, compressed);
    
    // Update LRU order (mark as recently used)
    updateLRUOrder(key);
    
    // Update cache statistics with size
    const stats = getCacheStats();
    stats.sizes[key] = size;
    stats.lastAccessed[key] = now;
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
    
    // Check quota after storing
    warnOnQuotaThreshold();
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      logger.warn('localStorage quota exceeded, delta cache not saved', { component: 'cacheService', operation: 'setDeltaCacheEntry', key });
      // Try to evict and retry
      evictLRUEntries(MAX_CACHE_SIZE_BYTES * 0.5);
    } else {
      logger.warn(`Failed to set delta cache entry for key "${key}"`, { component: 'cacheService', operation: 'setDeltaCacheEntry', key, error });
    }
  }
}

/**
 * Check if cache is valid (exists and not expired)
 * 
 * Checks if a cache entry exists and has not expired based on TTL.
 * Note: This only works for legacy TTL-based cache entries.
 * 
 * @param key - Cache key to check
 * @returns true if cache is valid and not expired, false otherwise
 * 
 * @example
 * ```typescript
 * if (isCacheValid(CACHE_KEYS.BENJAMIN_GRAHAM)) {
 *   // Cache is still valid
 * }
 * ```
 */
export function isCacheValid(key: string): boolean {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) {
      return false;
    }

    const entry: CacheEntry<unknown> = JSON.parse(cached);
    const now = Date.now();
    const age = now - entry.timestamp;

    if (age > entry.ttl) {
      // Cache expired, remove it
      localStorage.removeItem(key);
      return false;
    }

    return true;
  } catch (error) {
    logger.warn(`Failed to check cache validity for key "${key}"`, { component: 'cacheService', operation: 'isCacheValid', key, error });
    return false;
  }
}

/**
 * Clear cache for a specific key or all cache entries
 * 
 * Removes cache entries from localStorage. If a key is provided, only that
 * entry is removed. If no key is provided, all cache entries (those starting
 * with 'cache:') are removed.
 * 
 * @param key - Optional cache key to clear. If not provided, clears all cache entries
 * 
 * @example
 * ```typescript
 * // Clear specific cache
 * clearCache(CACHE_KEYS.BENJAMIN_GRAHAM);
 * 
 * // Clear all caches
 * clearCache();
 * ```
 */
export function clearCache(key?: string): void {
  try {
    if (key) {
      localStorage.removeItem(key);
      removeFromLRUOrder(key);
    } else {
      // Clear all cache entries (those starting with 'cache:')
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i);
        if (storageKey && storageKey.startsWith('cache:')) {
          keysToRemove.push(storageKey);
        }
      }
      keysToRemove.forEach(k => {
        localStorage.removeItem(k);
        removeFromLRUOrder(k);
      });
    }
  } catch (error) {
    logger.warn('Failed to clear cache', { component: 'cacheService', operation: 'clearCache', key, error });
  }
}

/**
 * Get cache age in milliseconds
 * 
 * Calculates how old a cache entry is by comparing current time with the
 * entry's timestamp. Works with both legacy TTL-based and delta sync entries.
 * 
 * @param key - Cache key to get age for
 * @returns Age in milliseconds, or null if cache doesn't exist or is invalid
 * 
 * @example
 * ```typescript
 * const age = getCacheAge(CACHE_KEYS.BENJAMIN_GRAHAM);
 * if (age && age > 10 * 60 * 1000) {
 *   // Cache is older than 10 minutes
 * }
 * ```
 */
export function getCacheAge(key: string): number | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) {
      return null;
    }

    // Decompress data if compressed
    const decompressed = decompressData(cached);
    const parsed = JSON.parse(decompressed);
    const now = Date.now();

    // Check if it's a delta cache entry
    if (parsed.version !== undefined) {
      const entry = parsed as DeltaCacheEntry<unknown>;
      if (entry.timestamp) {
        return now - entry.timestamp;
      }
      if (entry.lastUpdated) {
        return now - entry.lastUpdated;
      }
      return null;
    } else if (isCacheEntry<unknown>(parsed)) {
      // Legacy TTL-based cache entry
      const entry = parsed;
      return now - entry.timestamp;
    }
  } catch (error) {
    logger.warn(`Failed to get cache age for key "${key}"`, { component: 'cacheService', operation: 'getCacheAge', key, error });
    return null;
  }
}

/**
 * Check if cache is fresh (recently updated)
 * 
 * Determines if a cache entry is considered "fresh" based on a threshold.
 * Fresh caches are recently updated and don't need immediate refresh.
 * 
 * @param key - Cache key to check
 * @param freshThresholdMs - Threshold in milliseconds (default: FRESH_THRESHOLD_MS)
 * @returns true if cache is fresh (newer than threshold), false otherwise
 * 
 * @example
 * ```typescript
 * if (isCacheFresh(CACHE_KEYS.BENJAMIN_GRAHAM)) {
 *   // Cache is fresh, no need to refresh
 * }
 * ```
 */
export function isCacheFresh(key: string, freshThresholdMs: number = FRESH_THRESHOLD_MS): boolean {
  const age = getCacheAge(key);
  return age !== null && age < freshThresholdMs;
}

/**
 * Check if cache is stale but valid (within TTL but older than fresh threshold)
 * 
 * Determines if a cache entry is stale (older than fresh threshold) but still
 * valid (within TTL). Stale caches can be refreshed in the background.
 * 
 * @param key - Cache key to check
 * @param freshThresholdMs - Threshold in milliseconds (default: FRESH_THRESHOLD_MS)
 * @returns true if cache is stale but valid, false otherwise
 * 
 * @example
 * ```typescript
 * if (isCacheStale(CACHE_KEYS.BENJAMIN_GRAHAM)) {
 *   // Cache is valid but stale, refresh in background
 *   fetchBenjaminGrahamData(true);
 * }
 * ```
 */
export function isCacheStale(key: string, freshThresholdMs: number = FRESH_THRESHOLD_MS): boolean {
  const cached = getCachedData(key);
  if (!cached) {
    return false;
  }
  
  const age = getCacheAge(key);
  return age !== null && age >= freshThresholdMs;
}

/**
 * Clear all expired cache entries
 * 
 * Scans all cache entries and removes those that have expired based on TTL.
 * This can be called periodically to clean up expired cache and free up localStorage space.
 * 
 * @example
 * ```typescript
 * // Call periodically (e.g., on app start or every hour)
 * clearExpiredCache();
 * ```
 */
export function clearExpiredCache(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (storageKey && storageKey.startsWith('cache:')) {
        if (!isCacheValid(storageKey)) {
          keysToRemove.push(storageKey);
        }
      }
    }
    keysToRemove.forEach(k => {
      localStorage.removeItem(k);
      removeFromLRUOrder(k);
    });
    
    // Also check quota and evict if needed
    warnOnQuotaThreshold();
    evictLRUEntries();
  } catch (error) {
    logger.warn('Failed to clear expired cache', { component: 'cacheService', operation: 'clearExpiredCache', error });
  }
}


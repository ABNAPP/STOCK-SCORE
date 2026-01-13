/**
 * Cache Service
 * 
 * Provides caching functionality with TTL (Time To Live) and version-based caching for delta sync.
 * Uses localStorage to cache data and reduce network requests.
 */

// Legacy cache interface (TTL-based)
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

// Delta sync cache interface (version-based)
export interface DeltaCacheEntry<T> {
  data: T;
  version: number; // Last changeId
  lastSnapshotAt: number; // Timestamp of last snapshot
  lastUpdated: number; // Timestamp of last update
  timestamp?: number; // Legacy: for TTL fallback
  ttl?: number; // Optional TTL for fallback compatibility
}

// Cache keys for different data types
export const CACHE_KEYS = {
  BENJAMIN_GRAHAM: 'cache:benjaminGraham',
  SMA: 'cache:sma',
  PE_INDUSTRY: 'cache:peIndustry',
  SCORE_BOARD: 'cache:scoreBoard',
  THRESHOLD_INDUSTRY: 'cache:thresholdIndustry',
} as const;

// Default TTL: 20 minutes (1200000 ms)
export const DEFAULT_TTL = 20 * 60 * 1000;

// Cache statistics storage key
const STATS_STORAGE_KEY = 'cache:stats';

// Cache statistics interface
export interface CacheStats {
  hits: Record<string, number>;
  misses: Record<string, number>;
  sizes: Record<string, number>; // Size in bytes (approximate)
  lastAccessed: Record<string, number>; // Timestamp of last access
}

/**
 * Get cache statistics
 */
export function getCacheStats(): CacheStats {
  try {
    const statsJson = localStorage.getItem(STATS_STORAGE_KEY);
    if (statsJson) {
      return JSON.parse(statsJson);
    }
  } catch (error) {
    console.warn('Failed to load cache statistics:', error);
  }
  
  return {
    hits: {},
    misses: {},
    sizes: {},
    lastAccessed: {},
  };
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
      console.warn('Failed to update cache statistics:', error);
    }
  }
}

/**
 * Get cache statistics for a specific key
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
 */
export function getTotalCacheSize(): number {
  const stats = getCacheStats();
  return Object.values(stats.sizes).reduce((sum, size) => sum + size, 0);
}

/**
 * Reset cache statistics
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
    console.warn('Failed to reset cache statistics:', error);
  }
}

/**
 * Get cached data if it exists and is not expired
 * Supports both TTL-based (legacy) and version-based (delta sync) cache entries
 * @param key Cache key
 * @returns Cached data or null if not found or expired
 */
export function getCachedData<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) {
      updateCacheStats(key, 'miss');
      return null;
    }

    const cachedSize = new Blob([cached]).size;
    const parsed = JSON.parse(cached);
    const now = Date.now();

    // Check if it's a delta cache entry (has version property)
    if (parsed.version !== undefined) {
      const entry = parsed as DeltaCacheEntry<T>;
      
      // Check TTL fallback if provided
      if (entry.ttl && entry.timestamp) {
        const age = now - entry.timestamp;
        if (age > entry.ttl) {
          localStorage.removeItem(key);
          updateCacheStats(key, 'miss');
          return null;
        }
      }
      
      updateCacheStats(key, 'hit', cachedSize);
      return entry.data;
    } else {
      // Legacy TTL-based cache entry
      const entry = parsed as CacheEntry<T>;
      const age = now - entry.timestamp;

      // Check if cache is expired
      if (age > entry.ttl) {
        // Cache expired, remove it
        localStorage.removeItem(key);
        updateCacheStats(key, 'miss');
        return null;
      }

      updateCacheStats(key, 'hit', cachedSize);
      return entry.data;
    }
  } catch (error) {
    // If parsing fails or localStorage is unavailable, return null
    console.warn(`Failed to get cached data for key "${key}":`, error);
    updateCacheStats(key, 'miss');
    return null;
  }
}

/**
 * Get delta cache entry with version information
 * @param key Cache key
 * @returns Delta cache entry or null if not found or expired
 */
export function getDeltaCacheEntry<T>(key: string): DeltaCacheEntry<T> | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) {
      return null;
    }

    const parsed = JSON.parse(cached);
    const now = Date.now();

    // Check if it's a delta cache entry
    if (parsed.version !== undefined) {
      const entry = parsed as DeltaCacheEntry<T>;
      
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
    console.warn(`Failed to get delta cache entry for key "${key}":`, error);
    return null;
  }
}

/**
 * Get last version from cache
 * @param key Cache key
 * @returns Last version number or 0 if not found
 */
export function getLastVersion(key: string): number {
  const entry = getDeltaCacheEntry(key);
  return entry?.version || 0;
}

/**
 * Set data in cache with TTL (legacy method, creates TTL-based entry)
 * @param key Cache key
 * @param data Data to cache
 * @param ttl Time to live in milliseconds (default: DEFAULT_TTL)
 */
export function setCachedData<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };

    const serialized = JSON.stringify(entry);
    const size = new Blob([serialized]).size;
    localStorage.setItem(key, serialized);
    
    // Update cache statistics with size
    const stats = getCacheStats();
    stats.sizes[key] = size;
    stats.lastAccessed[key] = Date.now();
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch (error) {
    // If localStorage is full or unavailable, log warning but don't throw
    // This allows the app to continue functioning without cache
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded, cache not saved');
    } else {
      console.warn(`Failed to set cached data for key "${key}":`, error);
    }
  }
}

/**
 * Set delta cache entry with version information
 * @param key Cache key
 * @param data Data to cache
 * @param version Current version (changeId)
 * @param isSnapshot Whether this is a snapshot (true) or incremental update (false)
 * @param ttl Optional TTL for fallback compatibility
 */
export function setDeltaCacheEntry<T>(
  key: string,
  data: T,
  version: number,
  isSnapshot: boolean = false,
  ttl?: number
): void {
  try {
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
    const size = new Blob([serialized]).size;
    localStorage.setItem(key, serialized);
    
    // Update cache statistics with size
    const stats = getCacheStats();
    stats.sizes[key] = size;
    stats.lastAccessed[key] = now;
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded, delta cache not saved');
    } else {
      console.warn(`Failed to set delta cache entry for key "${key}":`, error);
    }
  }
}

/**
 * Check if cache is valid (exists and not expired)
 * @param key Cache key
 * @returns true if cache is valid, false otherwise
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
    console.warn(`Failed to check cache validity for key "${key}":`, error);
    return false;
  }
}

/**
 * Clear cache for a specific key or all cache entries
 * @param key Optional cache key. If not provided, clears all cache entries
 */
export function clearCache(key?: string): void {
  try {
    if (key) {
      localStorage.removeItem(key);
    } else {
      // Clear all cache entries (those starting with 'cache:')
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i);
        if (storageKey && storageKey.startsWith('cache:')) {
          keysToRemove.push(storageKey);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    }
  } catch (error) {
    console.warn('Failed to clear cache:', error);
  }
}

/**
 * Get cache age in milliseconds
 * @param key Cache key
 * @returns Age in milliseconds, or null if cache doesn't exist or is invalid
 */
export function getCacheAge(key: string): number | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) {
      return null;
    }

    const parsed = JSON.parse(cached);
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
    } else {
      // Legacy TTL-based cache entry
      const entry = parsed as CacheEntry<unknown>;
      return now - entry.timestamp;
    }
  } catch (error) {
    console.warn(`Failed to get cache age for key "${key}":`, error);
    return null;
  }
}

/**
 * Check if cache is fresh (recently updated)
 * @param key Cache key
 * @param freshThresholdMs Threshold in milliseconds (default: 5 minutes)
 * @returns true if cache is fresh, false otherwise
 */
export function isCacheFresh(key: string, freshThresholdMs: number = 5 * 60 * 1000): boolean {
  const age = getCacheAge(key);
  return age !== null && age < freshThresholdMs;
}

/**
 * Check if cache is stale but valid (within TTL but older than fresh threshold)
 * @param key Cache key
 * @param freshThresholdMs Threshold in milliseconds (default: 5 minutes)
 * @returns true if cache is stale but valid, false otherwise
 */
export function isCacheStale(key: string, freshThresholdMs: number = 5 * 60 * 1000): boolean {
  const cached = getCachedData(key);
  if (!cached) {
    return false;
  }
  
  const age = getCacheAge(key);
  return age !== null && age >= freshThresholdMs;
}

/**
 * Clear all expired cache entries
 * This can be called periodically to clean up expired cache
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
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (error) {
    console.warn('Failed to clear expired cache:', error);
  }
}


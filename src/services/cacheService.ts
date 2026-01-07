/**
 * Cache Service
 * 
 * Provides caching functionality with TTL (Time To Live) for CSV data.
 * Uses localStorage to cache data and reduce network requests.
 */

// Cache interface
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

// Cache keys for different data types
export const CACHE_KEYS = {
  BENJAMIN_GRAHAM: 'cache:benjaminGraham',
  SMA: 'cache:sma',
  PE_INDUSTRY: 'cache:peIndustry',
  SCORE_BOARD: 'cache:scoreBoard',
  THRESHOLD_INDUSTRY: 'cache:thresholdIndustry',
} as const;

// Default TTL: 5 minutes (300000 ms)
export const DEFAULT_TTL = 5 * 60 * 1000;

/**
 * Get cached data if it exists and is not expired
 * @param key Cache key
 * @returns Cached data or null if not found or expired
 */
export function getCachedData<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) {
      return null;
    }

    const entry: CacheEntry<T> = JSON.parse(cached);
    const now = Date.now();
    const age = now - entry.timestamp;

    // Check if cache is expired
    if (age > entry.ttl) {
      // Cache expired, remove it
      localStorage.removeItem(key);
      return null;
    }

    return entry.data;
  } catch (error) {
    // If parsing fails or localStorage is unavailable, return null
    console.warn(`Failed to get cached data for key "${key}":`, error);
    return null;
  }
}

/**
 * Set data in cache with TTL
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

    localStorage.setItem(key, JSON.stringify(entry));
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


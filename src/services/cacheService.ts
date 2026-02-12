/**
 * Cache Service (neutralized — no localStorage data cache)
 *
 * Data cache has been removed. This module only exports types and no-op/empty
 * implementations so existing imports do not break. All shared data comes from
 * Firestore appCache (see firestoreCacheService).
 */

/**
 * Legacy cache interface (TTL-based). Kept for type compatibility.
 * @template T - The type of data being cached
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Delta sync cache interface (version-based).
 * Used by firestoreCacheService and delta sync. Data is stored in Firestore, not localStorage.
 * @template T - The type of data being cached
 */
export interface DeltaCacheEntry<T> {
  data: T;
  version: number;
  lastSnapshotAt: number;
  lastUpdated: number;
  timestamp?: number;
  ttl?: number;
}

// Re-export CACHE_KEYS from centralized location for backward compatibility
// @deprecated Import CACHE_KEYS from './cacheKeys' instead
export { CACHE_KEYS } from './cacheKeys';

const DEFAULT_TTL_MINUTES = parseInt(import.meta.env.VITE_CACHE_DEFAULT_TTL_MINUTES || '180', 10);
export const DEFAULT_TTL = DEFAULT_TTL_MINUTES * 60 * 1000;

const FRESH_THRESHOLD_MINUTES = parseInt(import.meta.env.VITE_CACHE_FRESH_THRESHOLD_MINUTES || '5', 10);
export const FRESH_THRESHOLD_MS = FRESH_THRESHOLD_MINUTES * 60 * 1000;

const EMPTY_STATS = {
  hits: {} as Record<string, number>,
  misses: {} as Record<string, number>,
  sizes: {} as Record<string, number>,
  lastAccessed: {} as Record<string, number>,
};

export interface CacheStats {
  hits: Record<string, number>;
  misses: Record<string, number>;
  sizes: Record<string, number>;
  lastAccessed: Record<string, number>;
}

export function getCacheStats(): CacheStats {
  return { ...EMPTY_STATS };
}

export function checkQuotaUsage(): number | null {
  return null;
}

export function getCacheStatsForKey(_key: string): {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  lastAccessed: number | null;
} {
  return {
    hits: 0,
    misses: 0,
    hitRate: 0,
    size: 0,
    lastAccessed: null,
  };
}

export function getTotalCacheSize(): number {
  return 0;
}

export function resetCacheStats(_key?: string): void {
  // No-op
}

export function getCachedData<T>(_key: string): T | null {
  return null;
}

export function getDeltaCacheEntry<T>(_key: string): DeltaCacheEntry<T> | null {
  return null;
}

export function getLastVersion(_key: string): number {
  return 0;
}

export function setCachedData<T>(_key: string, _data: T, _ttl: number = DEFAULT_TTL): void {
  // No-op
}

export function setDeltaCacheEntry<T>(
  _key: string,
  _data: T,
  _version: number,
  _isSnapshot: boolean = false,
  _ttl?: number
): void {
  // No-op
}

export function isCacheValid(_key: string): boolean {
  return false;
}

export function clearCache(_key?: string): void {
  // No-op
}

export function getCacheAge(_key: string): number | null {
  return null;
}

export function isCacheFresh(_key: string, _freshThresholdMs: number = FRESH_THRESHOLD_MS): boolean {
  return false;
}

export function isCacheStale(key: string, _freshThresholdMs: number = FRESH_THRESHOLD_MS): boolean {
  return getCachedData(key) !== null && getCacheAge(key) !== null;
}

export function clearExpiredCache(): void {
  // No-op
}

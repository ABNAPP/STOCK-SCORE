import { describe, it, expect, beforeEach } from 'vitest';
import {
  setCachedData,
  getCachedData,
  clearCache,
  isCacheValid,
  isCacheFresh,
  isCacheStale,
  setDeltaCacheEntry,
  getDeltaCacheEntry,
  getCacheStats,
  getCacheAge,
  getLastVersion,
  getCacheStatsForKey,
  getTotalCacheSize,
  clearExpiredCache,
  CACHE_KEYS,
  DEFAULT_TTL,
} from '../cacheService';

/**
 * cacheService is neutralized: no localStorage data cache.
 * All data cache is in Firestore (firestoreCacheService).
 * These tests verify no-op / empty behavior.
 */
describe('cacheService (neutralized — no localStorage data cache)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getCachedData', () => {
    it('should always return null', () => {
      expect(getCachedData('any-key')).toBeNull();
      expect(getCachedData(CACHE_KEYS.SCORE_BOARD)).toBeNull();
      expect(getCachedData('')).toBeNull();
    });

    it('should not throw for null or undefined key', () => {
      expect(() => getCachedData(null as unknown as string)).not.toThrow();
      expect(() => getCachedData(undefined as unknown as string)).not.toThrow();
    });
  });

  describe('getDeltaCacheEntry', () => {
    it('should always return null', () => {
      expect(getDeltaCacheEntry('any-key')).toBeNull();
      expect(getDeltaCacheEntry(CACHE_KEYS.BENJAMIN_GRAHAM)).toBeNull();
    });
  });

  describe('getLastVersion', () => {
    it('should always return 0', () => {
      expect(getLastVersion('any-key')).toBe(0);
    });
  });

  describe('setCachedData / setDeltaCacheEntry', () => {
    it('should not throw when setting cache (no-op)', () => {
      expect(() => setCachedData('test-key', { test: 'data' })).not.toThrow();
      expect(() => setDeltaCacheEntry('test-key', [], 1, true)).not.toThrow();
    });

    it('should not persist data — getCachedData still returns null', () => {
      setCachedData('test-key', { test: 'data' });
      expect(getCachedData('test-key')).toBeNull();
      setDeltaCacheEntry('delta-key', [{}], 1, true);
      expect(getDeltaCacheEntry('delta-key')).toBeNull();
    });
  });

  describe('getCacheStats / getCacheStatsForKey / getTotalCacheSize', () => {
    it('getCacheStats should return empty structure', () => {
      const stats = getCacheStats();
      expect(stats).toEqual({ hits: {}, misses: {}, sizes: {}, lastAccessed: {} });
    });

    it('getCacheStatsForKey should return zeros and null', () => {
      const stats = getCacheStatsForKey('any-key');
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.size).toBe(0);
      expect(stats.lastAccessed).toBeNull();
    });

    it('getTotalCacheSize should return 0', () => {
      expect(getTotalCacheSize()).toBe(0);
    });
  });

  describe('getCacheAge', () => {
    it('should always return null', () => {
      expect(getCacheAge('any-key')).toBeNull();
    });
  });

  describe('isCacheValid / isCacheFresh / isCacheStale', () => {
    it('isCacheValid should always return false', () => {
      expect(isCacheValid('any-key')).toBe(false);
      expect(isCacheValid(CACHE_KEYS.PE_INDUSTRY)).toBe(false);
    });

    it('isCacheFresh should always return false', () => {
      expect(isCacheFresh('any-key')).toBe(false);
    });

    it('isCacheStale should return false when no cache (getCachedData returns null)', () => {
      expect(isCacheStale('any-key')).toBe(false);
    });
  });

  describe('clearCache / clearExpiredCache', () => {
    it('should not throw (no-op)', () => {
      expect(() => clearCache()).not.toThrow();
      expect(() => clearCache('some-key')).not.toThrow();
      expect(() => clearExpiredCache()).not.toThrow();
    });
  });

  describe('exports', () => {
    it('should export CACHE_KEYS and DEFAULT_TTL', () => {
      expect(CACHE_KEYS).toBeDefined();
      expect(CACHE_KEYS.SCORE_BOARD).toBe('cache:scoreBoard');
      expect(DEFAULT_TTL).toBeGreaterThan(0);
    });
  });
});

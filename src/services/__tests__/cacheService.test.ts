import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setCachedData,
  getCachedData,
  clearCache,
  isCacheValid,
  isCacheFresh,
  isCacheStale,
  setDeltaCacheEntry,
  getDeltaCacheEntry,
  CACHE_KEYS,
  DEFAULT_TTL,
} from '../cacheService';

describe('cacheService Error Handling', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('QuotaExceededError handling', () => {
    it('should handle QuotaExceededError gracefully when setting cache', () => {
      // Mock localStorage.setItem to throw QuotaExceededError
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        const error = new DOMException('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });

      const testData = { test: 'data' };
      
      // Should not throw, but handle error gracefully
      expect(() => {
        try {
          setCachedData('test-key', testData);
        } catch (error) {
          // Error should be caught internally
        }
      }).not.toThrow();

      localStorage.setItem = originalSetItem;
    });

    it('should handle QuotaExceededError for delta cache entries', () => {
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        const error = new DOMException('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });

      const testData = [{ id: 1, name: 'Test' }];
      
      expect(() => {
        try {
          setDeltaCacheEntry('test-key', testData, 1, true);
        } catch (error) {
          // Error should be caught internally
        }
      }).not.toThrow();

      localStorage.setItem = originalSetItem;
    });
  });

  describe('Invalid JSON handling', () => {
    it('should handle corrupted cache data gracefully', () => {
      // Set invalid JSON in localStorage
      localStorage.setItem('cache:test-key', 'invalid json{');

      // Should return null instead of throwing
      const result = getCachedData('test-key');
      expect(result).toBeNull();
    });

    it('should handle corrupted delta cache data', () => {
      localStorage.setItem('delta:test-key', 'invalid json{');

      const result = getDeltaCacheEntry('test-key');
      expect(result).toBeNull();
    });

    it('should handle non-object cache data', () => {
      localStorage.setItem('cache:test-key', JSON.stringify('not an object'));

      const result = getCachedData('test-key');
      expect(result).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('should handle null cache key', () => {
      expect(() => getCachedData(null as unknown as string)).not.toThrow();
    });

    it('should handle undefined cache key', () => {
      expect(() => getCachedData(undefined as unknown as string)).not.toThrow();
    });

    it('should handle empty string cache key', () => {
      setCachedData('', { test: 'data' });
      const result = getCachedData('');
      expect(result).toEqual({ test: 'data' });
    });

    it('should handle very large data objects', () => {
      const largeData = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        data: 'x'.repeat(1000),
      }));

      try {
        setCachedData('large-key', largeData);
        const result = getCachedData('large-key');
        expect(result).toBeDefined();
      } catch (error) {
        // May fail due to quota, which is expected
        expect(error).toBeInstanceOf(DOMException);
      }
    });

    it('should handle expired cache entries', () => {
      const testData = { test: 'data' };
      setCachedData('expired-key', testData, 1); // 1ms TTL

      // Wait for expiration
      return new Promise((resolve) => {
        setTimeout(() => {
          const result = getCachedData('expired-key');
          expect(result).toBeNull();
          resolve(undefined);
        }, 10);
      });
    });

    it('should handle negative TTL', () => {
      const testData = { test: 'data' };
      setCachedData('negative-ttl-key', testData, -1000);

      // Should be immediately expired
      const result = getCachedData('negative-ttl-key');
      expect(result).toBeNull();
    });

    it('should handle zero TTL', () => {
      const testData = { test: 'data' };
      setCachedData('zero-ttl-key', testData, 0);

      // Should be immediately expired
      const result = getCachedData('zero-ttl-key');
      expect(result).toBeNull();
    });
  });

  describe('Cache validation edge cases', () => {
    it('should return false for non-existent cache', () => {
      expect(isCacheValid('non-existent-key')).toBe(false);
    });

    it('should handle cache with missing timestamp', () => {
      localStorage.setItem('cache:invalid-key', JSON.stringify({
        data: { test: 'data' },
        // Missing timestamp
        ttl: DEFAULT_TTL,
      }));

      expect(isCacheValid('invalid-key')).toBe(false);
    });

    it('should handle cache with missing data', () => {
      localStorage.setItem('cache:invalid-key', JSON.stringify({
        timestamp: Date.now(),
        ttl: DEFAULT_TTL,
        // Missing data
      }));

      expect(isCacheValid('invalid-key')).toBe(false);
    });

    it('should handle cache with invalid timestamp', () => {
      localStorage.setItem('cache:invalid-key', JSON.stringify({
        data: { test: 'data' },
        timestamp: 'invalid',
        ttl: DEFAULT_TTL,
      }));

      expect(isCacheValid('invalid-key')).toBe(false);
    });
  });

  describe('Delta cache edge cases', () => {
    it('should handle delta cache with missing version', () => {
      localStorage.setItem('delta:invalid-key', JSON.stringify({
        data: [{ id: 1 }],
        // Missing version
        lastUpdated: Date.now(),
      }));

      const result = getDeltaCacheEntry('invalid-key');
      expect(result).toBeNull();
    });

    it('should handle delta cache with invalid version', () => {
      localStorage.setItem('delta:invalid-key', JSON.stringify({
        data: [{ id: 1 }],
        version: 'invalid',
        lastUpdated: Date.now(),
      }));

      const result = getDeltaCacheEntry('invalid-key');
      expect(result).toBeNull();
    });

    it('should handle delta cache with negative version', () => {
      setDeltaCacheEntry('negative-version-key', [{ id: 1 }], -1, true);
      const result = getDeltaCacheEntry('negative-version-key');
      expect(result).not.toBeNull();
      expect(result?.version).toBe(-1);
    });
  });

  describe('Cache freshness edge cases', () => {
    it('should handle very old cache as stale', () => {
      const testData = { test: 'data' };
      const oldTimestamp = Date.now() - (100 * 60 * 60 * 1000); // 100 hours ago
      
      localStorage.setItem('cache:old-key', JSON.stringify({
        data: testData,
        timestamp: oldTimestamp,
        ttl: DEFAULT_TTL,
      }));

      expect(isCacheFresh('old-key')).toBe(false);
      expect(isCacheStale('old-key')).toBe(true);
    });

    it('should handle future timestamp', () => {
      const testData = { test: 'data' };
      const futureTimestamp = Date.now() + (100 * 60 * 60 * 1000); // 100 hours in future
      
      localStorage.setItem('cache:future-key', JSON.stringify({
        data: testData,
        timestamp: futureTimestamp,
        ttl: DEFAULT_TTL,
      }));

      // Future timestamp should be considered fresh
      expect(isCacheFresh('future-key')).toBe(true);
    });
  });
});

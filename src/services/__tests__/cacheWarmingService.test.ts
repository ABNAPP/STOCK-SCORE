import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { warmCache, isCacheWarmingEnabled } from '../cacheWarmingService';
import { getCachedData, getCacheAge, setCachedData, CACHE_KEYS } from '../firestoreCacheService';
import { 
  fetchScoreBoardData, 
  fetchPEIndustryData, 
  // Note: fetchThresholdIndustryData removed - threshold data is now static
  fetchBenjaminGrahamData 
} from '../sheets';

// Mock the sheets services
vi.mock('../sheets', () => ({
  fetchScoreBoardData: vi.fn(),
  fetchPEIndustryData: vi.fn(),
  // Note: fetchThresholdIndustryData removed - threshold data is now static
  fetchBenjaminGrahamData: vi.fn(),
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock firestoreCacheService
vi.mock('../firestoreCacheService', async () => {
  const actual = await vi.importActual('../firestoreCacheService');
  return {
    ...actual,
    getCachedData: vi.fn(),
    getCacheAge: vi.fn(),
    setCachedData: vi.fn(),
  };
});

describe('cacheWarmingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Reset environment variable
    vi.stubEnv('VITE_CACHE_WARMING_ENABLED', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('isCacheWarmingEnabled', () => {
    it('should return true when VITE_CACHE_WARMING_ENABLED is not "false"', () => {
      vi.stubEnv('VITE_CACHE_WARMING_ENABLED', 'true');
      expect(isCacheWarmingEnabled()).toBe(true);
    });

    it('should return false when VITE_CACHE_WARMING_ENABLED is "false"', () => {
      vi.stubEnv('VITE_CACHE_WARMING_ENABLED', 'false');
      expect(isCacheWarmingEnabled()).toBe(false);
    });

    it('should return true when VITE_CACHE_WARMING_ENABLED is undefined', () => {
      vi.unstubEnv('VITE_CACHE_WARMING_ENABLED');
      expect(isCacheWarmingEnabled()).toBe(true);
    });
  });

  describe('warmCache', () => {
    it('should skip warming when disabled via env var', async () => {
      vi.stubEnv('VITE_CACHE_WARMING_ENABLED', 'false');
      
      await warmCache();
      
      expect(fetchScoreBoardData).not.toHaveBeenCalled();
      expect(fetchPEIndustryData).not.toHaveBeenCalled();
      // Note: fetchThresholdIndustryData removed - threshold data is now static
      expect(fetchBenjaminGrahamData).not.toHaveBeenCalled();
    });

    it('should warm cache when cache is empty', async () => {
      vi.useFakeTimers();
      
      // Mock no cache
      (getCachedData as any).mockResolvedValue(null);
      (getCacheAge as any).mockResolvedValue(null);
      
      const mockData = [{ companyName: 'Test', ticker: 'TEST' }];
      (fetchScoreBoardData as any).mockResolvedValue(mockData);
      (fetchPEIndustryData as any).mockResolvedValue(mockData);
      // Note: fetchThresholdIndustryData removed - threshold data is now static
      (fetchBenjaminGrahamData as any).mockResolvedValue(mockData);

      const warmPromise = warmCache();
      
      // Fast-forward past the delay
      await vi.advanceTimersByTimeAsync(2000);
      await warmPromise;

      expect(fetchScoreBoardData).toHaveBeenCalledWith(false);
      expect(fetchPEIndustryData).toHaveBeenCalledWith(false);
      // Note: fetchThresholdIndustryData removed - threshold data is now static
      expect(fetchBenjaminGrahamData).toHaveBeenCalledWith(false);

      vi.useRealTimers();
    });

    it('should skip warming when cache is fresh (< 15 minutes)', async () => {
      vi.useFakeTimers();
      
      // Set fresh cache data (mocked)
      const mockData = [{ companyName: 'Test', ticker: 'TEST' }];
      (getCachedData as any).mockResolvedValue(mockData);
      (getCacheAge as any).mockResolvedValue(5 * 60 * 1000); // 5 minutes old

      const warmPromise = warmCache();
      await vi.advanceTimersByTimeAsync(2000);
      await warmPromise;

      // Should not fetch since cache is fresh
      expect(fetchScoreBoardData).not.toHaveBeenCalled();
      expect(fetchPEIndustryData).not.toHaveBeenCalled();
      // Note: fetchThresholdIndustryData removed - threshold data is now static
      expect(fetchBenjaminGrahamData).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should warm cache when cache is stale (> 15 minutes)', async () => {
      vi.useFakeTimers();
      
      // Set stale cache data (mocked)
      const mockData = [{ companyName: 'Test', ticker: 'TEST' }];
      (getCachedData as any).mockResolvedValue(mockData);
      (getCacheAge as any).mockResolvedValue(20 * 60 * 1000); // 20 minutes old (stale)

      (fetchScoreBoardData as any).mockResolvedValue(mockData);
      (fetchPEIndustryData as any).mockResolvedValue(mockData);
      // Note: fetchThresholdIndustryData removed - threshold data is now static
      (fetchBenjaminGrahamData as any).mockResolvedValue(mockData);

      const warmPromise = warmCache();
      await vi.advanceTimersByTimeAsync(2000);
      await warmPromise;

      // Should fetch since cache is stale
      expect(fetchScoreBoardData).toHaveBeenCalledWith(false);
      expect(fetchPEIndustryData).toHaveBeenCalledWith(false);
      // Note: fetchThresholdIndustryData removed - threshold data is now static
      expect(fetchBenjaminGrahamData).toHaveBeenCalledWith(false);

      vi.useRealTimers();
    });

    it('should handle fetch failures gracefully', async () => {
      vi.useFakeTimers();
      
      (getCachedData as any).mockResolvedValue(null); // No cache
      (getCacheAge as any).mockResolvedValue(null);
      
      (fetchScoreBoardData as any).mockRejectedValue(new Error('Network error'));
      (fetchPEIndustryData as any).mockResolvedValue([]);
      // Note: fetchThresholdIndustryData removed - threshold data is now static
      (fetchBenjaminGrahamData as any).mockResolvedValue([]);

      const warmPromise = warmCache();
      await vi.advanceTimersByTimeAsync(2000);
      
      // Should not throw, even if one fetch fails
      await expect(warmPromise).resolves.not.toThrow();

      // Other fetches should still be called
      expect(fetchPEIndustryData).toHaveBeenCalled();
      // Note: fetchThresholdIndustryData removed - threshold data is now static
      expect(fetchBenjaminGrahamData).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should warm all data types in parallel', async () => {
      vi.useFakeTimers();
      
      // Mock no cache
      (getCachedData as any).mockResolvedValue(null);
      (getCacheAge as any).mockResolvedValue(null);
      
      const mockData = [{ companyName: 'Test', ticker: 'TEST' }];
      (fetchScoreBoardData as any).mockResolvedValue(mockData);
      (fetchPEIndustryData as any).mockResolvedValue(mockData);
      // Note: fetchThresholdIndustryData removed - threshold data is now static
      (fetchBenjaminGrahamData as any).mockResolvedValue(mockData);

      const warmPromise = warmCache();
      await vi.advanceTimersByTimeAsync(2000);
      await warmPromise;

      // All should be called
      expect(fetchScoreBoardData).toHaveBeenCalled();
      expect(fetchPEIndustryData).toHaveBeenCalled();
      // Note: fetchThresholdIndustryData removed - threshold data is now static
      expect(fetchBenjaminGrahamData).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should wait 2 seconds before warming', async () => {
      vi.useFakeTimers();
      
      // Mock no cache
      (getCachedData as any).mockResolvedValue(null);
      (getCacheAge as any).mockResolvedValue(null);
      
      const mockData = [{ companyName: 'Test', ticker: 'TEST' }];
      (fetchScoreBoardData as any).mockResolvedValue(mockData);

      const warmPromise = warmCache();
      
      // Before delay
      expect(fetchScoreBoardData).not.toHaveBeenCalled();
      
      // After delay
      await vi.advanceTimersByTimeAsync(2000);
      await warmPromise;
      
      expect(fetchScoreBoardData).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});

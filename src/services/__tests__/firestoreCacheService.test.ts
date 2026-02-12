import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as firestoreCacheService from '../firestoreCacheService';
import {
  shouldBlockAppCacheWriteInCutover,
  getViewDataWithFallback,
  CACHE_KEYS,
} from '../firestoreCacheService';

describe('firestoreCacheService - cutover guard', () => {
  describe('shouldBlockAppCacheWriteInCutover', () => {
    it('returns true for view-doc keys in cutover mode', () => {
      expect(shouldBlockAppCacheWriteInCutover(CACHE_KEYS.SCORE_BOARD, 'cutover')).toBe(true);
      expect(shouldBlockAppCacheWriteInCutover(CACHE_KEYS.BENJAMIN_GRAHAM, 'cutover')).toBe(true);
      expect(shouldBlockAppCacheWriteInCutover(CACHE_KEYS.PE_INDUSTRY, 'cutover')).toBe(true);
      expect(shouldBlockAppCacheWriteInCutover(CACHE_KEYS.SMA, 'cutover')).toBe(true);
    });

    it('returns false for currency_rates_usd in cutover mode', () => {
      expect(shouldBlockAppCacheWriteInCutover(CACHE_KEYS.CURRENCY_RATES_USD, 'cutover')).toBe(false);
    });

    it('returns false for view-doc keys in dual-read or dual-write mode', () => {
      expect(shouldBlockAppCacheWriteInCutover(CACHE_KEYS.SCORE_BOARD, 'dual-read')).toBe(false);
      expect(shouldBlockAppCacheWriteInCutover(CACHE_KEYS.SCORE_BOARD, 'dual-write')).toBe(false);
    });
  });
});

describe('getViewDataWithFallback - migration mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dual-read: when viewData is missing, fallbackFn is called', async () => {
    vi.spyOn(firestoreCacheService, 'getViewData').mockResolvedValue(null);
    const fallbackFn = vi.fn().mockResolvedValue({ scoreBoard: [] });

    const result = await getViewDataWithFallback('score-board', {
      fallback: fallbackFn,
      mode: 'dual-read',
    });

    expect(fallbackFn).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ data: { scoreBoard: [] }, source: 'appCache' });
    expect(result?.timestamp).toBeDefined();
    expect(typeof result?.timestamp).toBe('number');
  });

  it('cutover: when viewData is missing, fallbackFn is NOT called and result is null', async () => {
    vi.spyOn(firestoreCacheService, 'getViewData').mockResolvedValue(null);
    const fallbackFn = vi.fn().mockResolvedValue({ scoreBoard: [] });

    const result = await getViewDataWithFallback('score-board', {
      fallback: fallbackFn,
      mode: 'cutover',
    });

    expect(fallbackFn).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkRateLimit,
  resetRateLimit,
  resetAllRateLimits,
  getRateLimitStatus,
  RateLimiter,
} from '../rateLimiter';

// Mock logger
vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('rateLimiter', () => {
  beforeEach(() => {
    resetAllRateLimits();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('checkRateLimit', () => {
    it('should allow request within limit', () => {
      const result = checkRateLimit('fetch', 'test-key');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
    });

    it('should track requests per operation type', () => {
      checkRateLimit('fetch', 'key1');
      checkRateLimit('search', 'key1');

      const fetchStatus = getRateLimitStatus('fetch', 'key1');
      const searchStatus = getRateLimitStatus('search', 'key1');

      expect(fetchStatus.remaining).toBe(9); // 10 - 1
      expect(searchStatus.remaining).toBe(29); // 30 - 1
    });

    it('should track requests per key', () => {
      checkRateLimit('fetch', 'key1');
      checkRateLimit('fetch', 'key2');

      const status1 = getRateLimitStatus('fetch', 'key1');
      const status2 = getRateLimitStatus('fetch', 'key2');

      expect(status1.remaining).toBe(9);
      expect(status2.remaining).toBe(9);
    });

    it('should block request when limit exceeded', () => {
      // Make 10 requests (the limit)
      for (let i = 0; i < 10; i++) {
        checkRateLimit('fetch', 'test-key');
      }

      // 11th request should be blocked
      const result = checkRateLimit('fetch', 'test-key');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.error).toBeDefined();
    });

    it('should reset after time window', async () => {
      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        checkRateLimit('fetch', 'test-key');
      }

      // Should be blocked
      let result = checkRateLimit('fetch', 'test-key');
      expect(result.allowed).toBe(false);

      // Advance time past window (60 seconds)
      await vi.advanceTimersByTimeAsync(61000);

      // Should be allowed again
      result = checkRateLimit('fetch', 'test-key');
      expect(result.allowed).toBe(true);
    });

    it('should have different limits for different operations', () => {
      // Fetch limit: 20 per minute
      for (let i = 0; i < 20; i++) {
        checkRateLimit('fetch', 'test-key');
      }
      expect(checkRateLimit('fetch', 'test-key').allowed).toBe(false);

      // Search limit: 30 per minute
      for (let i = 0; i < 30; i++) {
        checkRateLimit('search', 'test-key');
      }
      expect(checkRateLimit('search', 'test-key').allowed).toBe(false);
    });
  });

  describe('resetRateLimit', () => {
    it('should reset rate limit for specific key', () => {
      // Make requests
      checkRateLimit('fetch', 'test-key');
      checkRateLimit('fetch', 'test-key');

      resetRateLimit('fetch', 'test-key');

      const status = getRateLimitStatus('fetch', 'test-key');
      expect(status.remaining).toBe(10); // Reset to full limit
    });

    it('should not affect other keys', () => {
      checkRateLimit('fetch', 'key1');
      checkRateLimit('fetch', 'key2');

      resetRateLimit('fetch', 'key1');

      const status1 = getRateLimitStatus('fetch', 'key1');
      const status2 = getRateLimitStatus('fetch', 'key2');

      expect(status1.remaining).toBe(10);
      expect(status2.remaining).toBe(9);
    });
  });

  describe('resetAllRateLimits', () => {
    it('should reset all rate limits', () => {
      checkRateLimit('fetch', 'key1');
      checkRateLimit('search', 'key2');

      resetAllRateLimits();

      const status1 = getRateLimitStatus('fetch', 'key1');
      const status2 = getRateLimitStatus('search', 'key2');

      expect(status1.remaining).toBe(10);
      expect(status2.remaining).toBe(30);
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return current status', () => {
      checkRateLimit('fetch', 'test-key');

      const status = getRateLimitStatus('fetch', 'test-key');

      expect(status.allowed).toBe(true);
      expect(status.remaining).toBe(9);
      expect(status.resetAt).toBeGreaterThan(Date.now());
    });

    it('should return correct status when limit exceeded', () => {
      for (let i = 0; i < 10; i++) {
        checkRateLimit('fetch', 'test-key');
      }

      const status = getRateLimitStatus('fetch', 'test-key');

      expect(status.allowed).toBe(false);
      expect(status.remaining).toBe(0);
    });
  });

  describe('RateLimiter class', () => {
    it('should allow custom configuration', () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowMs: 30000 });

      for (let i = 0; i < 5; i++) {
        const result = limiter.checkLimit('test-key');
        expect(result.allowed).toBe(true);
      }

      const result = limiter.checkLimit('test-key');
      expect(result.allowed).toBe(false);
    });
  });
});

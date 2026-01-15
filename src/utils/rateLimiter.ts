/**
 * Rate Limiter
 * 
 * Client-side rate limiting utility to prevent excessive API calls.
 * Tracks requests per operation/endpoint and enforces limits.
 */

import { logger } from './logger';

export interface RateLimitConfig {
  maxRequests: number; // Maximum number of requests
  windowMs: number; // Time window in milliseconds
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Timestamp when the limit resets
  error?: string;
}

class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig = { maxRequests: 10, windowMs: 60000 }) {
    this.config = config;
  }

  /**
   * Checks if a request is allowed for the given key
   * 
   * @param key - Unique identifier for the rate limit (e.g., endpoint name, operation type)
   * @returns Rate limit result indicating if request is allowed
   */
  checkLimit(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get or create request history for this key
    let requestTimes = this.requests.get(key) || [];

    // Remove old requests outside the time window
    requestTimes = requestTimes.filter((timestamp) => timestamp > windowStart);

    // Check if limit is exceeded
    if (requestTimes.length >= this.config.maxRequests) {
      const oldestRequest = requestTimes[0];
      const resetAt = oldestRequest + this.config.windowMs;

      logger.warn('Rate limit exceeded', {
        component: 'rateLimiter',
        key,
        requests: requestTimes.length,
        maxRequests: this.config.maxRequests,
        resetAt: new Date(resetAt).toISOString(),
      });

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        error: `Rate limit exceeded. Maximum ${this.config.maxRequests} requests per ${this.config.windowMs / 1000} seconds. Try again after ${new Date(resetAt).toLocaleTimeString()}`,
      };
    }

    // Add current request
    requestTimes.push(now);
    this.requests.set(key, requestTimes);

    const remaining = this.config.maxRequests - requestTimes.length;
    const oldestRequest = requestTimes[0];
    const resetAt = oldestRequest + this.config.windowMs;

    return {
      allowed: true,
      remaining,
      resetAt,
    };
  }

  /**
   * Resets the rate limit for a specific key
   */
  reset(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Resets all rate limits
   */
  resetAll(): void {
    this.requests.clear();
  }

  /**
   * Gets current rate limit status for a key
   */
  getStatus(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    const requestTimes = this.requests.get(key) || [];
    const recentRequests = requestTimes.filter((timestamp) => timestamp > windowStart);

    const remaining = Math.max(0, this.config.maxRequests - recentRequests.length);
    const resetAt = recentRequests.length > 0
      ? recentRequests[0] + this.config.windowMs
      : now;

    return {
      allowed: recentRequests.length < this.config.maxRequests,
      remaining,
      resetAt,
    };
  }
}

// Default rate limiter instance
// Configuration: 10 requests per 60 seconds per operation
const defaultRateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60000, // 60 seconds
});

// Separate rate limiters for different operation types
const rateLimiters: Map<string, RateLimiter> = new Map();

/**
 * Gets or creates a rate limiter for a specific operation type
 */
function getRateLimiter(operationType: string = 'default'): RateLimiter {
  if (!rateLimiters.has(operationType)) {
    // Different limits for different operations
    const configs: Record<string, RateLimitConfig> = {
      default: { maxRequests: 10, windowMs: 60000 }, // 10 per minute
      fetch: { maxRequests: 20, windowMs: 60000 }, // 20 per minute for data fetching
      search: { maxRequests: 30, windowMs: 60000 }, // 30 per minute for searches
      save: { maxRequests: 10, windowMs: 60000 }, // 10 per minute for saves
    };

    const config = configs[operationType] || configs.default;
    rateLimiters.set(operationType, new RateLimiter(config));
  }

  return rateLimiters.get(operationType)!;
}

/**
 * Checks if a request is allowed for the given operation
 * 
 * Implements client-side rate limiting to prevent excessive API calls.
 * Different operation types have different limits:
 * - fetch: 20 requests per minute
 * - search: 30 requests per minute
 * - save: 10 requests per minute
 * - default: 10 requests per minute
 * 
 * @param operationType - Type of operation (e.g., 'fetch', 'search', 'save')
 * @param key - Unique identifier for the specific request (e.g., endpoint URL, search query)
 * @returns Rate limit result with allowed status, remaining requests, and reset time
 * 
 * @example
 * ```typescript
 * const result = checkRateLimit('fetch', 'scoreBoard');
 * if (!result.allowed) {
 *   throw new Error(result.error);
 * }
 * // Proceed with request
 * await fetchData();
 * ```
 */
export function checkRateLimit(operationType: string = 'default', key: string = 'default'): RateLimitResult {
  const limiter = getRateLimiter(operationType);
  const fullKey = `${operationType}:${key}`;
  return limiter.checkLimit(fullKey);
}

/**
 * Resets rate limit for a specific operation and key
 */
export function resetRateLimit(operationType: string = 'default', key: string = 'default'): void {
  const limiter = getRateLimiter(operationType);
  const fullKey = `${operationType}:${key}`;
  limiter.reset(fullKey);
}

/**
 * Resets all rate limits
 */
export function resetAllRateLimits(): void {
  rateLimiters.forEach((limiter) => limiter.resetAll());
  defaultRateLimiter.resetAll();
}

/**
 * Gets current rate limit status
 */
export function getRateLimitStatus(operationType: string = 'default', key: string = 'default'): RateLimitResult {
  const limiter = getRateLimiter(operationType);
  const fullKey = `${operationType}:${key}`;
  return limiter.getStatus(fullKey);
}

export { RateLimiter };

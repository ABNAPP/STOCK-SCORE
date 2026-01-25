/**
 * Cache Keys
 * 
 * Centralized cache key definitions for all data types.
 * Used by both localStorage cache (deprecated) and Firestore cache.
 */

// Cache keys for different data types
export const CACHE_KEYS = {
  BENJAMIN_GRAHAM: 'cache:benjaminGraham',
  SMA: 'cache:sma',
  PE_INDUSTRY: 'cache:peIndustry',
  SCORE_BOARD: 'cache:scoreBoard',
  THRESHOLD_INDUSTRY: 'cache:thresholdIndustry',
} as const;

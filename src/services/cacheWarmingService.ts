/**
 * Cache Warming Service
 * 
 * Preloads cache data in the background when the app starts
 * to improve performance and reduce loading times
 */

import { CACHE_KEYS, getCachedData, getCacheAge } from './firestoreCacheService';
import { logger } from '../utils/logger';
import { 
  fetchScoreBoardData, 
  fetchPEIndustryData, 
  // Note: fetchThresholdIndustryData removed - threshold data is now static
  fetchBenjaminGrahamData 
} from './sheets';

// Cache warming configuration
const WARMING_DELAY_MS = 2000; // Wait 2 seconds after app starts before warming
const WARMING_ENABLED = import.meta.env.VITE_CACHE_WARMING_ENABLED !== 'false'; // Default: true

/**
 * Warm cache for all data types
 * 
 * Preloads cache for all data types in the background to improve performance.
 * This is a fire-and-forget operation that runs after a short delay to avoid
 * blocking initial app render. Only warms cache if it doesn't exist or is very old.
 * 
 * @example
 * ```typescript
 * // Call on app startup
 * warmCache(); // Runs in background, doesn't block
 * ```
 */
export async function warmCache(): Promise<void> {
  if (!WARMING_ENABLED) {
    return;
  }

  // Wait a bit after app starts to avoid blocking initial render
  await new Promise(resolve => setTimeout(resolve, WARMING_DELAY_MS));

  // Warm cache for all data types in parallel
  // Use Promise.allSettled to avoid failures in one affecting others
  // Note: Threshold industry data is now static and not cached/warmed
  const warmingPromises = [
    warmCacheForKey(CACHE_KEYS.SCORE_BOARD, () => fetchScoreBoardData(false)),
    warmCacheForKey(CACHE_KEYS.PE_INDUSTRY, () => fetchPEIndustryData(false)),
    warmCacheForKey(CACHE_KEYS.BENJAMIN_GRAHAM, () => fetchBenjaminGrahamData(false)),
  ];

  await Promise.allSettled(warmingPromises);
}

/**
 * Warm cache for a specific key
 * Only fetches data if cache doesn't exist or is stale
 */
async function warmCacheForKey(
  cacheKey: string,
  fetchFn: () => Promise<unknown>
): Promise<void> {
  try {
    // Check if cache exists and is fresh
    // If cache exists, skip warming (data hooks will handle revalidation)
    const cachedData = await getCachedData(cacheKey);
    
    // Only warm if cache doesn't exist or is very old (> 15 minutes)
    const cacheAge = await getCacheAge(cacheKey);
    const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
    
    if (cachedData && cacheAge !== null && cacheAge < FIFTEEN_MINUTES_MS) {
      // Cache exists and is relatively fresh, skip warming
      return;
    }

    // Fetch data in background (silently fail on errors)
    await fetchFn();
  } catch (error) {
    // Silently fail - cache warming is not critical
    logger.debug(`Cache warming failed for ${cacheKey}`, { component: 'cacheWarmingService', operation: 'warmCacheForKey', cacheKey, error });
  }
}

/**
 * Check if cache warming is enabled
 * 
 * Determines if cache warming is enabled based on environment variable.
 * 
 * @returns true if cache warming is enabled, false otherwise
 * 
 * @example
 * ```typescript
 * if (isCacheWarmingEnabled()) {
 *   await warmCache();
 * }
 * ```
 */
export function isCacheWarmingEnabled(): boolean {
  return WARMING_ENABLED;
}

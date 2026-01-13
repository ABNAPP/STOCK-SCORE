/**
 * Cache Warming Service
 * 
 * Preloads cache data in the background when the app starts
 * to improve performance and reduce loading times
 */

import { CACHE_KEYS, getCachedData, getCacheAge } from './cacheService';
import { 
  fetchScoreBoardData, 
  fetchPEIndustryData, 
  fetchThresholdIndustryData,
  fetchBenjaminGrahamData 
} from './sheetsService';

// Cache warming configuration
const WARMING_DELAY_MS = 2000; // Wait 2 seconds after app starts before warming
const WARMING_ENABLED = import.meta.env.VITE_CACHE_WARMING_ENABLED !== 'false'; // Default: true

/**
 * Warm cache for all data types
 * This is a fire-and-forget operation that runs in the background
 */
export async function warmCache(): Promise<void> {
  if (!WARMING_ENABLED) {
    return;
  }

  // Wait a bit after app starts to avoid blocking initial render
  await new Promise(resolve => setTimeout(resolve, WARMING_DELAY_MS));

  // Warm cache for all data types in parallel
  // Use Promise.allSettled to avoid failures in one affecting others
  const warmingPromises = [
    warmCacheForKey(CACHE_KEYS.SCORE_BOARD, () => fetchScoreBoardData(false)),
    warmCacheForKey(CACHE_KEYS.PE_INDUSTRY, () => fetchPEIndustryData(false)),
    warmCacheForKey(CACHE_KEYS.THRESHOLD_INDUSTRY, () => fetchThresholdIndustryData(false)),
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
    const cachedData = getCachedData(cacheKey);
    
    // Only warm if cache doesn't exist or is very old (> 15 minutes)
    const cacheAge = getCacheAge(cacheKey);
    const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
    
    if (cachedData && cacheAge !== null && cacheAge < FIFTEEN_MINUTES_MS) {
      // Cache exists and is relatively fresh, skip warming
      return;
    }

    // Fetch data in background (silently fail on errors)
    await fetchFn();
  } catch (error) {
    // Silently fail - cache warming is not critical
    if (import.meta.env.DEV) {
      console.debug(`Cache warming failed for ${cacheKey}:`, error);
    }
  }
}

/**
 * Check if cache warming is enabled
 */
export function isCacheWarmingEnabled(): boolean {
  return WARMING_ENABLED;
}

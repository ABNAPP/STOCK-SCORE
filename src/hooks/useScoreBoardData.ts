import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchScoreBoardData, ProgressCallback } from '../services/sheets';
import { ScoreBoardData } from '../types/stock';
import { useLoadingProgress } from '../contexts/LoadingProgressContext';
import { getCachedData, CACHE_KEYS, isCacheFresh, isCacheStale, DEFAULT_TTL, FRESH_THRESHOLD_MS } from '../services/cacheService';
import { usePageVisibility } from './usePageVisibility';
import { formatError, logError, createErrorHandler } from '../utils/errorHandler';
import { useNotifications } from '../contexts/NotificationContext';
import { detectDataChanges, formatChangeSummary } from '../utils/dataChangeDetector';

const CACHE_KEY = CACHE_KEYS.SCORE_BOARD;

/**
 * Custom hook for fetching and managing Score Board data
 * 
 * Implements a stale-while-revalidate pattern for optimal performance:
 * - Shows cached data immediately if available (no loading state)
 * - Refreshes stale data in background (5-20 minutes old)
 * - Only shows loading state if no cache exists
 * - Respects page visibility (pauses when tab is hidden)
 * 
 * **Data Fetching Strategy:**
 * - Initial load: Uses cache if available, otherwise fetches
 * - Background refresh: Automatically refreshes stale cache (5+ minutes old)
 * - Manual refresh: `refetch(true)` forces fresh data fetch
 * - Cache TTL: 20 minutes (configurable via environment variable)
 * 
 * **Cache States:**
 * - Fresh (< 5 min): No refresh needed
 * - Stale (5-20 min): Refresh in background
 * - Expired (> 20 min): Full refresh on next access
 * 
 * @returns Object with data, loading state, error, lastUpdated timestamp, and refetch function
 * 
 * @example
 * ```typescript
 * const { data, loading, error, refetch } = useScoreBoardData();
 * 
 * // Force refresh
 * const handleRefresh = () => {
 *   refetch(true);
 * };
 * ```
 */
export function useScoreBoardData() {
  // Check cache synchronously on mount to avoid unnecessary loading state
  const cachedData = getCachedData<ScoreBoardData[]>(CACHE_KEY);
  const hasInitialData = cachedData !== null && cachedData.length > 0;
  const isFresh = hasInitialData && isCacheFresh(CACHE_KEY, FRESH_THRESHOLD_MS);
  const isStale = hasInitialData && isCacheStale(CACHE_KEY, FRESH_THRESHOLD_MS);
  
  const [data, setData] = useState<ScoreBoardData[]>(cachedData || []);
  const [loading, setLoading] = useState(!hasInitialData); // Only show loading if no cache
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { updateProgress } = useLoadingProgress();
  const isPageVisible = usePageVisibility();
  const backgroundUpdateRef = useRef<Promise<void> | null>(null);
  const { createNotification } = useNotifications();
  const previousDataRef = useRef<ScoreBoardData[]>(cachedData || []);

  const fetchData = useCallback(async (forceRefresh: boolean = false, isBackground: boolean = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
      }
      setError(null);
      
      const progressCallback: ProgressCallback = (progress) => {
        if (!isBackground) {
          updateProgress('score-board', {
            progress: progress.percentage,
            status: progress.stage === 'complete' ? 'complete' : 'loading',
            message: progress.message,
            rowsLoaded: progress.rowsProcessed,
            totalRows: progress.totalRows,
          });
        }
      };
      
      if (!isBackground) {
        updateProgress('score-board', {
          status: 'loading',
          progress: 0,
        });
      }
      
      const fetchedData = await fetchScoreBoardData(forceRefresh, progressCallback);
      
      // Detect data changes
      const changes = detectDataChanges(
        previousDataRef.current,
        fetchedData,
        (item) => `${item.ticker}-${item.companyName}`,
        0.05 // 5% threshold
      );
      
      // Update data
      setData(fetchedData);
      previousDataRef.current = fetchedData;
      setLastUpdated(new Date());
      
      // Show notification if significant changes detected
      if (changes.hasSignificantChanges && !isBackground) {
        const changeMessage = formatChangeSummary(changes);
        createNotification(
          'data-update',
          'Score Board Data Updated',
          `Total: ${changes.total} items. ${changeMessage}`,
          {
            showDesktop: true,
            data: { changes, dataType: 'score-board' },
          }
        );
      }
      
      if (!isBackground) {
        updateProgress('score-board', {
          status: 'complete',
          progress: 100,
        });
      }
    } catch (err: unknown) {
      const errorHandler = createErrorHandler({
        operation: 'fetch Score Board data',
        component: 'useScoreBoardData',
        additionalInfo: { forceRefresh, isBackground },
      });
      const formatted = errorHandler(err);
      setError(formatted.userMessage);
      if (!isBackground) {
        updateProgress('score-board', {
          status: 'error',
          progress: 0,
          message: formatted.userMessage,
        });
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  }, [updateProgress]);

  // Background revalidate (stale-while-revalidate pattern)
  const revalidateInBackground = useCallback(async () => {
    // Only revalidate if page is visible and not already updating
    if (!isPageVisible || backgroundUpdateRef.current) {
      return;
    }

    // Only revalidate if cache is stale (5-20 minutes old)
    if (!isStale) {
      return;
    }

    backgroundUpdateRef.current = fetchData(false, true);
    try {
      await backgroundUpdateRef.current;
    } finally {
      backgroundUpdateRef.current = null;
    }
  }, [isPageVisible, isStale, fetchData]);

  // Initial fetch - only if we don't have cache or cache is expired
  useEffect(() => {
    if (!hasInitialData) {
      fetchData();
    } else if (isStale && isPageVisible) {
      // Stale-while-revalidate: show cache immediately, update in background
      revalidateInBackground();
    }
    // If cache is fresh, no need to fetch or revalidate
  }, [fetchData, hasInitialData, isStale, isPageVisible, revalidateInBackground]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refetch: (forceRefresh?: boolean) => fetchData(forceRefresh ?? false),
  };
}


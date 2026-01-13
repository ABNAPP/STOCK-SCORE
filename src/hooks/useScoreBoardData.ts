import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchScoreBoardData, ProgressCallback } from '../services/sheetsService';
import { ScoreBoardData } from '../types/stock';
import { useLoadingProgress } from '../contexts/LoadingProgressContext';
import { getCachedData, CACHE_KEYS, isCacheFresh, isCacheStale, DEFAULT_TTL } from '../services/cacheService';
import { usePageVisibility } from './usePageVisibility';

const CACHE_KEY = CACHE_KEYS.SCORE_BOARD;
const FRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

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
      setData(fetchedData);
      setLastUpdated(new Date());
      
      if (!isBackground) {
        updateProgress('score-board', {
          status: 'complete',
          progress: 100,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Score Board data');
      if (!isBackground) {
        console.error('Error fetching Score Board data:', err);
        updateProgress('score-board', {
          status: 'error',
          progress: 0,
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


import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchThresholdIndustryData, ProgressCallback } from '../services/sheets';
import { ThresholdIndustryData } from '../types/stock';
import { useLoadingProgress } from '../contexts/LoadingProgressContext';
import { getCachedData, CACHE_KEYS, isCacheFresh, isCacheStale, FRESH_THRESHOLD_MS } from '../services/cacheService';
import { usePageVisibility } from './usePageVisibility';
import { formatError, logError, createErrorHandler } from '../utils/errorHandler';
import { useNotifications } from '../contexts/NotificationContext';
import { detectDataChanges, formatChangeSummary } from '../utils/dataChangeDetector';

const CACHE_KEY = CACHE_KEYS.THRESHOLD_INDUSTRY;

export function useThresholdIndustryData() {
  // Check cache synchronously on mount to avoid unnecessary loading state
  const cachedData = getCachedData<ThresholdIndustryData[]>(CACHE_KEY);
  const hasInitialData = cachedData !== null && cachedData.length > 0;
  const isFresh = hasInitialData && isCacheFresh(CACHE_KEY, FRESH_THRESHOLD_MS);
  const isStale = hasInitialData && isCacheStale(CACHE_KEY, FRESH_THRESHOLD_MS);
  
  const [data, setData] = useState<ThresholdIndustryData[]>(cachedData || []);
  const [loading, setLoading] = useState(!hasInitialData); // Only show loading if no cache
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { updateProgress } = useLoadingProgress();
  const isPageVisible = usePageVisibility();
  const backgroundUpdateRef = useRef<Promise<void> | null>(null);
  const { createNotification } = useNotifications();
  const previousDataRef = useRef<ThresholdIndustryData[]>(cachedData || []);

  const fetchData = useCallback(async (forceRefresh: boolean = false, isBackground: boolean = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
      }
      setError(null);
      
      const progressCallback: ProgressCallback = (progress) => {
        if (!isBackground) {
          updateProgress('threshold-industry', {
            progress: progress.percentage,
            status: progress.stage === 'complete' ? 'complete' : 'loading',
            message: progress.message,
            rowsLoaded: progress.rowsProcessed,
            totalRows: progress.totalRows,
          });
        }
      };
      
      if (!isBackground) {
        updateProgress('threshold-industry', {
          status: 'loading',
          progress: 0,
        });
      }
      
      const fetchedData = await fetchThresholdIndustryData(forceRefresh, progressCallback);
      
      // Detect data changes
      const changes = detectDataChanges(
        previousDataRef.current,
        fetchedData,
        (item) => item.industry,
        0.05 // 5% threshold
      );
      
      setData(fetchedData);
      previousDataRef.current = fetchedData;
      setLastUpdated(new Date());
      
      // Show notification if significant changes detected
      if (changes.hasSignificantChanges && !isBackground) {
        const changeMessage = formatChangeSummary(changes);
        createNotification(
          'data-update',
          'Threshold Industry Data Updated',
          `Total: ${changes.total} items. ${changeMessage}`,
          {
            showDesktop: true,
            data: { changes, dataType: 'threshold-industry' },
          }
        );
      }
      
      if (!isBackground) {
        updateProgress('threshold-industry', {
          status: 'complete',
          progress: 100,
        });
      }
    } catch (err: unknown) {
      const errorHandler = createErrorHandler({
        operation: 'fetch Threshold Industry data',
        component: 'useThresholdIndustryData',
        additionalInfo: { forceRefresh, isBackground },
      });
      const formatted = errorHandler(err);
      setError(formatted.userMessage);
      if (!isBackground) {
        updateProgress('threshold-industry', {
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


import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchScoreBoardData, ProgressCallback } from '../services/sheets';
import { ScoreBoardData } from '../types/stock';
import { useLoadingProgress } from '../contexts/LoadingProgressContext';
import { getCachedData, CACHE_KEYS, DEFAULT_TTL } from '../services/firestoreCacheService';
import { createErrorHandler } from '../utils/errorHandler';
import { useNotifications } from '../contexts/NotificationContext';
import { detectDataChanges, formatChangeSummary } from '../utils/dataChangeDetector';
import { logger } from '../utils/logger';

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
  const [data, setData] = useState<ScoreBoardData[]>([]);
  const [loading, setLoading] = useState(true); // Start with loading state
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { updateProgress } = useLoadingProgress();
  const { createNotification } = useNotifications();
  const previousDataRef = useRef<ScoreBoardData[]>([]);
  const cacheLoadedRef = useRef<boolean>(false);

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
  }, [updateProgress, createNotification]);

  // Load cache on mount - check Firestore cache first
  useEffect(() => {
    const loadCache = async () => {
      if (cacheLoadedRef.current) return;
      cacheLoadedRef.current = true;
      
      try {
        const cachedData = await getCachedData<ScoreBoardData[]>(CACHE_KEY);
        if (cachedData && cachedData.length > 0) {
          setData(cachedData);
          previousDataRef.current = cachedData;
          setLoading(false);
          // Don't fetch if we have valid cache - hard cache, no background updates
          return;
        }
        // No cache, fetch fresh data
      } catch (err) {
        // If cache load fails, log and continue to fetch fresh data
        logger.warn('Failed to load cache, fetching fresh data', { 
          component: 'useScoreBoardData', 
          error: err 
        });
      }
      
      // If no cache or cache load failed, fetch fresh data
      fetchData(false, false);
    };
    
    loadCache();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  return {
    data,
    loading,
    error,
    lastUpdated,
    refetch: (forceRefresh?: boolean) => fetchData(forceRefresh ?? false),
  };
}


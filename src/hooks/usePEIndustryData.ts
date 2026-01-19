import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchPEIndustryData, ProgressCallback } from '../services/sheets';
import { PEIndustryData } from '../types/stock';
import { useLoadingProgress } from '../contexts/LoadingProgressContext';
import { getCachedData, CACHE_KEYS } from '../services/firestoreCacheService';
import { createErrorHandler } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { useNotifications } from '../contexts/NotificationContext';
import { detectDataChanges, formatChangeSummary } from '../utils/dataChangeDetector';

const CACHE_KEY = CACHE_KEYS.PE_INDUSTRY;

export function usePEIndustryData() {
  const [data, setData] = useState<PEIndustryData[]>([]);
  const [loading, setLoading] = useState(true); // Start with loading state
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { updateProgress } = useLoadingProgress();
  const { createNotification } = useNotifications();
  const previousDataRef = useRef<PEIndustryData[]>([]);
  const cacheLoadedRef = useRef<boolean>(false);

  const fetchData = useCallback(async (forceRefresh: boolean = false, isBackground: boolean = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
      }
      setError(null);
      
      const progressCallback: ProgressCallback = (progress) => {
        if (!isBackground) {
          updateProgress('pe-industry', {
            progress: progress.percentage,
            status: progress.stage === 'complete' ? 'complete' : 'loading',
            message: progress.message,
            rowsLoaded: progress.rowsProcessed,
            totalRows: progress.totalRows,
          });
        }
      };
      
      if (!isBackground) {
        updateProgress('pe-industry', {
          status: 'loading',
          progress: 0,
        });
      }
      
      const fetchedData = await fetchPEIndustryData(forceRefresh, progressCallback);
      
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
          'P/E Industry Data Updated',
          `Total: ${changes.total} items. ${changeMessage}`,
          {
            showDesktop: true,
            data: { changes, dataType: 'pe-industry' },
          }
        );
      }
      
      if (!isBackground) {
        updateProgress('pe-industry', {
          status: 'complete',
          progress: 100,
        });
      }
    } catch (err: unknown) {
      const errorHandler = createErrorHandler({
        operation: 'fetch P/E Industry data',
        component: 'usePEIndustryData',
        additionalInfo: { forceRefresh, isBackground },
      });
      const formatted = errorHandler(err);
      setError(formatted.userMessage);
      if (!isBackground) {
        updateProgress('pe-industry', {
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
        const cachedData = await getCachedData<PEIndustryData[]>(CACHE_KEY);
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
          component: 'usePEIndustryData', 
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


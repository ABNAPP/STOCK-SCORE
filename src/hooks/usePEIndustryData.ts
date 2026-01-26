import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchPEIndustryData, ProgressCallback } from '../services/sheets';
import { transformPEIndustryData } from '../services/sheets/peIndustryService';
import type { DataRow } from '../services/sheets';
import { PEIndustryData } from '../types/stock';
import { useLoadingProgress } from '../contexts/LoadingProgressContext';
import { getCachedData, getDeltaCacheEntry, setDeltaCacheEntry, CACHE_KEYS } from '../services/firestoreCacheService';
import { createErrorHandler, logError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { useNotifications } from '../contexts/NotificationContext';
import { detectDataChanges, formatChangeSummary } from '../utils/dataChangeDetector';
import { 
  initSync, 
  pollChanges, 
  loadSnapshot, 
  applyChangesToCache,
  isDeltaSyncEnabled,
  getPollIntervalMs,
  snapshotToTransformerFormat,
  type DeltaSyncConfig
} from '../services/deltaSyncService';
import { usePageVisibility } from './usePageVisibility';

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';
const SHEET_NAME = 'DashBoard';
const CACHE_KEY = CACHE_KEYS.PE_INDUSTRY;

/**
 * Custom hook for fetching and managing P/E Industry data with delta sync
 * 
 * Implements delta sync for efficient data updates:
 * - **Delta Sync (enabled)**: Uses version-based incremental updates
 *   - Initial load: Full snapshot
 *   - Subsequent updates: Only changed rows (polling every 15 minutes)
 *   - Automatic polling when page is visible
 * - **Fallback (disabled)**: Uses regular fetch with stale-while-revalidate
 * 
 * **Delta Sync Strategy:**
 * - Polls for changes every 15 minutes (configurable)
 * - Only polls when page is visible (saves resources)
 * - Falls back to regular fetch if delta sync fails
 * - Uses version numbers to track changes efficiently
 * 
 * **Cache Strategy:**
 * - Delta cache: Version-based with lastUpdated timestamp
 * - Regular cache: TTL-based (20 minutes)
 * - Shows cached data immediately, updates in background
 * 
 * @returns Object with data, loading state, error, lastUpdated timestamp, and refetch function
 */
export function usePEIndustryData() {
  const [data, setData] = useState<PEIndustryData[]>([]);
  const [loading, setLoading] = useState(true); // Start with loading state
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { updateProgress } = useLoadingProgress();
  const isPageVisible = usePageVisibility();
  const currentVersionRef = useRef<number>(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { createNotification } = useNotifications();
  const previousDataRef = useRef<PEIndustryData[]>([]);
  const cacheLoadedRef = useRef<boolean>(false);

  // Load data using delta-sync or fallback to regular fetch
  const loadData = useCallback(async (forceRefresh: boolean = false, isBackground: boolean = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
      }
      setError(null);
      
      if (!isBackground) {
        updateProgress('pe-industry', {
          status: 'loading',
          progress: 0,
          message: 'Loading data...',
        });
      }

      // Try delta-sync if enabled
      if (isDeltaSyncEnabled() && APPS_SCRIPT_URL && !forceRefresh) {
        try {
          const config: DeltaSyncConfig = {
            sheetName: SHEET_NAME,
            apiBaseUrl: APPS_SCRIPT_URL,
          };

          // Load initial snapshot or use cached data
          const result = await initSync<PEIndustryData>(
            config,
            CACHE_KEY,
            transformPEIndustryData
          );

          // Detect data changes
          const changes = detectDataChanges(
            previousDataRef.current,
            result.data,
            (item) => item.industry,
            0.05 // 5% threshold
          );
          
          setData(result.data);
          previousDataRef.current = result.data;
          currentVersionRef.current = result.version;
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
              message: 'Data loaded',
            });
          }
          
          if (!isBackground) {
            setLoading(false);
          }
          return;
        } catch (deltaSyncError) {
          // Delta sync failed, fallback to regular fetch
          const errorMessage = deltaSyncError instanceof Error ? deltaSyncError.message : String(deltaSyncError);
          
          // Only log warning if it's not a timeout (timeouts are expected and will fallback)
          if (!errorMessage.includes('timeout') && !errorMessage.includes('Request timeout')) {
            logger.warn(
              `Delta sync failed for ${SHEET_NAME}, falling back to regular fetch: ${errorMessage}`,
              { component: 'usePEIndustryData', operation: 'initialize delta sync', sheetName: SHEET_NAME, error: deltaSyncError }
            );
          } else {
            logger.debug(
              `Delta sync timed out for ${SHEET_NAME}, using regular fetch instead`,
              { component: 'usePEIndustryData', operation: 'initialize delta sync', sheetName: SHEET_NAME }
            );
          }
          // Don't throw - fallback to regular fetch
        }
      }

      // Fallback to regular fetch
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

  // Poll for changes using delta-sync
  const pollForChanges = useCallback(async () => {
    // Only poll if page is visible
    if (!isPageVisible) {
      return;
    }

    if (!isDeltaSyncEnabled() || !APPS_SCRIPT_URL || currentVersionRef.current === 0) {
      return;
    }

    try {
      const config: DeltaSyncConfig = {
        sheetName: SHEET_NAME,
        apiBaseUrl: APPS_SCRIPT_URL,
      };

      const changesResponse = await pollChanges(config, currentVersionRef.current);
      const cacheResult = await applyChangesToCache<PEIndustryData>(changesResponse, CACHE_KEY);

      if (cacheResult.needsReload) {
        // Changes detected, reload snapshot
        const snapshot = await loadSnapshot(config);
        const transformerFormat = snapshotToTransformerFormat(snapshot);
        const transformedData = transformPEIndustryData(transformerFormat);
        setDeltaCacheEntry(CACHE_KEY, transformedData, snapshot.version, true);
        
        // Detect data changes
        const dataChanges = detectDataChanges(
          previousDataRef.current,
          transformedData,
          (item) => item.industry,
          0.05 // 5% threshold
        );
        
        setData(transformedData);
        previousDataRef.current = transformedData;
        currentVersionRef.current = snapshot.version;
        setLastUpdated(new Date());
        
        // Show notification if significant changes detected
        if (dataChanges.hasSignificantChanges) {
          const changeMessage = formatChangeSummary(dataChanges);
          createNotification(
            'data-update',
            'P/E Industry Data Updated',
            `Total: ${dataChanges.total} items. ${changeMessage}`,
            {
              showDesktop: true,
              data: { changes: dataChanges, dataType: 'pe-industry' },
            }
          );
        }
      } else if (cacheResult.data) {
        // No changes, use cached data
        setData(cacheResult.data);
        currentVersionRef.current = cacheResult.version;
      }
    } catch (pollError) {
      // Silently fail polling - don't show errors to user
      const errorHandler = createErrorHandler({
        operation: 'poll for changes',
        component: 'usePEIndustryData',
        additionalInfo: { version: currentVersionRef.current },
      });
      logError(pollError, errorHandler({}).context);
      // Don't set error state - polling failures should be silent
    }
  }, [isPageVisible, createNotification]);

  // Load cache on mount - check Firestore cache first
  useEffect(() => {
    const loadCache = async () => {
      if (cacheLoadedRef.current) return;
      cacheLoadedRef.current = true;
      
      try {
        // Try delta cache first, then fallback to regular cache
        const deltaCacheEntry = await getDeltaCacheEntry<PEIndustryData[]>(CACHE_KEY);
        const regularCache = deltaCacheEntry ? null : await getCachedData<PEIndustryData[]>(CACHE_KEY);
        const cachedData = deltaCacheEntry?.data || regularCache;
        
        if (cachedData && cachedData.length > 0) {
          setData(cachedData);
          previousDataRef.current = cachedData;
          currentVersionRef.current = deltaCacheEntry?.version || 0;
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
      loadData(false, false);
    };
    
    loadCache();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Set up polling for changes (delta-sync only)
  useEffect(() => {
    if (isDeltaSyncEnabled() && APPS_SCRIPT_URL && isPageVisible) {
      const intervalMs = getPollIntervalMs();
      
      // Poll immediately after initial load (with delay)
      const initialPollTimeout = setTimeout(() => {
        pollForChanges();
      }, 5000); // Wait 5 seconds after initial load

      // Set up periodic polling (only when page is visible)
      pollIntervalRef.current = setInterval(() => {
        pollForChanges();
      }, intervalMs);

      return () => {
        clearTimeout(initialPollTimeout);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    } else {
      // Clear interval if page becomes hidden or delta-sync is disabled
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
  }, [pollForChanges, isPageVisible]);

  const refetch = useCallback((forceRefresh?: boolean) => {
    loadData(forceRefresh ?? false);
  }, [loadData]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refetch,
  };
}


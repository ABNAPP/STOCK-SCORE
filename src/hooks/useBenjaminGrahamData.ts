import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  fetchBenjaminGrahamData, 
  ProgressCallback,
  getValue,
  isValidValue,
  parseNumericValueNullable
} from '../services/sheetsService';
import type { DataRow } from '../services/sheetsService';
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
import { setDeltaCacheEntry } from '../services/cacheService';
import { CACHE_KEYS } from '../services/cacheService';
import { BenjaminGrahamData } from '../types/stock';
import { useLoadingProgress } from '../contexts/LoadingProgressContext';

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';
const SHEET_NAME = 'DashBoard';
const CACHE_KEY = CACHE_KEYS.BENJAMIN_GRAHAM;

// Transformer function for Benjamin Graham data
function transformBenjaminGrahamData(results: { data: DataRow[]; meta: { fields: string[] | null } }): BenjaminGrahamData[] {
  const benjaminGrahamData = results.data
    .map((row: DataRow) => {
      const companyName = getValue(['Company Name', 'Company', 'company'], row);
      const ticker = getValue(['Ticker', 'ticker', 'Ticket', 'ticket', 'Symbol', 'symbol'], row);
      const priceStr = getValue(['Price', 'price', 'PRICE'], row);
      const benjaminGrahamStr = getValue(['Benjamin Graham', 'benjamin graham', 'Benjamin', 'benjamin'], row);
      
      // Only process if company name is valid (not #N/A)
      if (!isValidValue(companyName)) {
        return null;
      }
      
      // Filter out rows where Ticker is N/A (DashBoard rule: if Ticker is N/A, don't fetch data)
      if (!isValidValue(ticker)) {
        return null;
      }
      
      // Parse Price value as number (handle #N/A)
      const price = parseNumericValueNullable(priceStr);
      
      // Parse Benjamin Graham value as number (handle #N/A)
      const benjaminGraham = parseNumericValueNullable(benjaminGrahamStr);
      
      // Parse IV (FCF) if it exists
      const ivFcfStr = getValue(['IV (FCF)', 'IV(FCF)', 'iv fcf', 'ivfcf'], row);
      const ivFcf = parseNumericValueNullable(ivFcfStr);
      
      // Parse IRR1 if it exists
      const irr1Str = getValue(['IRR1', 'irr1', 'IRR 1', 'irr 1'], row);
      const irr1 = parseNumericValueNullable(irr1Str);
      
      // Include row if both company name and ticker are valid (we already checked above)
      return {
        companyName: companyName,
        ticker: ticker,
        price: price,
        benjaminGraham: benjaminGraham,
        ivFcf: ivFcf, // Include if it exists
        irr1: irr1, // Include if it exists
      };
    })
    .filter((data) => data !== null) as BenjaminGrahamData[];
  
  return benjaminGrahamData;
}

export function useBenjaminGrahamData() {
  const [data, setData] = useState<BenjaminGrahamData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { updateProgress } = useLoadingProgress();
  const currentVersionRef = useRef<number>(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load data using delta-sync or fallback to regular fetch
  const loadData = useCallback(async (forceRefresh: boolean = false) => {
    try {
      setLoading(true);
      setError(null);
      
      updateProgress('benjamin-graham', {
        status: 'loading',
        progress: 0,
        message: 'Loading data...',
      });

      // Try delta-sync if enabled
      if (isDeltaSyncEnabled() && APPS_SCRIPT_URL && !forceRefresh) {
        try {
          const config: DeltaSyncConfig = {
            sheetName: SHEET_NAME,
            apiBaseUrl: APPS_SCRIPT_URL,
          };

          // Load initial snapshot or use cached data
          const result = await initSync<BenjaminGrahamData>(
            config,
            CACHE_KEY,
            transformBenjaminGrahamData
          );

          setData(result.data);
          currentVersionRef.current = result.version;
          setLastUpdated(new Date());
          
          updateProgress('benjamin-graham', {
            status: 'complete',
            progress: 100,
            message: 'Data loaded',
          });
          
          setLoading(false);
          return;
        } catch (deltaSyncError) {
          // Delta sync failed, fallback to regular fetch
          console.warn('Delta sync failed, falling back to regular fetch:', deltaSyncError);
        }
      }

      // Fallback to regular fetch
      const progressCallback: ProgressCallback = (progress) => {
        updateProgress('benjamin-graham', {
          progress: progress.percentage,
          status: progress.stage === 'complete' ? 'complete' : 'loading',
          message: progress.message,
          rowsLoaded: progress.rowsProcessed,
          totalRows: progress.totalRows,
        });
      };
      
      const fetchedData = await fetchBenjaminGrahamData(forceRefresh, progressCallback);
      setData(fetchedData);
      setLastUpdated(new Date());
      
      updateProgress('benjamin-graham', {
        status: 'complete',
        progress: 100,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Benjamin Graham data');
      console.error('Error fetching Benjamin Graham data:', err);
      updateProgress('benjamin-graham', {
        status: 'error',
        progress: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [updateProgress]);

  // Poll for changes using delta-sync
  const pollForChanges = useCallback(async () => {
    if (!isDeltaSyncEnabled() || !APPS_SCRIPT_URL || currentVersionRef.current === 0) {
      return;
    }

    try {
      const config: DeltaSyncConfig = {
        sheetName: SHEET_NAME,
        apiBaseUrl: APPS_SCRIPT_URL,
      };

      const changes = await pollChanges(config, currentVersionRef.current);
      const cacheResult = applyChangesToCache<BenjaminGrahamData>(changes, CACHE_KEY);

      if (cacheResult.needsReload) {
        // Changes detected, reload snapshot
        const snapshot = await loadSnapshot(config);
        const transformerFormat = snapshotToTransformerFormat(snapshot);
        const transformedData = transformBenjaminGrahamData(transformerFormat);
        setDeltaCacheEntry(CACHE_KEY, transformedData, snapshot.version, true);
        
        setData(transformedData);
        currentVersionRef.current = snapshot.version;
        setLastUpdated(new Date());
      } else if (cacheResult.data) {
        // No changes, use cached data
        setData(cacheResult.data);
        currentVersionRef.current = cacheResult.version;
      }
    } catch (pollError) {
      // Silently fail polling - don't show errors to user
      console.warn('Polling for changes failed:', pollError);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set up polling for changes
  useEffect(() => {
    if (isDeltaSyncEnabled() && APPS_SCRIPT_URL) {
      const intervalMs = getPollIntervalMs();
      
      // Poll immediately after initial load (with delay)
      const initialPollTimeout = setTimeout(() => {
        pollForChanges();
      }, 5000); // Wait 5 seconds after initial load

      // Set up periodic polling
      pollIntervalRef.current = setInterval(() => {
        pollForChanges();
      }, intervalMs);

      return () => {
        clearTimeout(initialPollTimeout);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    }
  }, [pollForChanges]);

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


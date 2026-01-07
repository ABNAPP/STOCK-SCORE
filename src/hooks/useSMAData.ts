import { useState, useEffect, useCallback } from 'react';
import { fetchSMAData, ProgressCallback } from '../services/sheetsService';
import { SMAData } from '../types/stock';
import { useLoadingProgress } from '../contexts/LoadingProgressContext';

export function useSMAData() {
  const [data, setData] = useState<SMAData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { updateProgress } = useLoadingProgress();

  const fetchData = useCallback(async (forceRefresh: boolean = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const progressCallback: ProgressCallback = (progress) => {
        updateProgress('sma', {
          progress: progress.percentage,
          status: progress.stage === 'complete' ? 'complete' : 'loading',
          message: progress.message,
          rowsLoaded: progress.rowsProcessed,
          totalRows: progress.totalRows,
        });
      };
      
      updateProgress('sma', {
        status: 'loading',
        progress: 0,
      });
      
      const fetchedData = await fetchSMAData(forceRefresh, progressCallback);
      setData(fetchedData);
      setLastUpdated(new Date());
      
      updateProgress('sma', {
        status: 'complete',
        progress: 100,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch SMA data');
      console.error('Error fetching SMA data:', err);
      updateProgress('sma', {
        status: 'error',
        progress: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [updateProgress]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refetch: (forceRefresh?: boolean) => fetchData(forceRefresh ?? false),
  };
}


import { useState, useEffect, useCallback } from 'react';
import { fetchBenjaminGrahamData, ProgressCallback } from '../services/sheetsService';
import { BenjaminGrahamData } from '../types/stock';
import { useLoadingProgress } from '../contexts/LoadingProgressContext';

export function useBenjaminGrahamData() {
  const [data, setData] = useState<BenjaminGrahamData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { updateProgress } = useLoadingProgress();

  const fetchData = useCallback(async (forceRefresh: boolean = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const progressCallback: ProgressCallback = (progress) => {
        updateProgress('benjamin-graham', {
          progress: progress.percentage,
          status: progress.stage === 'complete' ? 'complete' : 'loading',
          message: progress.message,
          rowsLoaded: progress.rowsProcessed,
          totalRows: progress.totalRows,
        });
      };
      
      updateProgress('benjamin-graham', {
        status: 'loading',
        progress: 0,
      });
      
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


import { useState, useEffect, useCallback } from 'react';
import { fetchPEIndustryData, ProgressCallback } from '../services/sheetsService';
import { PEIndustryData } from '../types/stock';
import { useLoadingProgress } from '../contexts/LoadingProgressContext';

export function usePEIndustryData() {
  const [data, setData] = useState<PEIndustryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { updateProgress } = useLoadingProgress();

  const fetchData = useCallback(async (forceRefresh: boolean = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const progressCallback: ProgressCallback = (progress) => {
        updateProgress('pe-industry', {
          progress: progress.percentage,
          status: progress.stage === 'complete' ? 'complete' : 'loading',
          message: progress.message,
          rowsLoaded: progress.rowsProcessed,
          totalRows: progress.totalRows,
        });
      };
      
      updateProgress('pe-industry', {
        status: 'loading',
        progress: 0,
      });
      
      const fetchedData = await fetchPEIndustryData(forceRefresh, progressCallback);
      setData(fetchedData);
      setLastUpdated(new Date());
      
      updateProgress('pe-industry', {
        status: 'complete',
        progress: 100,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch P/E Industry data');
      console.error('Error fetching P/E Industry data:', err);
      updateProgress('pe-industry', {
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


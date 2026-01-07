import { useState, useEffect, useCallback } from 'react';
import { fetchThresholdIndustryData, ProgressCallback } from '../services/sheetsService';
import { ThresholdIndustryData } from '../types/stock';
import { useLoadingProgress } from '../contexts/LoadingProgressContext';

export function useThresholdIndustryData() {
  const [data, setData] = useState<ThresholdIndustryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { updateProgress } = useLoadingProgress();

  const fetchData = useCallback(async (forceRefresh: boolean = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const progressCallback: ProgressCallback = (progress) => {
        updateProgress('threshold-industry', {
          progress: progress.percentage,
          status: progress.stage === 'complete' ? 'complete' : 'loading',
          message: progress.message,
          rowsLoaded: progress.rowsProcessed,
          totalRows: progress.totalRows,
        });
      };
      
      updateProgress('threshold-industry', {
        status: 'loading',
        progress: 0,
      });
      
      const fetchedData = await fetchThresholdIndustryData(forceRefresh, progressCallback);
      setData(fetchedData);
      setLastUpdated(new Date());
      
      updateProgress('threshold-industry', {
        status: 'complete',
        progress: 100,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Threshold Industry data');
      console.error('Error fetching Threshold Industry data:', err);
      updateProgress('threshold-industry', {
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


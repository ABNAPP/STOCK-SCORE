import { useState, useEffect, useCallback } from 'react';
import { fetchScoreBoardData, ProgressCallback } from '../services/sheetsService';
import { ScoreBoardData } from '../types/stock';
import { useLoadingProgress } from '../contexts/LoadingProgressContext';

export function useScoreBoardData() {
  const [data, setData] = useState<ScoreBoardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { updateProgress } = useLoadingProgress();

  const fetchData = useCallback(async (forceRefresh: boolean = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const progressCallback: ProgressCallback = (progress) => {
        updateProgress('score-board', {
          progress: progress.percentage,
          status: progress.stage === 'complete' ? 'complete' : 'loading',
          message: progress.message,
          rowsLoaded: progress.rowsProcessed,
          totalRows: progress.totalRows,
        });
      };
      
      updateProgress('score-board', {
        status: 'loading',
        progress: 0,
      });
      
      const fetchedData = await fetchScoreBoardData(forceRefresh, progressCallback);
      setData(fetchedData);
      setLastUpdated(new Date());
      
      updateProgress('score-board', {
        status: 'complete',
        progress: 100,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Score Board data');
      console.error('Error fetching Score Board data:', err);
      updateProgress('score-board', {
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


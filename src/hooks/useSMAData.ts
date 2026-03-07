import { useState, useEffect, useCallback } from 'react';
import { SMAData } from '../types/stock';
import { fetchSMAData } from '../services/sheets/smaService';

/**
 * Hook to load SMA (Simple Moving Average) data from Google Sheets.
 * Used by the SMA view to display the SMA(200) table.
 *
 * @returns Object with data, loading state, error, and refetch function
 */
export function useSMAData() {
  const [data, setData] = useState<SMAData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchSMAData(forceRefresh);
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load SMA data';
      setError(message);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refetch = useCallback(() => load(true), [load]);

  return { data, loading, error, refetch };
}

import { useState, useEffect, useCallback, useContext } from 'react';
import { ThresholdIndustryData } from '../types/stock';
import { STATIC_THRESHOLD_INDUSTRY_DATA } from '../config/thresholdIndustryData';
import { ThresholdContext } from '../contexts/ThresholdContext';

/**
 * Hook to load threshold industry data from static file
 * 
 * Previously fetched from Google Sheets, now loads from static configuration file.
 * Manual changes to threshold values are persisted in Firestore and localStorage
 * via ThresholdContext.
 * 
 * Note: initializeFromData will only be called if ThresholdProvider is available.
 * If the hook is used outside ThresholdProvider, data will still load but won't
 * initialize the context (ThresholdIndustryTable will handle initialization when
 * rendered inside ThresholdProvider).
 * 
 * @returns Object with data, loading state, error, lastUpdated timestamp, and refetch function
 */
export function useThresholdIndustryData() {
  const [data, setData] = useState<ThresholdIndustryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Safely get initializeFromData - will be undefined if ThresholdProvider is not available
  // Using useContext directly allows us to check if provider exists without throwing
  const thresholdContext = useContext(ThresholdContext);
  const initializeFromData = thresholdContext?.initializeFromData;

  // Load static data on mount
  useEffect(() => {
    try {
      // Load data from static file (synchronous)
      const staticData = STATIC_THRESHOLD_INDUSTRY_DATA;
      
      setData(staticData);
      setLastUpdated(new Date());
      setError(null);
      
      // Initialize ThresholdContext with static data if available
      if (initializeFromData) {
        initializeFromData(staticData);
      }
      
      // Set loading to false after a brief delay to maintain consistent loading behavior
      // This ensures components that check loading state see a consistent pattern
      setTimeout(() => {
        setLoading(false);
      }, 0);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load threshold industry data';
      setError(errorMessage);
      setLoading(false);
    }
  }, [initializeFromData]);

  // Refetch function - reloads from static file (no network call)
  const refetch = useCallback((_forceRefresh?: boolean) => {
    setLoading(true);
    setError(null);
    
    try {
      const staticData = STATIC_THRESHOLD_INDUSTRY_DATA;
      setData(staticData);
      setLastUpdated(new Date());
      // Initialize ThresholdContext with static data if available
      if (initializeFromData) {
        initializeFromData(staticData);
      }
      
      setTimeout(() => {
        setLoading(false);
      }, 0);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reload threshold industry data';
      setError(errorMessage);
      setLoading(false);
    }
  }, [initializeFromData]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refetch,
  };
}

import { useState, useEffect, useCallback, useContext } from 'react';
import { IndustryThresholdData } from '../types/stock';
import { INDUSTRY_MAP } from '../config/industryThresholdData';
import { ThresholdContext } from '../contexts/ThresholdContext';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { ThresholdValues } from '../contexts/ThresholdContext';

/**
 * Hook to load  Industry threshold data from static file
 * 
 * Previously fetched from Google Sheets, now loads from static configuration file.
 * Manual changes to threshold values are persisted in Firestore
 * via ThresholdContext.
 * 
 * Note: initializeFromData will only be called if ThresholdProvider is available.
 * If the hook is used outside ThresholdProvider, data will still load but won't
 * initialize the context (IndustryThresholdTable will handle initialization when
 * rendered inside ThresholdProvider).
 * 
 * @returns Object with data, loading state, error, lastUpdated timestamp, and refetch function
 */
export function useIndustryThresholdData() {
  const [data, setData] = useState<IndustryThresholdData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { currentUser } = useAuth();
  
  // Safely get initializeFromData - will be undefined if ThresholdProvider is not available
  // Using useContext directly allows us to check if provider exists without throwing
  const thresholdContext = useContext(ThresholdContext);
  const initializeFromData = thresholdContext?.initializeFromData;

  // Load data from Firestore on mount
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const valueMap: Record<string, ThresholdValues> = {};
        if (currentUser) {
          const snapshot = await getDocs(collection(db, 'industryThresholds'));
          snapshot.forEach((docSnap) => {
            valueMap[docSnap.id] = docSnap.data() as ThresholdValues;
          });
        }
        const rows: IndustryThresholdData[] = Object.entries(INDUSTRY_MAP).map(([industryKey, industry]) => {
          const entry = valueMap[industryKey] as ThresholdValues | undefined;
          return {
            industryKey,
            industry,
            irr: entry?.irr ?? 0,
            leverageF2Min: entry?.leverageF2Min ?? 0,
            leverageF2Max: entry?.leverageF2Max ?? 0,
            ro40Min: entry?.ro40Min ?? 0,
            ro40Max: entry?.ro40Max ?? 0,
            cashSdebtMin: entry?.cashSdebtMin ?? 0,
            cashSdebtMax: entry?.cashSdebtMax ?? 0,
            currentRatioMin: entry?.currentRatioMin ?? 0,
            currentRatioMax: entry?.currentRatioMax ?? 0,
          };
        });
        if (!isMounted) return;
        setData(rows);
        setLastUpdated(new Date());
        if (initializeFromData) {
          initializeFromData(rows);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const errorMessage = err instanceof Error ? err.message : 'Failed to load  Industry threshold data';
        setError(errorMessage);
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [initializeFromData, currentUser]);

  // Refetch function - reloads from Firestore
  const refetch = useCallback((_forceRefresh?: boolean) => {
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const valueMap: Record<string, ThresholdValues> = {};
        if (currentUser) {
          const snapshot = await getDocs(collection(db, 'industryThresholds'));
          snapshot.forEach((docSnap) => {
            valueMap[docSnap.id] = docSnap.data() as ThresholdValues;
          });
        }
        const rows: IndustryThresholdData[] = Object.entries(INDUSTRY_MAP).map(([industryKey, industry]) => {
          const entry = valueMap[industryKey] as ThresholdValues | undefined;
          return {
            industryKey,
            industry,
            irr: entry?.irr ?? 0,
            leverageF2Min: entry?.leverageF2Min ?? 0,
            leverageF2Max: entry?.leverageF2Max ?? 0,
            ro40Min: entry?.ro40Min ?? 0,
            ro40Max: entry?.ro40Max ?? 0,
            cashSdebtMin: entry?.cashSdebtMin ?? 0,
            cashSdebtMax: entry?.cashSdebtMax ?? 0,
            currentRatioMin: entry?.currentRatioMin ?? 0,
            currentRatioMax: entry?.currentRatioMax ?? 0,
          };
        });
        setData(rows);
        setLastUpdated(new Date());
        if (initializeFromData) {
          initializeFromData(rows);
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to reload  Industry threshold data';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    })();
  }, [initializeFromData, currentUser]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refetch,
  };
}

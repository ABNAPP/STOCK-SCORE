/**
 * ISM ingest hook: DashBoard sheet snapshot (same source as Central Data Service) + ENTRY/EXIT currency only.
 * Cache-first: reads Firestore snapshot cache when present, then refreshes in the background when online (same idea as Score Board stale-while-revalidate).
 * Must render under `EntryExitProvider` (same pattern as Score Board).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useEntryExitValues } from '../contexts/EntryExitContext';
import type { DataRow } from '../services/sheets/types';
import { getCachedSheetSnapshot, getSheetSnapshot } from '../services/sheets/sheetSnapshotService';
import {
  buildEntryExitStubsFromDashboardRows,
  mergeIsmIngestFromDashboardRows,
  summarizeIsmIngest,
} from '../services/ism/mergeIsmIngest';
import type { ISMInstrumentIngest, ISMIngestSummary } from '../types/ismIngest';
import { logger } from '../utils/logger';

export interface UseIsmIngestDataResult {
  ingestRows: ISMInstrumentIngest[];
  summary: ISMIngestSummary;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refetch: (forceRefresh?: boolean | { skipFetch?: boolean }) => Promise<void>;
  getHasEntryExitRow: (ticker: string, companyName: string) => boolean;
}

export function useIsmIngestData(): UseIsmIngestDataResult {
  const [dashboardRows, setDashboardRows] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { getFieldValue, getEntryExitValue, initializeFromData } = useEntryExitValues();

  const loadDashboard = useCallback(async (forceRefresh: boolean, isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await getSheetSnapshot('DashBoard', {
        forceRefresh,
        preferCache: !forceRefresh,
      });
      setDashboardRows(result.data.rows);
      const ts = result.data.generatedAt;
      setLastUpdated(ts ? new Date(ts) : new Date());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.warn('ISM DashBoard snapshot load failed', {
        component: 'useIsmIngestData',
        operation: 'loadDashboard',
        error: msg,
      });
      if (!isBackground) {
        setError(msg);
        setDashboardRows([]);
        setLastUpdated(null);
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const cached = await getCachedSheetSnapshot('DashBoard');
        if (cancelled) return;
        if (cached?.rows?.length) {
          setDashboardRows(cached.rows);
          const ts = cached.generatedAt;
          setLastUpdated(ts ? new Date(ts) : new Date());
          setLoading(false);
          if (typeof navigator !== 'undefined' && navigator.onLine) {
            void loadDashboard(false, true);
          }
          return;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.warn('ISM DashBoard cache read failed', {
          component: 'useIsmIngestData',
          operation: 'initFromCache',
          error: msg,
        });
      }
      if (!cancelled) {
        void loadDashboard(false, false);
      }
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, [loadDashboard]);

  useEffect(() => {
    if (dashboardRows.length === 0) return;
    initializeFromData(buildEntryExitStubsFromDashboardRows(dashboardRows));
  }, [dashboardRows, initializeFromData]);

  const ingestRows = useMemo(
    () =>
      mergeIsmIngestFromDashboardRows(dashboardRows, (ticker, companyName) =>
        getFieldValue(ticker, companyName, 'currency')
      ),
    [dashboardRows, getFieldValue]
  );

  const summary = useMemo(() => summarizeIsmIngest(ingestRows), [ingestRows]);

  const refetch = useCallback(
    async (forceRefresh?: boolean | { skipFetch?: boolean }) => {
      if (forceRefresh && typeof forceRefresh === 'object' && forceRefresh.skipFetch) {
        setLoading(true);
        setError(null);
        try {
          const cached = await getCachedSheetSnapshot('DashBoard');
          if (cached?.rows?.length) {
            setDashboardRows(cached.rows);
            const ts = cached.generatedAt;
            setLastUpdated(ts ? new Date(ts) : new Date());
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          setError(msg);
        } finally {
          setLoading(false);
        }
        return;
      }
      const force = typeof forceRefresh === 'boolean' && forceRefresh;
      await loadDashboard(force, false);
    },
    [loadDashboard]
  );

  const getHasEntryExitRow = useCallback(
    (ticker: string, companyName: string) => getEntryExitValue(ticker, companyName) != null,
    [getEntryExitValue]
  );

  return {
    ingestRows,
    summary,
    loading,
    error,
    lastUpdated,
    refetch,
    getHasEntryExitRow,
  };
}

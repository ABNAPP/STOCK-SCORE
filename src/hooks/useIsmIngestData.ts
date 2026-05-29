/**
 * ISM ingest: main data from value-insight-be + ENTRY/EXIT currency only.
 * Must render under `EntryExitProvider`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useEntryExitValues } from '../contexts/EntryExitContext';
import type { DataRow } from '../services/sheets/types';
import { getMainData } from '../services/mainDataService';
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
  refetch: () => Promise<void>;
  getHasEntryExitRow: (ticker: string, companyName: string) => boolean;
}

export function useIsmIngestData(): UseIsmIngestDataResult {
  const [dashboardRows, setDashboardRows] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { getFieldValue, getEntryExitValue, initializeFromData } = useEntryExitValues();

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const mainData = await getMainData();
      setDashboardRows(mainData.rows);
      const ts = mainData.generatedAt;
      setLastUpdated(ts ? new Date(ts) : new Date());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.warn('ISM main data load failed', {
        component: 'useIsmIngestData',
        operation: 'loadDashboard',
        error: msg,
      });
      setError(msg);
      setDashboardRows([]);
      setLastUpdated(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
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

  const refetch = useCallback(async () => {
    await loadDashboard();
  }, [loadDashboard]);

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

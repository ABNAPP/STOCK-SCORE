/**
 * ISM ingest: merged rows from value-insight-be GET /ism/ingest (no client Firestore).
 */

import { useCallback, useEffect, useState } from 'react';
import { fetchIsmIngestFromApi } from '../services/valueInsightClient';
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
  const [ingestRows, setIngestRows] = useState<ISMInstrumentIngest[]>([]);
  const [summary, setSummary] = useState<ISMIngestSummary>({
    rowCount: 0,
    withMissingCurrency: 0,
    withMissingMarketCap: 0,
    withMissingSector: 0,
    withTickerNeedsReview: 0,
  });
  const [entryExitCompanyNames, setEntryExitCompanyNames] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await fetchIsmIngestFromApi();
      setIngestRows(body.rows);
      setSummary(body.summary);
      setEntryExitCompanyNames(new Set(body.entryExitCompanyNames));
      setLastUpdated(new Date());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.warn('ISM ingest load failed', {
        component: 'useIsmIngestData',
        operation: 'load',
        error: msg,
      });
      setError(msg);
      setIngestRows([]);
      setSummary({
        rowCount: 0,
        withMissingCurrency: 0,
        withMissingMarketCap: 0,
        withMissingSector: 0,
        withTickerNeedsReview: 0,
      });
      setEntryExitCompanyNames(new Set());
      setLastUpdated(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refetch = useCallback(async () => {
    await load();
  }, [load]);

  const getHasEntryExitRow = useCallback(
    (_ticker: string, companyName: string) => entryExitCompanyNames.has(companyName),
    [entryExitCompanyNames]
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

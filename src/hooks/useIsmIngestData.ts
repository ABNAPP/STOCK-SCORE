/**
 * ISM ingest hook: reuses `useScoreBoardData` and `useEntryExitValues` (read-only currency).
 * Must render under `EntryExitProvider` (same pattern as Score Board).
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useScoreBoardData } from './useScoreBoardData';
import { useEntryExitValues } from '../contexts/EntryExitContext';
import type { EntryExitData } from '../types/stock';
import { mergeIsmIngestRows, summarizeIsmIngest } from '../services/ism/mergeIsmIngest';
import type { ISMInstrumentIngest, ISMIngestSummary } from '../types/ismIngest';

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
  const { data: scoreBoardData, loading, error, lastUpdated, refetch } = useScoreBoardData();
  const { getFieldValue, getEntryExitValue, initializeFromData } = useEntryExitValues();

  useEffect(() => {
    if (!scoreBoardData.length) return;
    const entryExitData: EntryExitData[] = scoreBoardData.map((item) => ({
      companyName: item.companyName,
      ticker: item.ticker,
      currency: '',
      entry1: 0,
      entry2: 0,
      exit1: 0,
      exit2: 0,
      dateOfUpdate: null,
    }));
    initializeFromData(entryExitData);
  }, [scoreBoardData, initializeFromData]);

  const ingestRows = useMemo(
    () =>
      mergeIsmIngestRows(scoreBoardData, (ticker, companyName) =>
        getFieldValue(ticker, companyName, 'currency')
      ),
    [scoreBoardData, getFieldValue]
  );

  const summary = useMemo(() => summarizeIsmIngest(ingestRows), [ingestRows]);
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

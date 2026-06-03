/**
 * Official sector detail: latest sector index + active weekly snapshot constituents via value-insight-be.
 */

import { useCallback, useEffect, useState } from 'react';
import type { ParsedSectorIndexDaily } from '../services/ism/dailySector/readSectorIndexDaily';
import { addCalendarDays, isoTodayUtc } from '../services/ism/fetchEngine/dateUtils';
import { loadIsmSectorDetail } from '../services/ismSectorDataService';
import { fetchIsmSectorDailySeriesFromApi } from '../services/valueInsightClient';

const STALE_DAILY_FALLBACK_CALENDAR_DAYS = 90;

async function fetchLatestDailyFromSeries(
  sectorId: string
): Promise<{ daily: ParsedSectorIndexDaily; docTradeDate: string } | null> {
  const toIso = isoTodayUtc();
  const fromIso = addCalendarDays(toIso, -STALE_DAILY_FALLBACK_CALENDAR_DAYS);
  const body = await fetchIsmSectorDailySeriesFromApi(sectorId, fromIso, toIso);
  const rows = body.rows as ParsedSectorIndexDaily[];
  if (rows.length === 0) return null;
  const last = rows[rows.length - 1]!;
  const docTradeDate = last.trade_date?.trim() ?? '';
  if (!docTradeDate) return null;
  return { daily: last, docTradeDate };
}

export type IsmConstituentTableRow = {
  symbol_id: string;
  ticker_raw: string;
  company_name: string;
  rank: number;
  synthetic_shares: number;
  last_close: number | null;
  market_cap_usd: number;
};

export type UseIsmSectorDetailDataResult = {
  daily: ParsedSectorIndexDaily | null;
  docTradeDate: string | null;
  missingDailyDoc: boolean;
  /** Latest daily row from historical series when official recent-window doc is missing. */
  usingStaleDaily: boolean;
  constituents: IsmConstituentTableRow[];
  activeSnapshotDiagnostics: {
    totalCandidates: number | null;
    marketCapSnapshotTimestamp: number | null;
    addedCount: number | null;
    removedCount: number | null;
    unchangedCount: number | null;
    previousDivisor: number | null;
    newDivisor: number | null;
    divisorAdjustmentApplied: boolean | null;
    usingPreviousActiveSnapshot: boolean;
    topExclusionReasons: Array<{ reason: string; count: number }>;
  };
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

const EMPTY_DIAGNOSTICS: UseIsmSectorDetailDataResult['activeSnapshotDiagnostics'] = {
  totalCandidates: null,
  marketCapSnapshotTimestamp: null,
  addedCount: null,
  removedCount: null,
  unchangedCount: null,
  previousDivisor: null,
  newDivisor: null,
  divisorAdjustmentApplied: null,
  usingPreviousActiveSnapshot: false,
  topExclusionReasons: [],
};

export function useIsmSectorDetailData(sectorId: string | null): UseIsmSectorDetailDataResult {
  const [daily, setDaily] = useState<ParsedSectorIndexDaily | null>(null);
  const [docTradeDate, setDocTradeDate] = useState<string | null>(null);
  const [missingDailyDoc, setMissingDailyDoc] = useState(true);
  const [usingStaleDaily, setUsingStaleDaily] = useState(false);
  const [constituents, setConstituents] = useState<IsmConstituentTableRow[]>([]);
  const [activeSnapshotDiagnostics, setActiveSnapshotDiagnostics] =
    useState<UseIsmSectorDetailDataResult['activeSnapshotDiagnostics']>(EMPTY_DIAGNOSTICS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sectorId) {
      setDaily(null);
      setDocTradeDate(null);
      setMissingDailyDoc(true);
      setUsingStaleDaily(false);
      setConstituents([]);
      setActiveSnapshotDiagnostics(EMPTY_DIAGNOSTICS);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body = await loadIsmSectorDetail(sectorId);
      let nextDaily = body.index as ParsedSectorIndexDaily | null;
      let nextDocTradeDate = body.docTradeDate;
      let nextMissing = body.missingDailyDoc;
      let nextStale = false;

      if (nextMissing && !nextDaily && body.constituents.length > 0) {
        try {
          const fallback = await fetchLatestDailyFromSeries(sectorId);
          if (fallback) {
            nextDaily = fallback.daily;
            nextDocTradeDate = fallback.docTradeDate;
            nextStale = true;
          }
        } catch {
          // Chart/history unavailable; keep degraded constituents-only view.
        }
      }

      setDaily(nextDaily);
      setDocTradeDate(nextDocTradeDate);
      setMissingDailyDoc(nextMissing);
      setUsingStaleDaily(nextStale);
      setConstituents(body.constituents);
      setActiveSnapshotDiagnostics({
        totalCandidates: body.rebalance.totalCandidates,
        marketCapSnapshotTimestamp: body.rebalance.marketCapSnapshotTimestamp,
        addedCount: body.rebalance.addedCount,
        removedCount: body.rebalance.removedCount,
        unchangedCount: body.rebalance.unchangedCount,
        previousDivisor: body.rebalance.previousDivisor,
        newDivisor: body.rebalance.newDivisor,
        divisorAdjustmentApplied: body.rebalance.divisorAdjustmentApplied,
        usingPreviousActiveSnapshot: body.rebalance.usingPreviousActiveSnapshot,
        topExclusionReasons: body.rebalance.topExclusionReasons,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setDaily(null);
      setDocTradeDate(null);
      setMissingDailyDoc(true);
      setUsingStaleDaily(false);
      setConstituents([]);
      setActiveSnapshotDiagnostics(EMPTY_DIAGNOSTICS);
    } finally {
      setLoading(false);
    }
  }, [sectorId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    daily,
    docTradeDate,
    missingDailyDoc,
    usingStaleDaily,
    constituents,
    activeSnapshotDiagnostics,
    loading,
    error,
    refetch: load,
  };
}

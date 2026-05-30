/**
 * Official sector detail: latest sector index + active weekly snapshot constituents via value-insight-be.
 */

import { useCallback, useEffect, useState } from 'react';
import type { ParsedSectorIndexDaily } from '../services/ism/dailySector/readSectorIndexDaily';
import { loadIsmSectorDetail } from '../services/ismSectorDataService';

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
      setDaily(body.index as ParsedSectorIndexDaily | null);
      setDocTradeDate(body.docTradeDate);
      setMissingDailyDoc(body.missingDailyDoc);
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
      setConstituents([]);
      setActiveSnapshotDiagnostics(EMPTY_DIAGNOSTICS);
    } finally {
      setLoading(false);
    }
  }, [sectorId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { daily, docTradeDate, missingDailyDoc, constituents, activeSnapshotDiagnostics, loading, error, refetch: load };
}

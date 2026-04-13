/**
 * Official sector detail: latest `sector_index_daily` + active weekly snapshot constituents (read-only).
 */

import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import type { ParsedSectorIndexDaily } from '../services/ism/dailySector/readSectorIndexDaily';
import {
  fetchLatestSectorIndexDailyDoc,
  parseSectorIndexDailyDocument,
} from '../services/ism/dailySector/readSectorIndexDaily';
import { loadActiveSectorRebalanceSnapshotWithMeta } from '../services/ism/dailySector/ismDailySectorFirestorePersistence';

export type IsmConstituentTableRow = {
  symbol_id: string;
  ticker_raw: string;
  company_name: string;
  rank: number;
  synthetic_shares: number;
  last_close: number | null;
  market_cap_usd: number;
};

function parseConstituentsFromSnapshot(snap: Record<string, unknown> | null): IsmConstituentTableRow[] {
  if (!snap || !Array.isArray(snap.constituents)) return [];
  const out: IsmConstituentTableRow[] = [];
  for (const row of snap.constituents) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    if (typeof r.symbol_id !== 'string') continue;
    out.push({
      symbol_id: r.symbol_id,
      ticker_raw: typeof r.ticker_raw === 'string' ? r.ticker_raw : '',
      company_name: typeof r.company_name === 'string' ? r.company_name : '',
      rank: typeof r.rank === 'number' ? r.rank : out.length + 1,
      synthetic_shares: typeof r.synthetic_shares === 'number' ? r.synthetic_shares : 0,
      last_close:
        typeof r.last_close === 'number' && Number.isFinite(r.last_close)
          ? r.last_close
          : null,
      market_cap_usd: typeof r.market_cap_usd === 'number' && Number.isFinite(r.market_cap_usd) ? r.market_cap_usd : 0,
    });
  }
  return out.sort((a, b) => a.rank - b.rank);
}

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

export function useIsmSectorDetailData(sectorId: string | null, user: User | null): UseIsmSectorDetailDataResult {
  const [daily, setDaily] = useState<ParsedSectorIndexDaily | null>(null);
  const [docTradeDate, setDocTradeDate] = useState<string | null>(null);
  const [missingDailyDoc, setMissingDailyDoc] = useState(true);
  const [constituents, setConstituents] = useState<IsmConstituentTableRow[]>([]);
  const [activeSnapshotDiagnostics, setActiveSnapshotDiagnostics] = useState<{
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
  }>({
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
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sectorId || !user) {
      setDaily(null);
      setDocTradeDate(null);
      setMissingDailyDoc(true);
      setConstituents([]);
      setActiveSnapshotDiagnostics({
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
      });
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const hit = await fetchLatestSectorIndexDailyDoc(sectorId);
      if (!hit) {
        setDaily(null);
        setDocTradeDate(null);
        setMissingDailyDoc(true);
      } else {
        const parsed = parseSectorIndexDailyDocument(hit.data);
        setDaily(parsed);
        setDocTradeDate(hit.tradeDate);
        setMissingDailyDoc(parsed == null);
      }
      const snapshotRead = await loadActiveSectorRebalanceSnapshotWithMeta(user, sectorId);
      const snap = snapshotRead.snapshot;
      setConstituents(parseConstituentsFromSnapshot(snap));
      const topExclusionReasons: Array<{ reason: string; count: number }> = Array.isArray(snap?.top_exclusion_reasons)
        ? snap.top_exclusion_reasons
            .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
            .map((x) => ({
              reason: typeof x.reason === 'string' ? x.reason : '',
              count: typeof x.count === 'number' && Number.isFinite(x.count) ? Math.trunc(x.count) : 0,
            }))
            .filter((x) => x.reason.length > 0 && x.count > 0)
        : [];
      setActiveSnapshotDiagnostics({
        totalCandidates: snap && typeof snap.total_candidates === 'number' ? Math.trunc(snap.total_candidates) : null,
        marketCapSnapshotTimestamp:
          snap && typeof snap.market_cap_snapshot_timestamp === 'number' ? snap.market_cap_snapshot_timestamp : null,
        addedCount: snap && Array.isArray(snap.added_symbols) ? snap.added_symbols.length : null,
        removedCount: snap && Array.isArray(snap.removed_symbols) ? snap.removed_symbols.length : null,
        unchangedCount: snap && Array.isArray(snap.unchanged_symbols) ? snap.unchanged_symbols.length : null,
        previousDivisor: snap && typeof snap.previous_divisor === 'number' ? snap.previous_divisor : null,
        newDivisor: snap && typeof snap.new_divisor === 'number' ? snap.new_divisor : null,
        divisorAdjustmentApplied:
          snap && typeof snap.divisor_adjustment_applied === 'boolean' ? snap.divisor_adjustment_applied : null,
        usingPreviousActiveSnapshot: snapshotRead.usingPreviousActiveSnapshot,
        topExclusionReasons,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setDaily(null);
      setDocTradeDate(null);
      setMissingDailyDoc(true);
      setConstituents([]);
      setActiveSnapshotDiagnostics({
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
      });
    } finally {
      setLoading(false);
    }
  }, [sectorId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  return { daily, docTradeDate, missingDailyDoc, constituents, activeSnapshotDiagnostics, loading, error, refetch: load };
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  prefetchEodAdjustedForTickers,
  tryReadAdjustedEodDailyBarsInRange,
} from '../services/eodAdjustedDataService';
import type { IsmDailyBar } from '../services/ism/marketData/types';

export type StockPick = { symbolId: string; tickerRaw: string };

function barsToCloseByDate(bars: { date: string; close: number }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const b of bars) {
    if (b.date && Number.isFinite(b.close)) m.set(b.date, b.close);
  }
  return m;
}

export type UseIsmSectorStockHistoryMapsResult = {
  closeBySymbolId: Map<string, Map<string, number>>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

/**
 * Constituent daily closes via value-insight-be `/eod-adjusted-daily` only (no browser EODHD).
 */
export function useIsmSectorStockHistoryMaps(
  picks: StockPick[],
  fromIso: string,
  toIso: string,
  enabled: boolean
): UseIsmSectorStockHistoryMapsResult {
  const [closeBySymbolId, setCloseBySymbolId] = useState<Map<string, Map<string, number>>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const picksKey = useMemo(() => JSON.stringify(picks.map((p) => [p.symbolId, p.tickerRaw])), [picks]);

  const load = useCallback(async () => {
    if (!enabled || picks.length === 0) {
      setCloseBySymbolId(new Map());
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await prefetchEodAdjustedForTickers(picks.map((p) => p.tickerRaw));

      const next = new Map<string, Map<string, number>>();
      for (const p of picks) {
        const bars: IsmDailyBar[] | null = await tryReadAdjustedEodDailyBarsInRange(p.tickerRaw, fromIso, toIso);
        next.set(p.symbolId, bars?.length ? barsToCloseByDate(bars) : new Map());
      }
      setCloseBySymbolId(next);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setCloseBySymbolId(new Map());
    } finally {
      setLoading(false);
    }
  }, [enabled, picks, picksKey, fromIso, toIso]);

  useEffect(() => {
    void load();
  }, [load]);

  return { closeBySymbolId, loading, error, refetch: load };
}

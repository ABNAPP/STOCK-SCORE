import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildDefaultProviderKeyPools, defaultIsmMarketAdapters } from '../services/ism/marketData/defaultRegistry';
import { buildSymbolTranslationContext } from '../services/ism/marketData/translationContext';
import { fetchIsmHistoricalDailyWithFallback } from '../services/ism/marketData/orchestratePrice';

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
      const pools = buildDefaultProviderKeyPools();
      const adapters = defaultIsmMarketAdapters;
      const next = new Map<string, Map<string, number>>();
      for (const p of picks) {
        const ctx = buildSymbolTranslationContext(p.tickerRaw);
        const res = await fetchIsmHistoricalDailyWithFallback(ctx, fromIso, toIso, 'daily', pools, adapters);
        if (res.outcome !== 'valid' || !res.data?.length) {
          next.set(p.symbolId, new Map());
          continue;
        }
        next.set(p.symbolId, barsToCloseByDate(res.data));
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

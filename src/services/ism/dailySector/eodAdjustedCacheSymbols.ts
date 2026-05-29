/**
 * EODHD symbols for adjusted EOD cache warming — same translation as ISM posture (`translateForProvider` + `buildSymbolTranslationContext`).
 * Benchmark series aligned with `useIsmDebugSync` / daily index (SPY).
 */

import type { ISMInstrumentIngest } from '../../../types/ismIngest';
import { buildSymbolTranslationContext, translateForProvider } from '../marketData';

/** Benchmark tickers requested as raw DashBoard tickers (same as posture debug flow). */
export const ISM_EOD_ADJUSTED_CACHE_BENCHMARK_TICKER_RAWS: readonly string[] = ['SPY'];

export function eodSymbolFromTickerRaw(tickerRaw: string): string {
  const ctx = buildSymbolTranslationContext(tickerRaw);
  return translateForProvider('eodhd', ctx).symbol;
}

/**
 * Unique sorted EOD symbols for all ingest rows plus benchmarks (e.g. SPY.US).
 */
export function buildEodSymbolUniverseForIsmIngest(
  ingestRows: Array<Pick<ISMInstrumentIngest, 'tickerRaw'>>
): string[] {
  const set = new Set<string>();
  for (const b of ISM_EOD_ADJUSTED_CACHE_BENCHMARK_TICKER_RAWS) {
    set.add(eodSymbolFromTickerRaw(b));
  }
  for (const row of ingestRows) {
    const raw = typeof row.tickerRaw === 'string' ? row.tickerRaw.trim() : '';
    if (!raw) continue;
    set.add(eodSymbolFromTickerRaw(raw));
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

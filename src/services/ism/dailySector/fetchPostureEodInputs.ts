/**
 * Fresh EODHD pulls for ISM posture (`computeDailySectorIndex`): full calendar window per run, no durable OHLC cache.
 */

import type { ISMInstrumentIngest } from '../../../types/ismIngest';
import {
  buildDefaultProviderKeyPools,
  defaultIsmMarketAdapters,
  buildSymbolTranslationContext,
  fetchIsmHistoricalDailyWithFallback,
} from '../marketData';
import type { IsmDailyBar } from '../marketData/types';
import { addCalendarDays } from '../fetchEngine/dateUtils';

/** Five calendar years of daily bars (aligned with legacy bootstrap horizon). */
export const ISM_POSTURE_EOD_LOOKBACK_CALENDAR_DAYS = 5 * 365;

/** Parallel EOD requests per batch when loading constituents (stay under ~1000/min). */
export const ISM_POSTURE_EOD_FETCH_BATCH_SIZE = 10;

export function postureEodWindowFromTradeDate(tradeDateIso: string): { fromIso: string; toIso: string } {
  const toIso = tradeDateIso;
  const fromIso = addCalendarDays(tradeDateIso, -(ISM_POSTURE_EOD_LOOKBACK_CALENDAR_DAYS - 1));
  return { fromIso, toIso };
}

function closesOldestFirstFromBars(bars: IsmDailyBar[]): number[] {
  const sorted = [...bars].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((b) => b.close).filter((v) => Number.isFinite(v) && v > 0);
}

/**
 * One instrument: full-window EOD closes from EODHD (ISM-only provider chain).
 */
export async function fetchEodCloseSeriesForTicker(
  tickerRaw: string,
  fromIso: string,
  toIso: string,
  signal?: AbortSignal
): Promise<number[]> {
  const ctx = buildSymbolTranslationContext(tickerRaw);
  const res = await fetchIsmHistoricalDailyWithFallback(
    ctx,
    fromIso,
    toIso,
    'daily',
    buildDefaultProviderKeyPools(),
    defaultIsmMarketAdapters,
    signal
  );
  if (res.outcome !== 'valid' || !res.data?.length) return [];
  return closesOldestFirstFromBars(res.data);
}

export type ConstituentIngestRef = { symbolId: string; tickerRaw: string };

/** Unique symbol ids from snapshot constituents that exist in ingest (deduped). */
export function collectConstituentFetchRefs(
  constituents: unknown[],
  ingestBySymbolId: Map<string, ISMInstrumentIngest>
): ConstituentIngestRef[] {
  const seen = new Set<string>();
  const out: ConstituentIngestRef[] = [];
  for (const item of constituents) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (typeof row.symbol_id !== 'string') continue;
    const id = row.symbol_id;
    if (seen.has(id)) continue;
    const ingest = ingestBySymbolId.get(id);
    if (!ingest) continue;
    seen.add(id);
    out.push({ symbolId: id, tickerRaw: ingest.tickerRaw });
  }
  return out;
}

/**
 * Batch-fetch full-window closes per constituent (fresh API data each call).
 */
export async function fetchConstituentCloseHistories(
  refs: ConstituentIngestRef[],
  fromIso: string,
  toIso: string,
  batchSize: number,
  signal?: AbortSignal
): Promise<Record<string, number[]>> {
  const acc: Record<string, number[]> = {};
  const size = Math.max(1, batchSize);
  for (let i = 0; i < refs.length; i += size) {
    const batch = refs.slice(i, i + size);
    const settled = await Promise.all(
      batch.map(async (ref) => {
        const closes = await fetchEodCloseSeriesForTicker(ref.tickerRaw, fromIso, toIso, signal);
        return { symbolId: ref.symbolId, closes };
      })
    );
    for (const r of settled) {
      acc[r.symbolId] = r.closes;
    }
  }
  return acc;
}

/**
 * Read server-maintained adjusted EOD cache (Cloud Functions + EODHD `/api/eod` only).
 * Doc paths must match `functions/src/eodAdjustedCache.ts`.
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { logger } from '../../../utils/logger';
import { daysInclusive } from '../fetchEngine/dateUtils';
import { buildSymbolTranslationContext, translateForProvider } from '../marketData';
import type { IsmDailyBar } from '../marketData/types';
import type { EodAdjustedDailyPricePoint } from '../../../utils/eodAdjustedDailyRangeFilter';

export const EOD_ADJUSTED_CACHE_SCHEMA_VERSION = 1;
export const COLLECTION_EOD_ADJUSTED_DAILY = 'eodAdjustedDaily';

function isoRangeCovers(requestFrom: string, requestTo: string, cacheFrom: string, cacheTo: string): boolean {
  return cacheFrom <= requestFrom && cacheTo >= requestTo;
}

/**
 * Returns adjusted-close series (oldest→newest) for [fromIso, toIso] or null if cache miss/stale.
 */
export async function tryReadAdjustedEodCloseSeries(
  tickerRaw: string,
  fromIso: string,
  toIso: string
): Promise<number[] | null> {
  try {
    const ctx = buildSymbolTranslationContext(tickerRaw);
    const eodSymbol = translateForProvider('eodhd', ctx).symbol;

    const sysSnap = await getDoc(doc(db, 'system', 'eodAdjustedCache'));
    if (!sysSnap.exists()) return null;
    const sys = sysSnap.data() as { generation?: unknown };
    const generation = typeof sys.generation === 'number' ? sys.generation : null;
    if (generation == null || generation <= 0) return null;

    const dailySnap = await getDoc(doc(db, COLLECTION_EOD_ADJUSTED_DAILY, eodSymbol));
    if (!dailySnap.exists()) return null;

    const d = dailySnap.data() as {
      generation?: unknown;
      bars?: unknown;
      range?: { from?: string; to?: string };
      schemaVersion?: unknown;
    };

    if (d.generation !== generation) return null;
    if (d.schemaVersion != null && d.schemaVersion !== EOD_ADJUSTED_CACHE_SCHEMA_VERSION) return null;

    if (!d.range || typeof d.range.from !== 'string' || typeof d.range.to !== 'string') return null;
    if (!isoRangeCovers(fromIso, toIso, d.range.from, d.range.to)) return null;

    if (!Array.isArray(d.bars)) return null;

    type Bar = { date: string; adjustedClose: number };
    const sorted: Bar[] = [];
    for (const row of d.bars) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const date = typeof r.date === 'string' ? r.date : '';
      const ac = r.adjustedClose !== undefined ? r.adjustedClose : r.adjusted_close;
      const v = typeof ac === 'number' ? ac : Number(ac);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      if (date < fromIso || date > toIso) continue;
      if (!Number.isFinite(v) || v <= 0) continue;
      sorted.push({ date, adjustedClose: v });
    }
    sorted.sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length === 0) return null;
    return sorted.map((x) => x.adjustedClose);
  } catch (e) {
    logger.warn('tryReadAdjustedEodCloseSeries failed', {
      component: 'eodAdjustedFirestoreCache',
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

/**
 * Same cache as {@link tryReadAdjustedEodCloseSeries}, but returns OHLC bars (close = adjusted close)
 * for bootstrap / validation without calling market APIs.
 */
export async function tryReadAdjustedEodDailyBarsInRange(
  tickerRaw: string,
  fromIso: string,
  toIso: string
): Promise<IsmDailyBar[] | null> {
  try {
    const ctx = buildSymbolTranslationContext(tickerRaw);
    const eodSymbol = translateForProvider('eodhd', ctx).symbol;

    const sysSnap = await getDoc(doc(db, 'system', 'eodAdjustedCache'));
    if (!sysSnap.exists()) return null;
    const sys = sysSnap.data() as { generation?: unknown };
    const generation = typeof sys.generation === 'number' ? sys.generation : null;
    if (generation == null || generation <= 0) return null;

    const dailySnap = await getDoc(doc(db, COLLECTION_EOD_ADJUSTED_DAILY, eodSymbol));
    if (!dailySnap.exists()) return null;

    const d = dailySnap.data() as {
      generation?: unknown;
      bars?: unknown;
      range?: { from?: string; to?: string };
      schemaVersion?: unknown;
    };

    if (d.generation !== generation) return null;
    if (d.schemaVersion != null && d.schemaVersion !== EOD_ADJUSTED_CACHE_SCHEMA_VERSION) return null;

    if (!d.range || typeof d.range.from !== 'string' || typeof d.range.to !== 'string') return null;
    if (!isoRangeCovers(fromIso, toIso, d.range.from, d.range.to)) return null;

    if (!Array.isArray(d.bars)) return null;

    const out: IsmDailyBar[] = [];
    for (const row of d.bars) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const date = typeof r.date === 'string' ? r.date : '';
      const ac = r.adjustedClose !== undefined ? r.adjustedClose : r.adjusted_close;
      const v = typeof ac === 'number' ? ac : Number(ac);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      if (date < fromIso || date > toIso) continue;
      if (!Number.isFinite(v) || v <= 0) continue;
      const c = v as number;
      out.push({ date, open: c, high: c, low: c, close: c });
    }
    out.sort((a, b) => a.date.localeCompare(b.date));
    if (out.length === 0) return null;
    return out;
  } catch (e) {
    logger.warn('tryReadAdjustedEodDailyBarsInRange failed', {
      component: 'eodAdjustedFirestoreCache',
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

/**
 * Calendar span (inclusive days) of the stored `range` on `eodAdjustedDaily/{eodSymbol}` when generation matches.
 * Used when fetch-engine `historyDaysFetched` is behind but the nightly cache doc already covers a long window.
 */
export async function tryReadAdjustedEodCachedRangeCalendarSpanDays(tickerRaw: string): Promise<number | null> {
  try {
    const ctx = buildSymbolTranslationContext(tickerRaw);
    const eodSymbol = translateForProvider('eodhd', ctx).symbol;

    const sysSnap = await getDoc(doc(db, 'system', 'eodAdjustedCache'));
    if (!sysSnap.exists()) return null;
    const sys = sysSnap.data() as { generation?: unknown };
    const generation = typeof sys.generation === 'number' ? sys.generation : null;
    if (generation == null || generation <= 0) return null;

    const dailySnap = await getDoc(doc(db, COLLECTION_EOD_ADJUSTED_DAILY, eodSymbol));
    if (!dailySnap.exists()) return null;

    const d = dailySnap.data() as {
      generation?: unknown;
      range?: { from?: string; to?: string };
      schemaVersion?: unknown;
    };

    if (d.generation !== generation) return null;
    if (d.schemaVersion != null && d.schemaVersion !== EOD_ADJUSTED_CACHE_SCHEMA_VERSION) return null;
    if (!d.range || typeof d.range.from !== 'string' || typeof d.range.to !== 'string') return null;
    return daysInclusive(d.range.from, d.range.to);
  } catch (e) {
    logger.warn('tryReadAdjustedEodCachedRangeCalendarSpanDays failed', {
      component: 'eodAdjustedFirestoreCache',
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

export type { EodAdjustedDailyPricePoint } from '../../../utils/eodAdjustedDailyRangeFilter';

export type FetchEodAdjustedDailyPriceSeriesResult = {
  points: EodAdjustedDailyPricePoint[];
  /** True when doc generation does not match system/eodAdjustedCache (bars still returned for monitoring). */
  staleGeneration: boolean;
};

/**
 * Load all adjusted daily closes for one `eodAdjustedDaily/{eodSymbol}` document.
 */
export async function fetchEodAdjustedDailyPriceSeries(
  eodSymbol: string
): Promise<FetchEodAdjustedDailyPriceSeriesResult | null> {
  try {
    const sysSnap = await getDoc(doc(db, 'system', 'eodAdjustedCache'));
    if (!sysSnap.exists()) return null;
    const sys = sysSnap.data() as { generation?: unknown };
    const generation =
      typeof sys.generation === 'number' && Number.isFinite(sys.generation) ? sys.generation : null;
    if (generation == null || generation <= 0) return null;

    const dailySnap = await getDoc(doc(db, COLLECTION_EOD_ADJUSTED_DAILY, eodSymbol));
    if (!dailySnap.exists()) return null;

    const d = dailySnap.data() as {
      generation?: unknown;
      bars?: unknown;
      schemaVersion?: unknown;
    };

    const docGen = d.generation;
    const docGenNum = typeof docGen === 'number' && Number.isFinite(docGen) ? docGen : null;
    const staleGeneration = docGenNum !== generation;

    if (d.schemaVersion != null && d.schemaVersion !== EOD_ADJUSTED_CACHE_SCHEMA_VERSION) {
      return { points: [], staleGeneration };
    }

    if (!Array.isArray(d.bars)) {
      return { points: [], staleGeneration };
    }

    const points: EodAdjustedDailyPricePoint[] = [];
    for (const row of d.bars) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const date = typeof r.date === 'string' ? r.date : '';
      const ac = r.adjustedClose !== undefined ? r.adjustedClose : r.adjusted_close;
      const v = typeof ac === 'number' ? ac : Number(ac);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      if (!Number.isFinite(v) || v <= 0) continue;
      points.push({ date, price: v });
    }
    points.sort((a, b) => a.date.localeCompare(b.date));
    return { points, staleGeneration };
  } catch (e) {
    logger.warn('fetchEodAdjustedDailyPriceSeries failed', {
      component: 'eodAdjustedFirestoreCache',
      eodSymbol,
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

/**
 * Resolve app ticker (e.g. `VOLV-B`) to EODHD cache doc id, then load full adjusted daily series.
 */
export async function fetchEodAdjustedDailyPriceSeriesForAppTicker(
  tickerRaw: string
): Promise<FetchEodAdjustedDailyPriceSeriesResult | null> {
  const trimmed = (tickerRaw ?? '').trim();
  if (!trimmed) return null;
  try {
    const ctx = buildSymbolTranslationContext(trimmed);
    const eodSymbol = translateForProvider('eodhd', ctx).symbol;
    return fetchEodAdjustedDailyPriceSeries(eodSymbol);
  } catch (e) {
    logger.warn('fetchEodAdjustedDailyPriceSeriesForAppTicker failed', {
      component: 'eodAdjustedFirestoreCache',
      tickerRaw: trimmed,
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

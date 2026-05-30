/**
 * Adjusted EOD daily prices from value-insight-be GET /eod-adjusted-daily.
 * Server-side EODHD fetch and cache — no Firestore reads on the client.
 */

import { fetchEodAdjustedDaily } from './valueInsightClient';
import type { EodAdjustedDailyApiResponse, EodAdjustedDailyEntryDto } from '../types/eodAdjustedDailyApi';
import { buildSymbolTranslationContext, translateForProvider } from './ism/marketData';
import type { IsmDailyBar } from './ism/marketData/types';
import type { EodAdjustedDailyPricePoint } from '../utils/eodAdjustedDailyRangeFilter';
import { daysInclusive } from './ism/fetchEngine/dateUtils';
import { logger } from '../utils/logger';

export type { EodAdjustedDailyPricePoint } from '../utils/eodAdjustedDailyRangeFilter';

export const EOD_ADJUSTED_CACHE_SCHEMA_VERSION = 1;

let inventoryInFlight: Promise<EodAdjustedDailyApiResponse> | null = null;
let barsIndexInFlight: Promise<Map<string, EodAdjustedDailyEntryDto>> | null = null;
let barsBySymbol: Map<string, EodAdjustedDailyEntryDto> | null = null;
let lastApiGeneration: number | null = null;

function isoRangeCovers(requestFrom: string, requestTo: string, cacheFrom: string, cacheTo: string): boolean {
  return cacheFrom <= requestFrom && cacheTo >= requestTo;
}

function resolveEodSymbol(tickerRaw: string): string {
  const ctx = buildSymbolTranslationContext(tickerRaw);
  return translateForProvider('eodhd', ctx).symbol;
}

async function loadInventory(): Promise<EodAdjustedDailyApiResponse> {
  if (!inventoryInFlight) {
    inventoryInFlight = fetchEodAdjustedDaily({ includeBars: false }).finally(() => {
      inventoryInFlight = null;
    });
  }
  return inventoryInFlight;
}

async function ensureBarsIndex(): Promise<Map<string, EodAdjustedDailyEntryDto>> {
  if (barsBySymbol) return barsBySymbol;
  if (!barsIndexInFlight) {
    barsIndexInFlight = (async () => {
      const res = await fetchEodAdjustedDaily({ includeBars: true });
      if (typeof res.generation === 'number' && Number.isFinite(res.generation)) {
        lastApiGeneration = res.generation;
      }
      const map = new Map<string, EodAdjustedDailyEntryDto>();
      for (const entry of res.entries) {
        if (entry.eodSymbol) {
          map.set(entry.eodSymbol, entry);
        }
      }
      barsBySymbol = map;
      return map;
    })().finally(() => {
      barsIndexInFlight = null;
    });
  }
  return barsIndexInFlight;
}

async function getEntryByEodSymbol(eodSymbol: string): Promise<EodAdjustedDailyEntryDto | null> {
  const index = await ensureBarsIndex();
  return index.get(eodSymbol) ?? null;
}

function parseBarsInRange(
  entry: EodAdjustedDailyEntryDto,
  fromIso: string,
  toIso: string
): { closes: number[]; ohlc: IsmDailyBar[] } {
  const closes: number[] = [];
  const ohlc: IsmDailyBar[] = [];
  const bars = entry.bars ?? [];
  for (const row of bars) {
    const date = row.date;
    const v = row.adjustedClose;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (date < fromIso || date > toIso) continue;
    if (!Number.isFinite(v) || v <= 0) continue;
    ohlc.push({ date, open: v, high: v, low: v, close: v });
  }
  ohlc.sort((a, b) => a.date.localeCompare(b.date));
  return { closes: ohlc.map((b) => b.close), ohlc };
}

function entryCoversRange(entry: EodAdjustedDailyEntryDto, fromIso: string, toIso: string): boolean {
  const from = entry.range?.from;
  const to = entry.range?.to;
  if (typeof from !== 'string' || typeof to !== 'string') return false;
  return isoRangeCovers(fromIso, toIso, from, to);
}

export async function fetchEodAdjustedInventory(): Promise<EodAdjustedDailyApiResponse> {
  return loadInventory();
}

/** Fresh GET for inventory (e.g. Daily history Refresh); does not share in-flight dedupe. */
export async function reloadEodAdjustedInventory(): Promise<EodAdjustedDailyApiResponse> {
  return fetchEodAdjustedDaily({ includeBars: false });
}

/** Clears in-memory bar index so the next read refetches from the API. */
export function clearEodAdjustedBarsIndex(): void {
  barsBySymbol = null;
  barsIndexInFlight = null;
}

export async function tryReadAdjustedEodCloseSeries(
  tickerRaw: string,
  fromIso: string,
  toIso: string
): Promise<number[] | null> {
  try {
    const eodSymbol = resolveEodSymbol(tickerRaw);
    const entry = await getEntryByEodSymbol(eodSymbol);
    if (!entry?.bars?.length) return null;
    if (!entryCoversRange(entry, fromIso, toIso)) return null;
    const { closes } = parseBarsInRange(entry, fromIso, toIso);
    return closes.length > 0 ? closes : null;
  } catch (e) {
    logger.warn('tryReadAdjustedEodCloseSeries failed', {
      component: 'eodAdjustedDataService',
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

export async function tryReadAdjustedEodDailyBarsInRange(
  tickerRaw: string,
  fromIso: string,
  toIso: string
): Promise<IsmDailyBar[] | null> {
  try {
    const eodSymbol = resolveEodSymbol(tickerRaw);
    const entry = await getEntryByEodSymbol(eodSymbol);
    if (!entry?.bars?.length) return null;
    if (!entryCoversRange(entry, fromIso, toIso)) return null;
    const { ohlc } = parseBarsInRange(entry, fromIso, toIso);
    return ohlc.length > 0 ? ohlc : null;
  } catch (e) {
    logger.warn('tryReadAdjustedEodDailyBarsInRange failed', {
      component: 'eodAdjustedDataService',
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

export async function tryReadAdjustedEodCachedRangeCalendarSpanDays(
  tickerRaw: string
): Promise<number | null> {
  try {
    const eodSymbol = resolveEodSymbol(tickerRaw);
    const entry = await getEntryByEodSymbol(eodSymbol);
    if (!entry?.range?.from || !entry.range.to) return null;
    return daysInclusive(entry.range.from, entry.range.to);
  } catch (e) {
    logger.warn('tryReadAdjustedEodCachedRangeCalendarSpanDays failed', {
      component: 'eodAdjustedDataService',
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

export type FetchEodAdjustedDailyPriceSeriesResult = {
  points: EodAdjustedDailyPricePoint[];
  staleGeneration: boolean;
};

export async function fetchEodAdjustedDailyPriceSeries(
  eodSymbol: string
): Promise<FetchEodAdjustedDailyPriceSeriesResult | null> {
  try {
    const entry = await getEntryByEodSymbol(eodSymbol);
    if (!entry) return null;

    const points: EodAdjustedDailyPricePoint[] = [];
    for (const row of entry.bars ?? []) {
      const date = row.date;
      const v = row.adjustedClose;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      if (!Number.isFinite(v) || v <= 0) continue;
      points.push({ date, price: v });
    }
    points.sort((a, b) => a.date.localeCompare(b.date));

    const entryGen =
      typeof entry.generation === 'number' && Number.isFinite(entry.generation)
        ? entry.generation
        : null;
    const staleGeneration =
      lastApiGeneration != null && entryGen != null && entryGen !== lastApiGeneration;

    return { points, staleGeneration };
  } catch (e) {
    logger.warn('fetchEodAdjustedDailyPriceSeries failed', {
      component: 'eodAdjustedDataService',
      eodSymbol,
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

export async function fetchEodAdjustedDailyPriceSeriesForAppTicker(
  tickerRaw: string
): Promise<FetchEodAdjustedDailyPriceSeriesResult | null> {
  const trimmed = (tickerRaw ?? '').trim();
  if (!trimmed) return null;
  try {
    const eodSymbol = resolveEodSymbol(trimmed);
    return fetchEodAdjustedDailyPriceSeries(eodSymbol);
  } catch (e) {
    logger.warn('fetchEodAdjustedDailyPriceSeriesForAppTicker failed', {
      component: 'eodAdjustedDataService',
      tickerRaw: trimmed,
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

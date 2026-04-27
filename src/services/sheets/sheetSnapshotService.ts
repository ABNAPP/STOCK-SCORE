import { CACHE_KEYS, DEFAULT_TTL, getCachedData, getDeltaCacheEntry, setCachedData, setDeltaCacheEntry } from '../firestoreCacheService';
import { fetchWithFallback } from './fetchService';
import { getApiBaseUrlForDeltaSync, isDeltaSyncEnabled, loadSnapshot, snapshotToTransformerFormat } from '../deltaSyncService';
import type { DataRow } from './types';
import { logger } from '../../utils/logger';

export type SupportedSheetName = 'DashBoard' | 'SMA';

export interface GetSheetSnapshotOptions {
  forceRefresh?: boolean;
  preferCache?: boolean;
  ttl?: number;
}

export interface SheetSnapshotData {
  sheetName: SupportedSheetName;
  headers: string[];
  rows: DataRow[];
  version: number | null;
  generatedAt: string | null;
}

export interface SheetSnapshotResult {
  data: SheetSnapshotData;
  source: 'cache' | 'network';
}

type SheetStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface SheetSnapshotStatusEntry {
  sheetName: SupportedSheetName;
  status: SheetStatus;
  lastAttemptAt: number | null;
  lastSuccessfulSync: number | null;
  rowCount: number;
  uniqueCompanyCount: number;
  cacheHits: number;
  cacheMisses: number;
  appsScriptCalls: number;
  inFlight: boolean;
  lastError: string | null;
}

export interface SheetSnapshotStatus {
  DashBoard: SheetSnapshotStatusEntry;
  SMA: SheetSnapshotStatusEntry;
}

interface SnapshotCachePayload {
  headers: string[];
  rows: DataRow[];
  version: number | null;
  generatedAt: string | null;
}

const DASHBOARD_SHEET_ID = '1KOOSLJVGdDZHBV1MUmb4D9oVIKUJj5TIgYCerjkWYcE';
const DASHBOARD_GID = '1180885830';
const SMA_SHEET_ID = '1KOOSLJVGdDZHBV1MUmb4D9oVIKUJj5TIgYCerjkWYcE';
const SMA_GID = '1413104083';

const CSV_URL_BY_SHEET: Record<SupportedSheetName, string> = {
  DashBoard: `https://docs.google.com/spreadsheets/d/${DASHBOARD_SHEET_ID}/export?format=csv&gid=${DASHBOARD_GID}`,
  SMA: `https://docs.google.com/spreadsheets/d/${SMA_SHEET_ID}/export?format=csv&gid=${SMA_GID}`,
};

const CACHE_KEY_BY_SHEET: Record<SupportedSheetName, string> = {
  DashBoard: CACHE_KEYS.DASHBOARD_SNAPSHOT,
  SMA: CACHE_KEYS.SMA_SNAPSHOT,
};

const statusStore: SheetSnapshotStatus = {
  DashBoard: createInitialStatus('DashBoard'),
  SMA: createInitialStatus('SMA'),
};

const listeners = new Set<(status: SheetSnapshotStatus) => void>();
const inFlightBySheet = new Map<SupportedSheetName, Promise<SheetSnapshotResult>>();

function createInitialStatus(sheetName: SupportedSheetName): SheetSnapshotStatusEntry {
  return {
    sheetName,
    status: 'idle',
    lastAttemptAt: null,
    lastSuccessfulSync: null,
    rowCount: 0,
    uniqueCompanyCount: 0,
    cacheHits: 0,
    cacheMisses: 0,
    appsScriptCalls: 0,
    inFlight: false,
    lastError: null,
  };
}

function emitStatus(): void {
  const snapshot = getSheetSnapshotStatus();
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      logger.warn('Sheet snapshot status listener failed', {
        component: 'sheetSnapshotService',
        operation: 'emitStatus',
        error,
      });
    }
  });
}

function updateStatus(
  sheetName: SupportedSheetName,
  updater: (entry: SheetSnapshotStatusEntry) => SheetSnapshotStatusEntry
): void {
  statusStore[sheetName] = updater(statusStore[sheetName]);
  emitStatus();
}

function countUniqueCompanies(rows: DataRow[], sheetName: SupportedSheetName): number {
  if (sheetName !== 'DashBoard') return 0;
  const tickerSet = new Set<string>();
  rows.forEach((row) => {
    const rawTicker = getTickerValue(row);
    if (rawTicker) {
      tickerSet.add(rawTicker);
    }
  });
  return tickerSet.size;
}

function getTickerValue(row: DataRow): string | null {
  const tickerAliases = ['Ticker', 'ticker', 'Ticket', 'ticket', 'Symbol', 'symbol'];
  for (const alias of tickerAliases) {
    const value = row[alias];
    if (value !== undefined && value !== null) {
      const normalized = String(value).trim().toUpperCase();
      if (normalized) {
        return normalized;
      }
    }
  }
  return null;
}

function toSheetSnapshotData(sheetName: SupportedSheetName, payload: SnapshotCachePayload): SheetSnapshotData {
  return {
    sheetName,
    headers: payload.headers,
    rows: payload.rows,
    version: payload.version,
    generatedAt: payload.generatedAt,
  };
}

async function readSnapshotFromCache(sheetName: SupportedSheetName): Promise<SnapshotCachePayload | null> {
  const cacheKey = CACHE_KEY_BY_SHEET[sheetName];
  const deltaEntry = await getDeltaCacheEntry<SnapshotCachePayload>(cacheKey);
  if (deltaEntry?.data?.rows) {
    return deltaEntry.data;
  }
  const cached = await getCachedData<SnapshotCachePayload>(cacheKey);
  if (cached?.rows) {
    return cached;
  }
  return null;
}

async function fetchSnapshotOverNetwork(
  sheetName: SupportedSheetName,
  ttl: number
): Promise<SnapshotCachePayload> {
  if (isDeltaSyncEnabled()) {
    try {
      const snapshot = await loadSnapshot({
        sheetName,
        apiBaseUrl: getApiBaseUrlForDeltaSync(),
      });
      const transformerFormat = snapshotToTransformerFormat(snapshot);
      const payload: SnapshotCachePayload = {
        headers: transformerFormat.meta.fields ?? [],
        rows: transformerFormat.data,
        version: snapshot.version,
        generatedAt: snapshot.generatedAt ?? null,
      };
      await setDeltaCacheEntry(
        CACHE_KEY_BY_SHEET[sheetName],
        payload,
        snapshot.version,
        true,
        ttl
      );
      return payload;
    } catch (error) {
      logger.warn('Delta snapshot fetch failed, using fetch fallback', {
        component: 'sheetSnapshotService',
        operation: 'fetchSnapshotOverNetwork',
        sheetName,
        error,
      });
    }
  }

  const rawRows = await fetchWithFallback<DataRow>({
    sheetName,
    dataTypeName: `${sheetName} Snapshot`,
    transformer: (results) => results.data,
    csvUrl: CSV_URL_BY_SHEET[sheetName],
    forceRefresh: true,
    ttl,
  });
  const headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
  const payload: SnapshotCachePayload = {
    headers,
    rows: rawRows,
    version: null,
    generatedAt: null,
  };
  await setCachedData(CACHE_KEY_BY_SHEET[sheetName], payload, ttl);
  return payload;
}

export async function getSheetSnapshot(
  sheetName: SupportedSheetName,
  options: GetSheetSnapshotOptions = {}
): Promise<SheetSnapshotResult> {
  const { forceRefresh = false, preferCache = true, ttl = DEFAULT_TTL } = options;

  if (!forceRefresh && preferCache) {
    const cached = await readSnapshotFromCache(sheetName);
    if (cached) {
      const data = toSheetSnapshotData(sheetName, cached);
      updateStatus(sheetName, (entry) => ({
        ...entry,
        status: 'ready',
        cacheHits: entry.cacheHits + 1,
        rowCount: data.rows.length,
        uniqueCompanyCount: countUniqueCompanies(data.rows, sheetName),
        lastError: null,
      }));
      return { data, source: 'cache' };
    }
    updateStatus(sheetName, (entry) => ({
      ...entry,
      cacheMisses: entry.cacheMisses + 1,
    }));
  }

  const existing = inFlightBySheet.get(sheetName);
  if (existing) {
    return existing;
  }

  updateStatus(sheetName, (entry) => ({
    ...entry,
    status: 'loading',
    inFlight: true,
    lastAttemptAt: Date.now(),
    lastError: null,
  }));

  const inFlight = (async (): Promise<SheetSnapshotResult> => {
    try {
      updateStatus(sheetName, (entry) => ({
        ...entry,
        appsScriptCalls: entry.appsScriptCalls + 1,
      }));

      const payload = await fetchSnapshotOverNetwork(sheetName, ttl);
      const data = toSheetSnapshotData(sheetName, payload);

      updateStatus(sheetName, (entry) => ({
        ...entry,
        status: 'ready',
        inFlight: false,
        rowCount: data.rows.length,
        uniqueCompanyCount: countUniqueCompanies(data.rows, sheetName),
        lastSuccessfulSync: Date.now(),
        lastError: null,
      }));

      return { data, source: 'network' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateStatus(sheetName, (entry) => ({
        ...entry,
        status: 'error',
        inFlight: false,
        lastError: message,
      }));
      throw error;
    } finally {
      inFlightBySheet.delete(sheetName);
    }
  })();

  inFlightBySheet.set(sheetName, inFlight);
  return inFlight;
}

export async function refetchSheetSnapshot(sheetName: SupportedSheetName): Promise<SheetSnapshotResult> {
  return getSheetSnapshot(sheetName, { forceRefresh: true, preferCache: false });
}

/**
 * Cache-only snapshot read. Never triggers network fetch.
 * Returns null when no cached snapshot exists.
 */
export async function getCachedSheetSnapshot(
  sheetName: SupportedSheetName
): Promise<SheetSnapshotData | null> {
  const cached = await readSnapshotFromCache(sheetName);
  if (!cached) return null;
  return toSheetSnapshotData(sheetName, cached);
}

export function getSheetSnapshotStatus(): SheetSnapshotStatus {
  return {
    DashBoard: { ...statusStore.DashBoard },
    SMA: { ...statusStore.SMA },
  };
}

export function subscribeSheetSnapshotStatus(
  listener: (status: SheetSnapshotStatus) => void
): () => void {
  listeners.add(listener);
  listener(getSheetSnapshotStatus());
  return () => {
    listeners.delete(listener);
  };
}

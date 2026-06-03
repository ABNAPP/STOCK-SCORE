/**
 * HTTP client for value-insight-be (VITE_API_BASE_URL).
 * Add new backend endpoints here as the API grows.
 */

import type { User } from 'firebase/auth';
import { auth } from '../config/firebase';
import type { MainDataApiErrorBody, MainDataApiResponse } from '../types/mainDataApi';
import type { SmaDataApiResponse } from '../types/smaDataApi';
import type { EodAdjustedDailyApiResponse } from '../types/eodAdjustedDailyApi';
import type { IsmSectorDetailApiResponse } from '../types/ismSectorApi';
import type { IsmComputeApiResponse } from '../types/ismComputeApi';
import type { IsmSectorOverviewApiResponse } from '../types/ismSectorOverviewApi';
import type { IsmSectorDailySeriesApiResponse } from '../types/ismDailySeriesApi';
import type { IsmIngestApiResponse } from '../types/ismIngestApi';
import type { EntryExitApiResponse, EntryExitUpdateApiRequest, EntryExitUpdateApiResponse } from '../types/entryExitApi';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function getValueInsightApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error('VITE_API_BASE_URL is not configured');
  }
  return API_BASE_URL;
}

export async function getValueInsightFirebaseIdToken(user?: User): Promise<string> {
  const resolved = user ?? auth.currentUser;
  if (!resolved) {
    throw new Error('Must be signed in');
  }
  return resolved.getIdToken();
}

async function parseJsonResponse<T>(res: Response, apiLabel: string): Promise<T> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    throw new Error(`Invalid JSON response from ${apiLabel}`);
  }

  if (!res.ok) {
    const errBody = body as MainDataApiErrorBody;
    const message =
      typeof errBody?.error === 'string'
        ? errBody.error
        : `HTTP ${res.status}: ${res.statusText}`;
    if (res.status === 401) {
      throw new Error(`Unauthorized: ${message}`);
    }
    if (res.status === 403) {
      throw new Error(`Forbidden: ${message}`);
    }
    throw new Error(message);
  }

  return body as T;
}

async function valueInsightGet<T>(path: string, apiLabel: string): Promise<T> {
  const base = getValueInsightApiBaseUrl();
  const res = await fetch(`${base}${path}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  return parseJsonResponse<T>(res, apiLabel);
}

async function valueInsightPost<T>(
  path: string,
  apiLabel: string,
  options: { user?: User; authRequired?: boolean }
): Promise<T> {
  return valueInsightWrite<T>(path, apiLabel, 'POST', undefined, options);
}

async function valueInsightPut<T>(
  path: string,
  apiLabel: string,
  body: unknown,
  options: { user?: User; authRequired?: boolean }
): Promise<T> {
  return valueInsightWrite<T>(path, apiLabel, 'PUT', body, options);
}

async function valueInsightWrite<T>(
  path: string,
  apiLabel: string,
  method: 'POST' | 'PUT',
  body: unknown | undefined,
  options: { user?: User; authRequired?: boolean }
): Promise<T> {
  const base = getValueInsightApiBaseUrl();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.authRequired !== false) {
    const token = await getValueInsightFirebaseIdToken(options.user);
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return parseJsonResponse<T>(res, apiLabel);
}

// --- Main data (dashboard cache) ---

/** GET /main-data — cached dashboard data (server refreshes when stale). */
export async function fetchMainData(): Promise<MainDataApiResponse> {
  return valueInsightGet<MainDataApiResponse>('/main-data', 'main-data');
}

/** POST /main-data/refresh — force refresh (admin Firebase ID token required). */
export async function refreshMainData(user?: User): Promise<MainDataApiResponse> {
  return valueInsightPost<MainDataApiResponse>('/main-data/refresh', 'main-data', { user });
}

// --- SMA data (SMA sheet cache) ---

/** GET /sma-data — cached SMA sheet (server refreshes when stale). */
export async function fetchSmaData(): Promise<SmaDataApiResponse> {
  return valueInsightGet<SmaDataApiResponse>('/sma-data', 'sma-data');
}

/** POST /sma-data/refresh — force refresh (admin Firebase ID token required). */
export async function refreshSmaData(user?: User): Promise<SmaDataApiResponse> {
  return valueInsightPost<SmaDataApiResponse>('/sma-data/refresh', 'sma-data', { user });
}

// --- EOD adjusted daily (EODHD cache) ---

export type FetchEodAdjustedDailyOptions = {
  includeBars?: boolean;
  /** @deprecated Use eodSymbols */
  eodSymbol?: string;
  /** Comma-separated list sent as eodSymbols= (max 64 server-side). */
  eodSymbols?: string[];
};

/** GET /eod-adjusted-daily — adjusted EOD cache (server refreshes when stale). */
export async function fetchEodAdjustedDaily(
  options: FetchEodAdjustedDailyOptions = {}
): Promise<EodAdjustedDailyApiResponse> {
  const params = new URLSearchParams();
  params.set('includeBars', options.includeBars === true ? 'true' : 'false');
  const symbols = options.eodSymbols?.length
    ? options.eodSymbols
    : options.eodSymbol?.trim()
      ? [options.eodSymbol.trim()]
      : [];
  if (symbols.length > 0) {
    params.set('eodSymbols', [...new Set(symbols.map((s) => s.trim()).filter(Boolean))].join(','));
  }
  return valueInsightGet<EodAdjustedDailyApiResponse>(
    `/eod-adjusted-daily?${params.toString()}`,
    'eod-adjusted-daily'
  );
}

// --- Entry / exit ---

/** GET /entry-exit — all entiryExit rows (server-side Firestore read, 60s cache). */
export async function fetchEntryExitFromApi(): Promise<EntryExitApiResponse> {
  return valueInsightGet<EntryExitApiResponse>('/entry-exit', 'entry-exit');
}

/** PUT /entry-exit — upsert entry/exit rows (Firebase auth required). */
export async function updateEntryExitFromApi(
  body: EntryExitUpdateApiRequest,
  user?: User
): Promise<EntryExitUpdateApiResponse> {
  return valueInsightPut<EntryExitUpdateApiResponse>('/entry-exit', 'entry-exit', body, { user });
}

// --- ISM sector detail ---

/** GET /ism/sectors/overview — latest daily index row per ISM sector. */
export async function fetchIsmSectorOverviewFromApi(sectorIds?: string[]): Promise<IsmSectorOverviewApiResponse> {
  const params = new URLSearchParams();
  if (sectorIds && sectorIds.length > 0) {
    params.set('sectorIds', sectorIds.join(','));
  }
  const qs = params.toString();
  return valueInsightGet<IsmSectorOverviewApiResponse>(
    `/ism/sectors/overview${qs ? `?${qs}` : ''}`,
    'ism-sector-overview'
  );
}

/** GET /ism/sectors/:sectorId/daily-series — chart time series. */
export async function fetchIsmSectorDailySeriesFromApi(
  sectorId: string,
  fromIso: string,
  toIso: string
): Promise<IsmSectorDailySeriesApiResponse> {
  const encoded = encodeURIComponent(sectorId.trim());
  const params = new URLSearchParams({ from: fromIso, to: toIso });
  return valueInsightGet<IsmSectorDailySeriesApiResponse>(
    `/ism/sectors/${encoded}/daily-series?${params.toString()}`,
    'ism-sector-daily-series'
  );
}

/** GET /ism/ingest — merged dashboard + ENTRY/EXIT ingest rows. */
export async function fetchIsmIngestFromApi(): Promise<IsmIngestApiResponse> {
  return valueInsightGet<IsmIngestApiResponse>('/ism/ingest', 'ism-ingest');
}

/** GET /ism/sectors/:sectorId — latest daily index + active rebalance constituents. */
export async function fetchIsmSectorDetailFromApi(sectorId: string): Promise<IsmSectorDetailApiResponse> {
  const encoded = encodeURIComponent(sectorId.trim());
  return valueInsightGet<IsmSectorDetailApiResponse>(`/ism/sectors/${encoded}`, 'ism-sector-detail');
}

// --- ISM compute (admin POST) ---

function ismQueryString(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v?.trim()) q.set(k, v.trim());
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** POST /ism/sectors/:sectorId/rebalance — weekly basket recompute (admin). */
export async function postIsmSectorRebalance(
  sectorId: string,
  user?: User,
  rebalanceDate?: string
): Promise<IsmComputeApiResponse> {
  const encoded = encodeURIComponent(sectorId.trim());
  const qs = ismQueryString({ rebalanceDate });
  return valueInsightPost<IsmComputeApiResponse>(`/ism/sectors/${encoded}/rebalance${qs}`, 'ism-rebalance', {
    user,
  });
}

/** POST /ism/sectors/:sectorId/daily-index — daily index row (admin). */
export async function postIsmSectorDailyIndex(
  sectorId: string,
  user?: User,
  tradeDate?: string
): Promise<IsmComputeApiResponse> {
  const encoded = encodeURIComponent(sectorId.trim());
  const qs = ismQueryString({ tradeDate });
  return valueInsightPost<IsmComputeApiResponse>(`/ism/sectors/${encoded}/daily-index${qs}`, 'ism-daily-index', {
    user,
  });
}

/** POST /ism/rebalance/run-all — rebalance all ISM sectors (admin). */
export async function postIsmRebalanceRunAll(user?: User, rebalanceDate?: string): Promise<IsmComputeApiResponse> {
  const qs = ismQueryString({ rebalanceDate });
  return valueInsightPost<IsmComputeApiResponse>(`/ism/rebalance/run-all${qs}`, 'ism-rebalance-run-all', { user });
}

/** POST /ism/daily-index/run-all — daily index for sectors with active snapshot (admin). */
export async function postIsmDailyIndexRunAll(user?: User, tradeDate?: string): Promise<IsmComputeApiResponse> {
  const qs = ismQueryString({ tradeDate });
  return valueInsightPost<IsmComputeApiResponse>(`/ism/daily-index/run-all${qs}`, 'ism-daily-index-run-all', { user });
}

/** POST /ism/symbols/sync — upsert symbols registry from ingest (admin). */
export async function postIsmSymbolsSync(user?: User): Promise<IsmComputeApiResponse> {
  return valueInsightPost<IsmComputeApiResponse>('/ism/symbols/sync', 'ism-symbols-sync', { user });
}

/** GET /ism/symbols/:symbolId — read one symbol registry doc. */
export async function fetchIsmSymbolFromApi(symbolId: string): Promise<{ symbolId: string; doc: Record<string, unknown> }> {
  const encoded = encodeURIComponent(symbolId.trim());
  return valueInsightGet<{ symbolId: string; doc: Record<string, unknown> }>(
    `/ism/symbols/${encoded}`,
    'ism-symbol'
  );
}

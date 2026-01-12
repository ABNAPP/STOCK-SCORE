/**
 * Delta Sync Service
 * 
 * Provides delta-sync functionality for Google Sheets data:
 * - Initial load: Full snapshot
 * - Subsequent updates: Only changes (delta) since last version
 * - Automatic polling for changes
 * - Retry logic with exponential backoff
 */

import { getDeltaCacheEntry, setDeltaCacheEntry, getLastVersion } from './cacheService';
import type { DataRow } from './sheetsService';

// Configuration
const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';
const DELTA_SYNC_ENABLED = import.meta.env.VITE_DELTA_SYNC_ENABLED !== 'false'; // Default: true
const POLL_INTERVAL_MINUTES = parseInt(import.meta.env.VITE_DELTA_SYNC_POLL_MINUTES || '15', 10);
const API_TOKEN = import.meta.env.VITE_APPS_SCRIPT_TOKEN || ''; // Optional token
const FETCH_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

// Types
export interface SnapshotResponse {
  ok: boolean;
  version: number;
  headers: string[];
  rows: Array<{ key: string; values: any[] }>;
  generatedAt: string;
  error?: string;
}

export interface ChangesResponse {
  ok: boolean;
  fromVersion: number;
  toVersion: number;
  changes: Array<{
    id: number;
    tsISO: string;
    key: string;
    rowIndex: number;
    changedColumns: string[];
    values: any[];
  }>;
  needsFullResync?: boolean;
  error?: string;
}

export interface DeltaSyncConfig {
  sheetName: string;
  apiBaseUrl: string;
  token?: string;
  pollMinutes?: number;
  keyColumnName?: string;
  onUpdate?: (data: any, version: number) => void;
  onError?: (error: Error) => void;
}

/**
 * Convert SnapshotResponse to format expected by transformers
 * Transformers expect: { data: DataRow[]; meta: { fields: string[] | null } }
 */
export function snapshotToTransformerFormat(snapshot: SnapshotResponse): { data: DataRow[]; meta: { fields: string[] | null } } {
  const dataRows: DataRow[] = [];
  
  snapshot.rows.forEach((row) => {
    const dataRow: DataRow = {};
    snapshot.headers.forEach((header, index) => {
      const value = row.values[index];
      dataRow[header] = value === null || value === undefined || value === '' ? '' : value;
    });
    dataRows.push(dataRow);
  });
  
  return {
    data: dataRows,
    meta: { fields: snapshot.headers.length > 0 ? snapshot.headers : null },
  };
}

/**
 * Initialize delta sync for a sheet
 */
export async function initSync<T>(
  config: DeltaSyncConfig,
  cacheKey: string,
  transformer: (results: { data: DataRow[]; meta: { fields: string[] | null } }) => T[]
): Promise<{ data: T[]; version: number }> {
  if (!DELTA_SYNC_ENABLED) {
    throw new Error('Delta sync is disabled');
  }

  if (!config.apiBaseUrl) {
    throw new Error('API base URL is required');
  }

  // Check if we have existing cache with version
  const existingEntry = getDeltaCacheEntry<T[]>(cacheKey);
  if (existingEntry) {
    // Return cached data
    return {
      data: existingEntry.data,
      version: existingEntry.version,
    };
  }

  // Load initial snapshot
  const snapshot = await loadSnapshot(config);
  const transformerFormat = snapshotToTransformerFormat(snapshot);
  const transformedData = transformer(transformerFormat);
  
  // Cache the snapshot
  setDeltaCacheEntry(cacheKey, transformedData, snapshot.version, true);

  return {
    data: transformedData,
    version: snapshot.version,
  };
}

/**
 * Load full snapshot from API
 */
export async function loadSnapshot(config: DeltaSyncConfig): Promise<SnapshotResponse> {
  const url = buildSnapshotUrl(config);
  
  return fetchWithRetry<SnapshotResponse>(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });
}

/**
 * Poll for changes since last version
 */
export async function pollChanges(
  config: DeltaSyncConfig,
  sinceVersion: number
): Promise<ChangesResponse> {
  const url = buildChangesUrl(config, sinceVersion);
  
  return fetchWithRetry<ChangesResponse>(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });
}

/**
 * Apply changes to cached data
 * Simplified implementation: if changes detected or needsFullResync, return signal to reload snapshot
 * @param changes Changes response from API
 * @param cacheKey Cache key
 * @returns Signal to reload snapshot if changes detected, otherwise returns existing cache
 */
export function applyChangesToCache<T>(
  changes: ChangesResponse,
  cacheKey: string
): { needsReload: boolean; version: number; data?: T[] } {
  const existing = getDeltaCacheEntry<T[]>(cacheKey);
  
  if (!changes.ok || changes.needsFullResync) {
    // Need full reload
    return {
      needsReload: true,
      version: changes.toVersion || 0,
    };
  }

  if (!changes.changes || changes.changes.length === 0) {
    // No changes, return existing cache
    if (existing) {
      return {
        needsReload: false,
        version: changes.toVersion,
        data: existing.data,
      };
    }
    // No existing cache, need to load snapshot
    return {
      needsReload: true,
      version: changes.toVersion,
    };
  }

  // Changes detected - need to reload snapshot to get updated data
  // (This is simpler and more reliable than trying to merge changes incrementally)
  return {
    needsReload: true,
    version: changes.toVersion,
  };
}

/**
 * Build snapshot URL
 */
function buildSnapshotUrl(config: DeltaSyncConfig): string {
  const url = new URL(config.apiBaseUrl);
  url.searchParams.set('action', 'snapshot');
  url.searchParams.set('sheet', config.sheetName);
  if (config.token || API_TOKEN) {
    url.searchParams.set('token', config.token || API_TOKEN);
  }
  return url.toString();
}

/**
 * Build changes URL
 */
function buildChangesUrl(config: DeltaSyncConfig, sinceVersion: number): string {
  const url = new URL(config.apiBaseUrl);
  url.searchParams.set('action', 'changes');
  url.searchParams.set('sheet', config.sheetName);
  url.searchParams.set('since', String(sinceVersion));
  if (config.token || API_TOKEN) {
    url.searchParams.set('token', config.token || API_TOKEN);
  }
  return url.toString();
}

/**
 * Fetch with retry and exponential backoff
 */
async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  retries: number = MAX_RETRIES
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Unauthorized: Invalid or missing API token');
      }
      if (response.status === 404) {
        throw new Error(`Not found: ${url}`);
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }

    return data as T;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${FETCH_TIMEOUT}ms`);
    }

    // Retry on network errors or 5xx errors
    if (retries > 0 && (error instanceof TypeError || (error instanceof Error && error.message.includes('HTTP 5')))) {
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, MAX_RETRIES - retries);
      console.warn(`Request failed, retrying in ${delay}ms... (${retries} retries left)`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry<T>(url, options, retries - 1);
    }

    throw error;
  }
}

/**
 * Check if delta sync is enabled
 */
export function isDeltaSyncEnabled(): boolean {
  return DELTA_SYNC_ENABLED && !!APPS_SCRIPT_URL;
}

/**
 * Get poll interval in milliseconds
 */
export function getPollIntervalMs(): number {
  return POLL_INTERVAL_MINUTES * 60 * 1000;
}

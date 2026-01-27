/**
 * Delta Sync Service
 * 
 * Provides delta-sync functionality for Google Sheets data:
 * - Initial load: Full snapshot
 * - Subsequent updates: Only changes (delta) since last version
 * - Automatic polling for changes
 * - Retry logic with exponential backoff
 */

import { getDeltaCacheEntry, setDeltaCacheEntry, getLastVersion } from './firestoreCacheService';
import { logger } from '../utils/logger';
import { isArray, isString } from '../utils/typeGuards';
import { transformInWorker, getTransformerId } from './workerService';
import type { DataRow } from './sheets';

// Configuration
const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';
const DELTA_SYNC_ENABLED = import.meta.env.VITE_DELTA_SYNC_ENABLED !== 'false'; // Default: true
const POLL_INTERVAL_MINUTES = parseInt(import.meta.env.VITE_DELTA_SYNC_POLL_MINUTES || '15', 10);
const API_TOKEN = import.meta.env.VITE_APPS_SCRIPT_TOKEN || ''; // Optional token
// Request timeout: Configurable via environment variable
// Delta sync uses a longer timeout since it may need to fetch large snapshots
// Reduced default from 60s to 30s to fail faster and fallback to CSV method sooner
const DELTA_SYNC_TIMEOUT_SECONDS = parseInt(import.meta.env.VITE_DELTA_SYNC_TIMEOUT_SECONDS || '30', 10); // Default: 30 seconds for delta sync
const DELTA_SYNC_TIMEOUT = DELTA_SYNC_TIMEOUT_SECONDS * 1000;
// Regular fetch timeout (used by fetchService) - shorter for faster feedback
const FETCH_TIMEOUT_SECONDS = parseInt(import.meta.env.VITE_FETCH_TIMEOUT_SECONDS || '30', 10);
const FETCH_TIMEOUT = FETCH_TIMEOUT_SECONDS * 1000;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

/**
 * Snapshot response from Apps Script API
 * 
 * Contains a complete snapshot of sheet data with version information.
 */
export interface SnapshotResponse {
  /** Whether the request was successful */
  ok: boolean;
  /** Version number (changeId) of this snapshot */
  version: number;
  /** Column headers from the sheet */
  headers: string[];
  /** Data rows with key and values */
  rows: Array<{ key: string; values: unknown[] }>;
  /** ISO timestamp when snapshot was generated */
  generatedAt: string;
  /** Error message if request failed */
  error?: string;
}

/**
 * Changes response from Apps Script API
 * 
 * Contains incremental changes since a specific version.
 */
export interface ChangesResponse {
  /** Whether the request was successful */
  ok: boolean;
  /** Version number changes are from */
  fromVersion: number;
  /** Version number changes are to */
  toVersion: number;
  /** Array of individual changes */
  changes: Array<{
    id: number;
    tsISO: string;
    key: string;
    rowIndex: number;
    changedColumns: string[];
    values: unknown[];
  }>;
  /** Whether a full resync is needed instead of incremental updates */
  needsFullResync?: boolean;
  /** Error message if request failed */
  error?: string;
}

/**
 * Delta sync configuration
 * 
 * Configuration object for delta sync operations.
 */
export interface DeltaSyncConfig {
  /** Name of the sheet to sync */
  sheetName: string;
  /** Base URL for Apps Script API */
  apiBaseUrl: string;
  /** Optional API token for authentication */
  token?: string;
  /** Poll interval in minutes (default: 15) */
  pollMinutes?: number;
  /** Name of the key column for row identification */
  keyColumnName?: string;
  /** Callback function called when data is updated */
  onUpdate?: (data: unknown, version: number) => void;
  /** Callback function called on errors */
  onError?: (error: Error) => void;
  /** Data type name for worker transformer (e.g. "Benjamin Graham", "Score Board"). Used with sheetName for getTransformerId. */
  dataTypeName?: string;
  /** Additional data for transformers that need it (e.g. industryPe1Map, industryPe2Map, smaDataMap for Score Board). */
  additionalData?: Record<string, unknown>;
}

/**
 * Convert SnapshotResponse to format expected by transformers
 * 
 * Converts the snapshot response from Apps Script API into the format
 * expected by data transformer functions. Transformers expect:
 * { data: DataRow[]; meta: { fields: string[] | null } }
 * 
 * @param snapshot - Snapshot response from Apps Script API
 * @returns Object with data array and meta fields in transformer format
 * 
 * @example
 * ```typescript
 * const snapshot = await loadSnapshot(config);
 * const transformerFormat = snapshotToTransformerFormat(snapshot);
 * const transformed = transformer(transformerFormat);
 * ```
 */
export function snapshotToTransformerFormat(snapshot: SnapshotResponse): { data: DataRow[]; meta: { fields: string[] | null } } {
  // Validate snapshot structure
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('Invalid snapshot: snapshot is not an object');
  }
  
  if (!snapshot.headers) {
    throw new Error(`Invalid snapshot: headers is undefined or null. Snapshot structure: ${JSON.stringify(Object.keys(snapshot || {}))}`);
  }
  
  if (!isArray(snapshot.headers)) {
    throw new Error(`Invalid snapshot: headers is not an array. Got: ${typeof snapshot.headers}`);
  }
  
  if (!snapshot.rows) {
    throw new Error(`Invalid snapshot: rows is undefined or null. Snapshot structure: ${JSON.stringify(Object.keys(snapshot || {}))}`);
  }
  
  if (!isArray(snapshot.rows)) {
    throw new Error(`Invalid snapshot: rows is not an array. Got: ${typeof snapshot.rows}. Snapshot structure: ${JSON.stringify(Object.keys(snapshot))}`);
  }
  
  const dataRows: DataRow[] = [];
  
  snapshot.rows.forEach((row) => {
    if (!row || typeof row !== 'object' || !isArray(row.values)) {
      logger.warn('Skipping invalid row in snapshot', { component: 'deltaSyncService', operation: 'snapshotToTransformerFormat', row });
      return;
    }
    
    const dataRow: DataRow = {};
    snapshot.headers.forEach((header, index) => {
      if (!isString(header)) {
        logger.warn('Skipping invalid header', { component: 'deltaSyncService', operation: 'snapshotToTransformerFormat', header });
        return;
      }
      
      const value = row.values[index];
      // Convert unknown value to DataRow value type (string | number | undefined)
      if (value === null || value === undefined || value === '') {
        dataRow[header] = '';
      } else if (typeof value === 'string' || typeof value === 'number') {
        dataRow[header] = value;
      } else {
        // Convert other types to string
        dataRow[header] = String(value);
      }
    });
    dataRows.push(dataRow);
  });
  
  return {
    data: dataRows,
    meta: { fields: snapshot.headers && snapshot.headers.length > 0 ? snapshot.headers : null },
  };
}

/**
 * Initialize delta sync for a sheet
 * 
 * Initializes delta sync by loading an initial snapshot and caching it.
 * If cached data exists, returns it immediately. Otherwise, fetches a full
 * snapshot from the API and caches it.
 * 
 * @template T - The type of data after transformation
 * @param config - Delta sync configuration
 * @param cacheKey - Cache key to store/retrieve data
 * @param transformer - Function to transform data rows into target type
 * @returns Promise resolving to data array and version number
 * @throws {Error} If delta sync is disabled or API base URL is missing
 * 
 * @example
 * ```typescript
 * // Initialize delta sync for a sheet
 * const config: DeltaSyncConfig = {
 *   sheetName: 'DashBoard',
 *   apiBaseUrl: APPS_SCRIPT_URL,
 * };
 * 
 * const { data, version } = await initSync<ScoreBoardData[]>(
 *   config,
 *   CACHE_KEYS.SCORE_BOARD,
 *   transformScoreBoardData
 * );
 * 
 * // data: Array of transformed data
 * // version: Current version number for polling
 * console.log(`Loaded ${data.length} items, version ${version}`);
 * ```
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
  const existingEntry = await getDeltaCacheEntry<T[]>(cacheKey);
  if (existingEntry) {
    // Return cached data
    return {
      data: existingEntry.data,
      version: existingEntry.version,
    };
  }

  // Load initial snapshot
  let snapshot: SnapshotResponse;
  try {
    snapshot = await loadSnapshot(config);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load snapshot for sheet "${config.sheetName}": ${errorMessage}`);
  }
  
  // Validate snapshot response
  if (!snapshot || !snapshot.ok) {
    const errorMsg = snapshot?.error || 'Unknown error';
    throw new Error(`Snapshot request failed for sheet "${config.sheetName}": ${errorMsg}`);
  }
  
  let transformerFormat: { data: DataRow[]; meta: { fields: string[] | null } };
  try {
    transformerFormat = snapshotToTransformerFormat(snapshot);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to transform snapshot data for sheet "${config.sheetName}": ${errorMessage}. Snapshot version: ${snapshot.version}, Headers: ${snapshot.headers?.length || 0}, Rows: ${snapshot.rows?.length || 0}`);
  }
  
  // Try to use Web Worker for transformation, fallback to main thread
  let transformedData: T[];
  const transformerId = getTransformerId(config.dataTypeName ?? config.sheetName, config.sheetName);

  if (transformerId) {
    try {
      transformedData = await transformInWorker<T>(
        transformerId,
        transformerFormat.data,
        transformerFormat.meta,
        undefined, // progressCallback (delta sync doesn't use progress callbacks)
        config.additionalData,
        transformer // fallback transformer
      );
    } catch (workerError) {
      // Fallback to main thread transformation
      logger.debug(
        `Worker transformation failed for ${config.sheetName}, using main thread`,
        { component: 'deltaSyncService', sheetName: config.sheetName, error: workerError }
      );
      transformedData = transformer(transformerFormat);
    }
  } else {
    // No transformer ID found, use main thread
    transformedData = transformer(transformerFormat);
  }
  
  // Cache the snapshot
  setDeltaCacheEntry(cacheKey, transformedData, snapshot.version, true);

  return {
    data: transformedData,
    version: snapshot.version,
  };
}

/**
 * Load full snapshot from API
 * 
 * Fetches a complete snapshot of sheet data from the Apps Script API.
 * This is used for initial load or when a full resync is needed.
 * 
 * @param config - Delta sync configuration
 * @returns Promise resolving to snapshot response
 * @throws {Error} If fetch fails or response is invalid
 * 
 * @example
 * ```typescript
 * const snapshot = await loadSnapshot({
 *   sheetName: 'DashBoard',
 *   apiBaseUrl: APPS_SCRIPT_URL
 * });
 * ```
 */
export async function loadSnapshot(config: DeltaSyncConfig): Promise<SnapshotResponse> {
  const url = buildSnapshotUrl(config);
  
  try {
    // Use longer timeout for delta sync snapshot requests (30 seconds default, configurable via VITE_DELTA_SYNC_TIMEOUT_SECONDS)
    const rawResponse = await fetchWithRetry<unknown>(
      url,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      },
      MAX_RETRIES,
      DELTA_SYNC_TIMEOUT // Use longer timeout for delta sync
    );
    
    // Handle case where API returns a 2D array directly (legacy format)
    // This happens when Apps Script returns data in the old format: [["Header1", "Header2"], ["Value1", "Value2"], ...]
    if (isArray(rawResponse) && rawResponse.length > 0) {
      // Check if first element is an array (indicating 2D array format)
      if (isArray(rawResponse[0])) {
        // Convert 2D array to SnapshotResponse format
        const headerRow = rawResponse[0];
        const headers: string[] = headerRow.map((h: unknown) => String(h || ''));
        
        const rows = rawResponse.slice(1).map((row: unknown, index: number) => {
          if (!isArray(row)) {
            logger.warn('Skipping invalid row in 2D array response', { component: 'deltaSyncService', operation: 'loadSnapshot', rowIndex: index });
            return { key: String(index), values: [] };
          }
          return {
            key: String(index),
            values: row.map((v: unknown) => v),
          };
        });
        
        logger.debug('Converted 2D array to SnapshotResponse format', { 
          component: 'deltaSyncService', 
          operation: 'loadSnapshot', 
          headersCount: headers.length, 
          rowsCount: rows.length 
        });
        
        return {
          ok: true,
          version: Date.now(), // Use timestamp as version for legacy format
          headers: headers,
          rows: rows,
          generatedAt: new Date().toISOString(),
        };
      }
    }
    
    // Validate response structure for new format
    if (!rawResponse || typeof rawResponse !== 'object' || Array.isArray(rawResponse)) {
      throw new Error(`Invalid snapshot response: expected object, got ${Array.isArray(rawResponse) ? 'array' : typeof rawResponse}`);
    }
    
    const response = rawResponse as SnapshotResponse;
    
    // Check if response indicates failure
    if (response.ok === false) {
      const errorMsg = response.error || 'Unknown error from API';
      throw new Error(`Snapshot API returned error: ${errorMsg}`);
    }
    
    // Validate required fields
    if (!isArray(response.headers)) {
      throw new Error(`Invalid snapshot response: headers is not an array. Response type: ${typeof response.headers}, Response keys: ${isArray(response) ? 'array' : Object.keys(response).join(', ')}`);
    }
    
    if (!isArray(response.rows)) {
      throw new Error(`Invalid snapshot response: rows is not an array. Response type: ${typeof response.rows}, Response keys: ${isArray(response) ? 'array' : Object.keys(response).join(', ')}`);
    }
    
    if (typeof response.version !== 'number') {
      throw new Error(`Invalid snapshot response: version is not a number. Got: ${typeof response.version}`);
    }
    
    return response;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      `Failed to load snapshot for sheet "${config.sheetName}"`,
      error,
      { component: 'deltaSyncService', operation: 'loadSnapshot', sheetName: config.sheetName, url }
    );
    throw error;
  }
}

/**
 * Poll for changes since last version
 * 
 * Fetches incremental changes from the Apps Script API since a specific version.
 * Used for efficient updates without reloading all data.
 * 
 * @param config - Delta sync configuration
 * @param sinceVersion - Version number to fetch changes from
 * @returns Promise resolving to changes response
 * @throws {Error} If fetch fails or response is invalid
 * 
 * @example
 * ```typescript
 * const changes = await pollChanges(config, lastVersion);
 * if (changes.changes.length > 0) {
 *   // Process changes
 * }
 * ```
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
 * 
 * Analyzes changes response and determines if a full snapshot reload is needed.
 * Simplified implementation: if changes are detected or full resync is needed,
 * returns a signal to reload snapshot rather than merging changes incrementally.
 * 
 * @template T - The type of cached data
 * @param changes - Changes response from API
 * @param cacheKey - Cache key to check/update
 * @returns Object indicating if reload is needed, with version and optional cached data
 * 
 * @example
 * ```typescript
 * const result = applyChangesToCache<ScoreBoardData[]>(changes, CACHE_KEYS.SCORE_BOARD);
 * if (result.needsReload) {
 *   // Reload full snapshot
 * } else if (result.data) {
 *   // Use cached data
 * }
 * ```
 */
/**
 * Apply changes to cached data
 * 
 * Analyzes changes response and determines if a full snapshot reload is needed.
 * Simplified implementation: if changes are detected or full resync is needed,
 * returns a signal to reload snapshot rather than merging changes incrementally.
 * 
 * **Edge Cases:**
 * - **Version mismatch**: If needsFullResync is true, triggers full reload
 * - **No existing cache**: If cache doesn't exist, triggers full snapshot load
 * - **Changes detected**: Reloads full snapshot (simpler than incremental merge)
 * 
 * **Why full reload instead of incremental merge?**
 * - Simpler and more reliable than trying to merge individual row changes
 * - Ensures data consistency (no partial updates)
 * - Full snapshot is still efficient with delta sync (only changed rows are sent)
 * 
 * @template T - The type of cached data
 * @param changes - Changes response from API
 * @param cacheKey - Cache key to check/update
 * @returns Object indicating if reload is needed, with version and optional cached data
 * 
 * @example
 * ```typescript
 * const result = applyChangesToCache<ScoreBoardData[]>(changes, CACHE_KEYS.SCORE_BOARD);
 * if (result.needsReload) {
 *   // Reload full snapshot
 * } else if (result.data) {
 *   // Use cached data
 * }
 * ```
 */
export async function applyChangesToCache<T>(
  changes: ChangesResponse,
  cacheKey: string
): Promise<{ needsReload: boolean; version: number; data?: T[] }> {
  const existing = await getDeltaCacheEntry<T[]>(cacheKey);

  // Edge case: Full resync needed (version mismatch or server request)
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
    // Edge case: No existing cache - need to load snapshot
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
  retries: number = MAX_RETRIES,
  timeout: number = DELTA_SYNC_TIMEOUT
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
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

    let data: unknown;
    try {
      data = await response.json();
    } catch (parseError: unknown) {
      const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      throw new Error(`Failed to parse JSON response: ${errorMessage}`);
    }
    
    // Check for error in response object
    if (data && typeof data === 'object' && !Array.isArray(data) && 'error' in data) {
      const errorData = data as { error?: unknown };
      if (errorData.error) {
        throw new Error(String(errorData.error));
      }
    }

    return data as T;
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }

    // Retry on network errors or 5xx errors
    if (retries > 0 && (error instanceof TypeError || (error instanceof Error && error.message.includes('HTTP 5')))) {
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, MAX_RETRIES - retries);
      logger.warn(`Request failed, retrying in ${delay}ms... (${retries} retries left)`, { component: 'deltaSyncService', retries, delay });
      
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

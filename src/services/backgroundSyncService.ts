/**
 * Background Sync Service
 *
 * Coordinates background data synchronization when the user is inactive.
 * Works with Service Worker to sync data in the background without blocking the UI.
 */

import { logger } from '../utils/logger';
import { requestBackgroundSync } from '../utils/serviceWorkerRegistration';
import { isDeltaSyncEnabled, getApiBaseUrlForDeltaSync } from './deltaSyncService';
import { snapshotToTransformerFormat } from './deltaSyncService';
import type { SnapshotResponse } from './deltaSyncService';
import { CACHE_KEYS } from './cacheKeys';
import { getCachedData, setDeltaCacheEntry, VIEWDATA_MIGRATION_MODE } from './firestoreCacheService';
import { transformBenjaminGrahamData } from './sheets/benjaminGrahamService';
import { transformPEIndustryData } from './sheets/peIndustryService';
import { transformSMAData } from './sheets/smaService';
import { createScoreBoardTransformer } from './sheets/scoreBoardService';
import type { PEIndustryData } from '../types/stock';
import type { SMAData } from '../types/stock';

const APPS_SCRIPT_TOKEN = import.meta.env.VITE_APPS_SCRIPT_TOKEN || '';

// Sync coordination (in-memory; prevents duplicate syncs when tab is hidden repeatedly)
let syncInProgressUntil = 0;
const SYNC_COORDINATION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Unique sheets to sync (one fetch per sheet). Each sheet maps to one or more cache keys.
const SHEETS_TO_SYNC: { sheetName: string; cacheKeys: string[] }[] = [
  {
    sheetName: 'DashBoard',
    cacheKeys: [
      CACHE_KEYS.BENJAMIN_GRAHAM,
      CACHE_KEYS.PE_INDUSTRY,
      CACHE_KEYS.SCORE_BOARD,
    ],
  },
  { sheetName: 'SMA', cacheKeys: [CACHE_KEYS.SMA] },
];

function isSyncInProgress(): boolean {
  return Date.now() < syncInProgressUntil;
}

function setSyncInProgress(): void {
  syncInProgressUntil = Date.now() + SYNC_COORDINATION_TIMEOUT;
}

function clearSyncInProgress(): void {
  syncInProgressUntil = 0;
}

/**
 * Persist snapshot to cache keys for a sheet (transform + setDeltaCacheEntry)
 */
async function persistSnapshotToCache(
  sheetName: string,
  cacheKeys: string[],
  snapshot: SnapshotResponse
): Promise<void> {
  let transformerFormat: ReturnType<typeof snapshotToTransformerFormat>;
  try {
    transformerFormat = snapshotToTransformerFormat(snapshot);
  } catch (err) {
    logger.warn('Failed to transform snapshot for background sync', {
      component: 'backgroundSyncService',
      sheetName,
      error: err,
    });
    return;
  }

  const version = snapshot.version ?? 0;

  // cutover: no appCache writes for view-docs
  const skipAppCacheWrite = VIEWDATA_MIGRATION_MODE === 'cutover';

  for (const cacheKey of cacheKeys) {
    try {
      if (cacheKey === CACHE_KEYS.BENJAMIN_GRAHAM) {
        const data = transformBenjaminGrahamData(transformerFormat);
        if (!skipAppCacheWrite) await setDeltaCacheEntry(cacheKey, data, version, true);
      } else if (cacheKey === CACHE_KEYS.PE_INDUSTRY) {
        const data = transformPEIndustryData(transformerFormat);
        if (!skipAppCacheWrite) await setDeltaCacheEntry(cacheKey, data, version, true);
      } else if (cacheKey === CACHE_KEYS.SMA) {
        const data = transformSMAData(transformerFormat);
        if (!skipAppCacheWrite) await setDeltaCacheEntry(cacheKey, data, version, true);
      } else if (cacheKey === CACHE_KEYS.SCORE_BOARD) {
        const peData = await getCachedData<PEIndustryData[]>(CACHE_KEYS.PE_INDUSTRY);
        const smaData = await getCachedData<SMAData[]>(CACHE_KEYS.SMA);
        if (!peData?.length || !smaData?.length) {
          logger.debug('Skipping Score Board persist: PE or SMA cache missing', {
            component: 'backgroundSyncService',
            sheetName,
          });
          continue;
        }
        const industryPe1Map = new Map<string, number>();
        const industryPe2Map = new Map<string, number>();
        peData.forEach((pe) => {
          if (pe.pe1 != null) industryPe1Map.set(pe.industry.toLowerCase(), pe.pe1);
          if (pe.pe2 != null) industryPe2Map.set(pe.industry.toLowerCase(), pe.pe2);
        });
        const smaDataMap = new Map<string, { sma100: number | null; sma200: number | null; smaCross: string | null }>();
        smaData.forEach((s) => {
          smaDataMap.set(s.ticker.toLowerCase().trim(), {
            sma100: s.sma100,
            sma200: s.sma200,
            smaCross: s.smaCross,
          });
        });
        const transformer = createScoreBoardTransformer(industryPe1Map, industryPe2Map, smaDataMap);
        const data = transformer(transformerFormat);
        if (!skipAppCacheWrite) await setDeltaCacheEntry(cacheKey, data, version, true);
      }
    } catch (err) {
      logger.warn('Failed to persist cache key in background sync', {
        component: 'backgroundSyncService',
        cacheKey,
        sheetName,
        error: err,
      });
    }
  }
}

/**
 * Sync a single sheet in the background (one fetch per sheet, persist to all its cache keys)
 */
async function syncSheet(sheetName: string, cacheKeys: string[]): Promise<void> {
  let apiBaseUrl: string;
  try {
    apiBaseUrl = getApiBaseUrlForDeltaSync();
  } catch (err) {
    logger.warn('Cannot use direct Apps Script with API_TOKEN. Set VITE_APPS_SCRIPT_PROXY_URL. Skipping background sync.', {
      component: 'backgroundSyncService',
      sheetName,
      error: err,
    });
    return;
  }

  if (!apiBaseUrl) {
    logger.debug('Apps Script URL not configured, skipping background sync', {
      component: 'backgroundSyncService',
      sheetName,
    });
    return;
  }

  if (!isDeltaSyncEnabled()) {
    logger.debug('Delta sync not enabled, skipping background sync', {
      component: 'backgroundSyncService',
      sheetName,
    });
    return;
  }

  if (isSyncInProgress()) {
    logger.debug('Sync already in progress, skipping', {
      component: 'backgroundSyncService',
      sheetName,
    });
    return;
  }

  try {
    setSyncInProgress();
    logger.debug('Starting background sync for sheet', {
      component: 'backgroundSyncService',
      sheetName,
    });

    const result = await requestBackgroundSync(
      sheetName,
      apiBaseUrl,
      APPS_SCRIPT_TOKEN || undefined
    ) as { type: string; sheetName?: string; snapshot?: SnapshotResponse };

    if (result?.type === 'SYNC_COMPLETE' && result.snapshot && result.sheetName) {
      await persistSnapshotToCache(result.sheetName, cacheKeys, result.snapshot);
    }

    logger.info('Background sync completed for sheet', {
      component: 'backgroundSyncService',
      sheetName,
    });
  } catch (error) {
    logger.warn('Background sync failed for sheet', {
      component: 'backgroundSyncService',
      sheetName,
      error,
    });
  } finally {
    setTimeout(() => clearSyncInProgress(), 30000);
  }
}

/**
 * Sync all sheets in the background (one fetch per unique sheet, then persist to all cache keys)
 */
export async function syncAllSheets(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    logger.debug('Service Worker not available, skipping background sync', {
      component: 'backgroundSyncService',
      operation: 'syncAllSheets',
    });
    return;
  }

  for (const { sheetName, cacheKeys } of SHEETS_TO_SYNC) {
    await syncSheet(sheetName, cacheKeys);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

/**
 * Initialize background sync based on page visibility
 */
export function initializeBackgroundSync(): void {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  // Sync when page becomes hidden (user switches tabs or minimizes)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Page is hidden, trigger background sync
      logger.debug('Page hidden, triggering background sync', {
        component: 'backgroundSyncService',
        operation: 'visibilitychange',
      });
      
      // Sync in background (fire and forget)
      syncAllSheets().catch((error) => {
        logger.warn('Background sync failed', {
          component: 'backgroundSyncService',
          operation: 'visibilitychange',
          error,
        });
      });
    }
  });

  // Sync on page unload is not implemented. visibilitychange (tab switch) handles
  // background sync when the user leaves the tab; that is sufficient.
}

/**
 * Manual trigger for background sync (for testing or user-initiated)
 */
export async function triggerBackgroundSync(sheetName?: string): Promise<void> {
  if (sheetName) {
    const entry = SHEETS_TO_SYNC.find((s) => s.sheetName === sheetName);
    if (entry) await syncSheet(entry.sheetName, entry.cacheKeys);
    else logger.warn('Unknown sheet for background sync', { component: 'backgroundSyncService', sheetName });
  } else {
    await syncAllSheets();
  }
}

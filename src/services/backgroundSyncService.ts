/**
 * Background Sync Service
 * 
 * Coordinates background data synchronization when the user is inactive.
 * Works with Service Worker to sync data in the background without blocking the UI.
 */

import { logger } from '../utils/logger';
import { requestBackgroundSync } from '../utils/serviceWorkerRegistration';
import { isDeltaSyncEnabled } from './deltaSyncService';
import { CACHE_KEYS } from './cacheService';

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';

// Sync coordination flag (stored in sessionStorage to coordinate between main app and SW)
const SYNC_COORDINATION_KEY = 'bg:sync:coordinating';
const SYNC_COORDINATION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Sheets to sync in background
const SHEETS_TO_SYNC = [
  { sheetName: 'DashBoard', cacheKey: CACHE_KEYS.BENJAMIN_GRAHAM },
  { sheetName: 'DashBoard', cacheKey: CACHE_KEYS.SCORE_BOARD },
  { sheetName: 'DashBoard', cacheKey: CACHE_KEYS.PE_INDUSTRY },
  { sheetName: 'DashBoard', cacheKey: CACHE_KEYS.THRESHOLD_INDUSTRY },
  { sheetName: 'SMA', cacheKey: CACHE_KEYS.SMA },
];

/**
 * Check if sync is already in progress (coordination)
 */
function isSyncInProgress(): boolean {
  try {
    const syncData = sessionStorage.getItem(SYNC_COORDINATION_KEY);
    if (!syncData) return false;
    
    const { timestamp } = JSON.parse(syncData);
    const age = Date.now() - timestamp;
    
    // If sync flag is older than timeout, consider it stale
    if (age > SYNC_COORDINATION_TIMEOUT) {
      sessionStorage.removeItem(SYNC_COORDINATION_KEY);
      return false;
    }
    
    return true;
  } catch (error) {
    logger.warn('Failed to check sync status', {
      component: 'backgroundSyncService',
      operation: 'isSyncInProgress',
      error,
    });
    return false;
  }
}

/**
 * Set sync coordination flag
 */
function setSyncInProgress(sheetName: string): void {
  try {
    sessionStorage.setItem(
      SYNC_COORDINATION_KEY,
      JSON.stringify({
        sheetName,
        timestamp: Date.now(),
      })
    );
  } catch (error) {
    logger.warn('Failed to set sync status', {
      component: 'backgroundSyncService',
      operation: 'setSyncInProgress',
      error,
    });
  }
}

/**
 * Clear sync coordination flag
 */
function clearSyncInProgress(): void {
  try {
    sessionStorage.removeItem(SYNC_COORDINATION_KEY);
  } catch (error) {
    // Ignore errors
  }
}

/**
 * Sync a single sheet in the background
 */
async function syncSheet(sheetName: string): Promise<void> {
  if (!APPS_SCRIPT_URL) {
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

  // Check if sync is already in progress
  if (isSyncInProgress()) {
    logger.debug('Sync already in progress, skipping', {
      component: 'backgroundSyncService',
      sheetName,
    });
    return;
  }

  try {
    setSyncInProgress(sheetName);
    
    logger.debug('Starting background sync for sheet', {
      component: 'backgroundSyncService',
      sheetName,
    });

    // Request sync from Service Worker
    await requestBackgroundSync(sheetName, APPS_SCRIPT_URL);
    
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
    // Clear sync flag after a delay to allow Service Worker to finish
    setTimeout(() => {
      clearSyncInProgress();
    }, 30000); // 30 seconds
  }
}

/**
 * Sync all sheets in the background
 */
export async function syncAllSheets(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    logger.debug('Service Worker not available, skipping background sync', {
      component: 'backgroundSyncService',
      operation: 'syncAllSheets',
    });
    return;
  }

  // Sync sheets sequentially to avoid overwhelming the API
  for (const { sheetName } of SHEETS_TO_SYNC) {
    await syncSheet(sheetName);
    // Small delay between syncs
    await new Promise((resolve) => setTimeout(resolve, 1000));
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

  // Also sync when page is about to be unloaded (user navigates away)
  window.addEventListener('beforeunload', () => {
    if (!document.hidden) {
      // Only sync if page is visible (not already hidden)
      logger.debug('Page unloading, triggering background sync', {
        component: 'backgroundSyncService',
        operation: 'beforeunload',
      });
      
      // Use sendBeacon for reliability during page unload
      if (navigator.sendBeacon && APPS_SCRIPT_URL) {
        // For now, we'll just log - actual sync would need to be handled by Service Worker
        // Service Worker can handle this via 'sync' event if supported
      }
    }
  });
}

/**
 * Manual trigger for background sync (for testing or user-initiated)
 */
export async function triggerBackgroundSync(sheetName?: string): Promise<void> {
  if (sheetName) {
    await syncSheet(sheetName);
  } else {
    await syncAllSheets();
  }
}

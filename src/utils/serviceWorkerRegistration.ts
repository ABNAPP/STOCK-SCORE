/**
 * Service Worker Registration
 * 
 * Handles registration and updates of the Service Worker.
 */

import { logger } from './logger';

const SW_URL = '/sw.js';
const SW_VERSION = 'v1';

/**
 * Register Service Worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    logger.debug('Service Workers are not supported in this browser', {
      component: 'serviceWorkerRegistration',
      operation: 'register',
    });
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(SW_URL, {
      scope: '/',
    });

    logger.info('Service Worker registered successfully', {
      component: 'serviceWorkerRegistration',
      operation: 'register',
      scope: registration.scope,
    });

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New service worker available
          logger.info('New Service Worker available', {
            component: 'serviceWorkerRegistration',
            operation: 'update',
          });
          // Optionally notify user or auto-update
          // For now, we'll just log it
        }
      });
    });

    // Check for updates periodically (every hour)
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000);

    return registration;
  } catch (error) {
    logger.error(
      'Service Worker registration failed',
      error instanceof Error ? error : new Error(String(error)),
      { component: 'serviceWorkerRegistration', operation: 'register' }
    );
    return null;
  }
}

/**
 * Unregister Service Worker (for development/testing)
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const unregistered = await registration.unregister();
    
    if (unregistered) {
      logger.info('Service Worker unregistered', {
        component: 'serviceWorkerRegistration',
        operation: 'unregister',
      });
    }
    
    return unregistered;
  } catch (error) {
    logger.error(
      'Service Worker unregistration failed',
      error instanceof Error ? error : new Error(String(error)),
      { component: 'serviceWorkerRegistration', operation: 'unregister' }
    );
    return false;
  }
}

/**
 * Send message to Service Worker
 */
export function sendMessageToServiceWorker(message: unknown): void {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    return;
  }

  navigator.serviceWorker.controller.postMessage(message);
}

const SYNC_REQUEST_TIMEOUT_MS = 45_000;

/**
 * Request background sync from Service Worker
 * @param sheetName - Sheet to sync (e.g. DashBoard, SMA)
 * @param apiBaseUrl - Apps Script API base URL
 * @param token - Optional API token (e.g. VITE_APPS_SCRIPT_TOKEN)
 */
export function requestBackgroundSync(
  sheetName: string,
  apiBaseUrl: string,
  token?: string
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      reject(new Error('Service Worker not available'));
      return;
    }

    let settled = false;
    const messageChannel = new MessageChannel();

    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      messageChannel.port1.onmessage = null;
      reject(new Error(`Background sync timeout for ${sheetName} (${SYNC_REQUEST_TIMEOUT_MS}ms)`));
    }, SYNC_REQUEST_TIMEOUT_MS);

    messageChannel.port1.onmessage = (event) => {
      if (settled) return;
      if (event.data?.type === 'SYNC_COMPLETE') {
        settled = true;
        clearTimeout(timeoutId);
        messageChannel.port1.onmessage = null;
        resolve(event.data);
      } else if (event.data?.type === 'SYNC_ERROR') {
        settled = true;
        clearTimeout(timeoutId);
        messageChannel.port1.onmessage = null;
        reject(new Error(event.data.error));
      }
    };

    const payload: { type: string; sheetName: string; apiBaseUrl: string; token?: string } = {
      type: 'SYNC_REQUEST',
      sheetName,
      apiBaseUrl,
    };
    if (token) payload.token = token;

    navigator.serviceWorker.controller.postMessage(payload, [messageChannel.port2]);
  });
}

const CLEAR_API_CACHE_TIMEOUT_MS = 5_000;

/**
 * Request Service Worker to clear API cache (used before Refresh Now refetch).
 * Resolves immediately if SW is not available.
 */
export function requestClearApiCache(): Promise<void> {
  return new Promise((resolve) => {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      resolve();
      return;
    }

    let settled = false;
    const messageChannel = new MessageChannel();

    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      messageChannel.port1.onmessage = null;
      logger.warn('Clear API cache timeout; continuing with refetch', {
        component: 'serviceWorkerRegistration',
        operation: 'requestClearApiCache',
      });
      resolve();
    }, CLEAR_API_CACHE_TIMEOUT_MS);

    messageChannel.port1.onmessage = (event) => {
      if (settled) return;
      if (event.data?.type === 'CLEAR_API_CACHE_DONE') {
        settled = true;
        clearTimeout(timeoutId);
        messageChannel.port1.onmessage = null;
        resolve();
      }
    };

    navigator.serviceWorker.controller.postMessage(
      { type: 'CLEAR_API_CACHE' },
      [messageChannel.port2]
    );
  });
}

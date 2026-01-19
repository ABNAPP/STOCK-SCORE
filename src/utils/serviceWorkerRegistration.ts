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

/**
 * Request background sync from Service Worker
 */
export function requestBackgroundSync(sheetName: string, apiBaseUrl: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      reject(new Error('Service Worker not available'));
      return;
    }

    const messageChannel = new MessageChannel();
    
    messageChannel.port1.onmessage = (event) => {
      if (event.data.type === 'SYNC_COMPLETE') {
        resolve(event.data);
      } else if (event.data.type === 'SYNC_ERROR') {
        reject(new Error(event.data.error));
      }
    };

    navigator.serviceWorker.controller.postMessage(
      {
        type: 'SYNC_REQUEST',
        sheetName,
        apiBaseUrl,
      },
      [messageChannel.port2]
    );
  });
}

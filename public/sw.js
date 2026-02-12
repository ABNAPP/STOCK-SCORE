/**
 * Service Worker for Stock Score App
 *
 * Policy:
 * - SW caches only static assets (app shell). Precache/navigation can use CACHE_NAME.
 * - API requests are bypassed (no caching). Pass-through fetch only.
 * - All data consistency comes from Firestore appCache (single source of truth).
 *
 * Handles background sync and offline support. Coordinates with delta sync to avoid double syncing.
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `stock-score-${CACHE_VERSION}`;
const SYNC_COORDINATION_KEY = 'sw:sync:coordinating';

/** Cache names that were previously used for API caching. Cleared on CLEAR_API_CACHE and activate. */
const LEGACY_API_CACHE_NAMES = [];

/** App-shell URLs precached on install. Only assets that exist in build (e.g. Vite dist). */
const PRECACHE_URLS = ['/', '/index.html'];

/**
 * Returns true if the request is an API request (Apps Script, proxy endpoints).
 * These are never cached by the SW; data comes from Firestore appCache.
 * @param {URL} url - Parsed request URL
 * @param {Request} request - The request (optional, for future method/path checks)
 * @returns {boolean}
 */
function isApiRequest(url, request) {
  const host = url.hostname || '';
  return (
    host.includes('script.google.com') ||
    host.includes('docs.google.com') ||
    host.includes('api.allorigins.win') ||
    host.includes('corsproxy.io')
  );
}

/**
 * Returns true if the URL is a precached app-shell entry (same-origin navigation/document).
 * Used to serve cache-first for GET requests to '/' or '/index.html' when offline.
 * @param {URL} url - Parsed request URL
 * @returns {boolean}
 */
function isPrecachedAppShellUrl(url) {
  const path = url.pathname || '/';
  return path === '/' || path === '' || path === '/index.html';
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...', CACHE_VERSION);

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(PRECACHE_URLS).catch((error) => {
        console.warn('[Service Worker] Failed to cache some assets:', error);
      });
    })
  );

  self.skipWaiting();
});

// Activate event - cleanup old caches (keep CACHE_NAME for static)
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...', CACHE_VERSION);

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  return self.clients.claim();
});

// Fetch event - API pass-through (no cache); app-shell cache-first for precached URLs only
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (isApiRequest(url, event.request)) {
    // Pass-through: do not cache API responses; let fetch fail normally when offline
    event.respondWith(fetch(event.request));
    return;
  }

  // Same-origin GET for precached app-shell URLs: cache-first so offline reload works
  if (
    url.origin === self.location.origin &&
    event.request.method === 'GET' &&
    isPrecachedAppShellUrl(url)
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => cache.match(event.request)).then((cached) => cached || fetch(event.request))
    );
    return;
  }

  // All other non-API: do not intercept (browser handles)
  return;
});

// Message event - coordinate with main app
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'SYNC_REQUEST') {
    const { sheetName, apiBaseUrl, token } = event.data;
    handleBackgroundSync(sheetName, apiBaseUrl, event.ports[0], token);
  }

  if (event.data && event.data.type === 'CHECK_SYNC_STATUS') {
    event.ports[0].postMessage({
      type: 'SYNC_STATUS',
      isSyncing: false,
    });
  }

  if (event.data && event.data.type === 'CLEAR_API_CACHE') {
    const port = event.ports && event.ports[0];
    Promise.all(
      LEGACY_API_CACHE_NAMES.map((name) => caches.delete(name).catch(() => {}))
    ).then(() => {
      if (port) port.postMessage({ type: 'CLEAR_API_CACHE_DONE' });
    });
  }
});

function isDirectAppsScriptUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    return u.hostname.includes('script.google.com') || u.pathname.includes('/macros/s/');
  } catch (e) { return false; }
}

// Background sync handler - Token in Authorization header only; never in URL or body (client->proxy)
async function handleBackgroundSync(sheetName, apiBaseUrl, port, token) {
  try {
    // When token is required but missing, or when using direct Apps Script without token - abort
    if (!token && isDirectAppsScriptUrl(apiBaseUrl)) {
      const errMsg = 'Background sync requires token when calling Apps Script. Use proxy URL (VITE_APPS_SCRIPT_PROXY_URL) or disable API_TOKEN.';
      console.warn('[Service Worker] ' + errMsg);
      if (port) port.postMessage({ type: 'SYNC_ERROR', sheetName, error: errMsg });
      return;
    }

    console.log('[Service Worker] Background sync requested for:', sheetName);

    const usePost = !!token;
    const url = usePost ? apiBaseUrl : (() => {
      const u = new URL(apiBaseUrl);
      u.searchParams.set('action', 'snapshot');
      u.searchParams.set('sheet', sheetName);
      return u.toString();
    })();

    const init = usePost
      ? {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...(token ? { 'Authorization': 'Bearer ' + token } : {}) },
          body: JSON.stringify({ action: 'snapshot', sheet: sheetName }),
        }
      : { method: 'GET', headers: { 'Accept': 'application/json' } };

    const response = await fetch(url, init);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const snapshot = await response.json();

    if (port) {
      port.postMessage({
        type: 'SYNC_COMPLETE',
        sheetName,
        snapshot,
      });
    }

    console.log('[Service Worker] Background sync completed for:', sheetName);
  } catch (error) {
    console.error('[Service Worker] Background sync failed:', error);
    if (port) {
      port.postMessage({
        type: 'SYNC_ERROR',
        sheetName,
        error: error.message,
      });
    }
  }
}

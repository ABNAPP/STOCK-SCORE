/**
 * Service Worker for Stock Score App
 * 
 * Handles background sync, caching, and offline support.
 * Coordinates with delta sync to avoid double syncing.
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `stock-score-${CACHE_VERSION}`;
const SYNC_COORDINATION_KEY = 'sw:sync:coordinating';

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...', CACHE_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      // Cache will be populated on first fetch
      return cache.addAll([
        // Add critical assets here if needed
        // '/',
        // '/index.html',
      ]).catch((error) => {
        console.warn('[Service Worker] Failed to cache some assets:', error);
        // Don't fail installation if some assets fail to cache
      });
    })
  );
  
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - cleanup old caches
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
  
  // Take control of all clients immediately
  return self.clients.claim();
});

// Fetch event - cache-first strategy for API requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Only handle API requests (Apps Script or CSV proxy)
  const isAPIRequest = 
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('docs.google.com') ||
    url.hostname.includes('api.allorigins.win') ||
    url.hostname.includes('corsproxy.io');
  
  if (!isAPIRequest) {
    // For non-API requests, use network-first (let browser handle it)
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached response
        console.log('[Service Worker] Serving from cache:', event.request.url);
        return cachedResponse;
      }
      
      // Fetch from network
      return fetch(event.request).then((response) => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        
        // Clone the response (stream can only be read once)
        const responseToCache = response.clone();
        
        // Cache the response
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        
        return response;
      }).catch((error) => {
        console.error('[Service Worker] Fetch failed:', error);
        // Return error response or fallback
        throw error;
      });
    })
  );
});

// Message event - coordinate with main app
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'SYNC_REQUEST') {
    // Handle sync request from main app
    const { sheetName, apiBaseUrl, token } = event.data;
    handleBackgroundSync(sheetName, apiBaseUrl, event.ports[0], token);
  }
  
  if (event.data && event.data.type === 'CHECK_SYNC_STATUS') {
    // Check if sync is already in progress
    event.ports[0].postMessage({
      type: 'SYNC_STATUS',
      isSyncing: false, // We'll implement proper coordination later
    });
  }

  if (event.data && event.data.type === 'CLEAR_API_CACHE') {
    const port = event.ports && event.ports[0];
    caches.delete(CACHE_NAME)
      .then(() => {
        console.log('[Service Worker] API cache cleared:', CACHE_NAME);
        if (port) port.postMessage({ type: 'CLEAR_API_CACHE_DONE' });
      })
      .catch((err) => {
        console.warn('[Service Worker] Failed to clear API cache:', err);
        if (port) port.postMessage({ type: 'CLEAR_API_CACHE_DONE' });
      });
  }
});

// Background sync handler
async function handleBackgroundSync(sheetName, apiBaseUrl, port, token) {
  try {
    // Check if main app is already syncing (coordination)
    // For now, we'll just log - proper coordination will be implemented
    console.log('[Service Worker] Background sync requested for:', sheetName);

    // Build snapshot URL
    const url = new URL(apiBaseUrl);
    url.searchParams.set('action', 'snapshot');
    url.searchParams.set('sheet', sheetName);
    if (token) {
      url.searchParams.set('token', token);
    }

    // Fetch snapshot
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const snapshot = await response.json();
    
    // Send result back to main app
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

// Background Sync API (sync) and Periodic Background Sync (periodicsync) are not used.
// Sync is triggered via visibilitychange + SYNC_REQUEST messages from the main app.
// To use them later, wire these listeners to the same handleBackgroundSync flow.

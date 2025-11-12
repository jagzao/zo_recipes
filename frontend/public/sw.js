/**
 * KitchenEye Service Worker (Enhanced)
 * Advanced caching strategies for optimal performance
 * Version: 2.0
 */

const CACHE_VERSION = 'v2';
const STATIC_CACHE = `kitcheneye-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `kitcheneye-dynamic-${CACHE_VERSION}`;
const API_CACHE = `kitcheneye-api-${CACHE_VERSION}`;
const IMAGE_CACHE = `kitcheneye-images-${CACHE_VERSION}`;

// Maximum cache sizes
const MAX_DYNAMIC_CACHE = 50;
const MAX_API_CACHE = 30;
const MAX_IMAGE_CACHE = 60;

// Network timeout (ms)
const NETWORK_TIMEOUT = 5000;

// Assets to precache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/pages.js',
  '/actions.js',
  '/dark-mode.js',
  '/animations.css',
  '/manifest.json',
  '/stores/auth.js',
  '/stores/ui.js',
  '/utils/lazy-images.js',
  '/utils/vitals.js',
];

// ============================================
// INSTALL - Precache static assets
// ============================================

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v2...');

  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Precaching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Installation failed:', error);
      })
  );
});

// ============================================
// ACTIVATE - Clean up old caches
// ============================================

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v2...');

  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE, IMAGE_CACHE];

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => !currentCaches.includes(name))
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activation complete');
        return self.clients.claim();
      })
  );
});

// ============================================
// FETCH - Smart caching strategies
// ============================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Route to appropriate strategy
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request, API_CACHE));
  } else if (isImageRequest(request)) {
    event.respondWith(cacheFirstStrategy(request, IMAGE_CACHE, MAX_IMAGE_CACHE));
  } else if (STATIC_ASSETS.some((asset) => url.pathname === asset)) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
  } else {
    event.respondWith(
      staleWhileRevalidateStrategy(request, DYNAMIC_CACHE, MAX_DYNAMIC_CACHE)
    );
  }
});

// ============================================
// CACHING STRATEGIES
// ============================================

/**
 * Network First Strategy
 * Try network, fallback to cache if offline
 * Best for: API requests, dynamic content
 */
async function networkFirstStrategy(request, cacheName) {
  try {
    // Try network with timeout
    const networkResponse = await fetchWithTimeout(request, NETWORK_TIMEOUT);

    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);

    // Try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline response
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'OFFLINE',
          message: 'No network connection. Please try again later.',
        },
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Cache First Strategy
 * Serve from cache, fallback to network
 * Best for: Static assets, images
 */
async function cacheFirstStrategy(request, cacheName, maxItems) {
  // Try cache first
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  // Fallback to network
  try {
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, networkResponse.clone());

      // Trim cache if needed
      if (maxItems) {
        await trimCache(cacheName, maxItems);
      }
    }

    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache and network failed:', error);

    // Return placeholder for images
    if (isImageRequest(request)) {
      return new Response(
        '<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="300" fill="#f3f4f6"/><text x="50%" y="50%" text-anchor="middle" fill="#9ca3af">Image unavailable</text></svg>',
        { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    }

    throw error;
  }
}

/**
 * Stale While Revalidate Strategy
 * Serve from cache immediately, update cache in background
 * Best for: Frequently updated content
 */
async function staleWhileRevalidateStrategy(request, cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  // Fetch from network in background
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());

      // Trim cache if needed
      if (maxItems) {
        trimCache(cacheName, maxItems);
      }
    }
    return networkResponse;
  });

  // Return cached version immediately if available
  return cachedResponse || fetchPromise;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Fetch with timeout
 */
function fetchWithTimeout(request, timeout) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Network timeout')), timeout)
    ),
  ]);
}

/**
 * Check if request is for an image
 */
function isImageRequest(request) {
  return request.destination === 'image';
}

/**
 * Trim cache to max items
 */
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  if (keys.length > maxItems) {
    // Delete oldest items
    const itemsToDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(itemsToDelete.map((key) => cache.delete(key)));

    console.log(`[SW] Trimmed ${cacheName}: removed ${itemsToDelete.length} items`);
  }
}

// ============================================
// BACKGROUND SYNC
// ============================================

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  console.log('[SW] Syncing data...');
  // TODO: Implement data sync logic
  // This could sync offline changes to the server
}

// ============================================
// PUSH NOTIFICATIONS
// ============================================

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};

  const title = data.title || 'KitchenEye';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    data: data.url || '/',
    actions: data.actions || [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data || '/')
  );
});

// ============================================
// MESSAGES FROM CLIENT
// ============================================

self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CLEAR_CACHE':
      event.waitUntil(clearAllCaches());
      break;

    case 'CACHE_URLS':
      event.waitUntil(cacheUrls(payload));
      break;

    case 'GET_CACHE_SIZE':
      event.waitUntil(getCacheSize().then((size) => {
        event.ports[0].postMessage({ size });
      }));
      break;

    default:
      console.log('[SW] Unknown message type:', type);
  }
});

/**
 * Clear all caches
 */
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));
  console.log('[SW] All caches cleared');
}

/**
 * Cache specific URLs
 */
async function cacheUrls(urls) {
  if (!Array.isArray(urls)) return;

  const cache = await caches.open(DYNAMIC_CACHE);
  await Promise.all(
    urls.map((url) =>
      fetch(url)
        .then((response) => cache.put(url, response))
        .catch((error) => console.error(`[SW] Failed to cache ${url}:`, error))
    )
  );
  console.log(`[SW] Cached ${urls.length} URLs`);
}

/**
 * Get total cache size
 */
async function getCacheSize() {
  if (!('storage' in navigator && 'estimate' in navigator.storage)) {
    return null;
  }

  const estimate = await navigator.storage.estimate();
  return {
    usage: estimate.usage,
    quota: estimate.quota,
    percentage: Math.round((estimate.usage / estimate.quota) * 100),
  };
}

// ============================================
// ERROR HANDLING
// ============================================

self.addEventListener('error', (event) => {
  console.error('[SW] Error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Unhandled rejection:', event.reason);
});

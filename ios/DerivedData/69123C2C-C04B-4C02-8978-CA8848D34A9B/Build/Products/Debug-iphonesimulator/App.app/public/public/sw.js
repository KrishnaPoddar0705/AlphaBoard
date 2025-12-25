// Service Worker for handling SPA routing
// This intercepts requests and serves index.html for routes that don't exist

const CACHE_NAME = 'alphaboard-v1';

// Install event - cache static assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - handle routing
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // For navigation requests (page loads), always serve index.html
  // This ensures React Router can handle all routes
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch('/index.html').catch(() => {
        // Fallback: try to get from cache
        return caches.match('/index.html');
      })
    );
    return;
  }

  // For other requests (assets, API calls), use network first
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request);
    })
  );
});


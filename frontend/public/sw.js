// Tombstone service worker.
//
// The previous worker intercepted every navigation and responded with
// fetch('/index.html') to force SPA routing on Render, which does not serve
// index.html for unknown paths. Cloudflare Pages handles that natively through
// public/_redirects, so the worker is now pure overhead: an extra network
// round-trip on every page load, and a cache that can pin users to a stale
// bundle.
//
// It cannot simply be deleted. A registered service worker lives in the
// browser's storage, not on the server — removing sw.js from the deploy would
// leave the OLD worker installed and running against the new origin forever,
// with no way to reach it. The only way to retire a worker is to ship a new one
// that removes itself, which is what this file does.
//
// Safe to delete this file and the registration block in index.html once
// pre-migration browsers have aged out.

self.addEventListener('install', () => {
  // Replace the outgoing worker immediately rather than waiting for every tab
  // using it to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop everything the old worker cached, including any stale index.html.
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));

      await self.registration.unregister();

      // Reload open tabs so they detach from this worker and load normally.
      // Without this, pages already open keep talking to a worker that is
      // unregistered but still controlling them until navigation.
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.navigate(client.url);
      }
    })()
  );
});

// Deliberately no fetch handler. A worker with no fetch listener is fully
// transparent — requests go straight to the network as if it were not there.

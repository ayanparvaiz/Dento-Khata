// KILL SWITCH — the previous caching service worker served stale UI.
// Browsers always re-check sw.js on navigation, so this replacement installs,
// wipes all caches, unregisters itself, and reloads open tabs to a clean
// network-served app. No fetch handler = everything goes straight to network.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((c) => c.navigate(c.url));
    })(),
  );
});

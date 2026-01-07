// Service Worker for PWA Installation
// Minimal SW - only enables installation and shows offline page when no connection

const CACHE_NAME = 'qr-offline-v1';
const OFFLINE_URL = '/offline.html';

// Install: cache the offline page
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches and take control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: show offline page when navigation fails
self.addEventListener('fetch', (event) => {
  // Only handle navigation requests (page loads)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Network failed, return offline page
          return caches.match(OFFLINE_URL);
        })
    );
  }
});

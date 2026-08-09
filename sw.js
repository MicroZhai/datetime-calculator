const CACHE_NAME = 'dtc-duration-v13-6-20260809';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/duration-calculator.css',
  './css/theme.css',
  './css/date-anchor.css',
  './css/responsive.css',
  './css/display-surface.css',
  './css/keypad-surface.css',
  './css/large-number.css',
  './js/duration-precision.js',
  './js/date-mapper.js',
  './js/history-store.js',
  './js/calculator-state.js',
  './js/duration-core.js',
  './js/duration-ui.js',
  './js/duration-app.js',
  './js/date-anchor.js',
  './js/display-mode.js',
  './js/calculator-state-runtime.js',
  './js/range-guard.js',
  './js/large-number-ui.js',
  './js/theme.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(
        APP_SHELL.map(url => new Request(url, { cache: 'no-cache' }))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function fetchWithRevalidation(request) {
  try {
    const response = await fetch(request, { cache: 'no-cache' });

    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      const cacheKey = request.mode === 'navigate' ? './index.html' : request;
      await cache.put(cacheKey, response.clone());
    }

    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;

    if (request.mode === 'navigate') {
      const shell = await caches.match('./index.html');
      if (shell) return shell;
    }

    throw error;
  }
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(fetchWithRevalidation(event.request));
});

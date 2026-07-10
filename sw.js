const CACHE_NAME = 'pop-reach-v2';

// Base path for GitHub Pages deployment
const BASE = '/POP-reach';

const ASSETS = [
  `${BASE}/index.html`,
  `${BASE}/mobile.html`,
  `${BASE}/desktop.html`,
  `${BASE}/popLOGO.png`,
  `${BASE}/Equip.png`,
  `${BASE}/manifest.json`,
  'https://d3js.org/d3.v7.min.js',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap'
];

// ── Install — cache core assets ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('POP Reach SW: Caching core assets');
      return cache.addAll(ASSETS).catch(err => {
        console.warn('POP Reach SW: Some assets failed to cache', err);
      });
    })
  );
  self.skipWaiting();
});

// ── Activate — clean old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => {
          console.log('POP Reach SW: Deleting old cache', key);
          return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

// ── Fetch — network-first for data, cache-first for app shell ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Network-first for CSV/GeoJSON data
  if (url.pathname.endsWith('.csv') || url.pathname.endsWith('.geojson')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // App shell — stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Background update
        fetch(event.request)
          .then(response => {
            if (response.ok) {
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, response));
            }
          })
          .catch(() => {});
        return cached;
      }

      return fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return new Response(
              `<!DOCTYPE html>
              <html lang="en">
              <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
              <title>Offline — POP Reach</title>
              <style>
                body { font-family: 'DM Sans', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #eceef2; color: #020244; text-align: center; }
                h1 { font-family: 'DM Serif Display', serif; font-size: 24px; }
                p { color: #666; }
              </style></head>
              <body><div><h1>📡 You're offline</h1><p>Please reconnect to load Point of Progress Reach.</p></div></body>
              </html>`,
              { headers: { 'Content-Type': 'text/html' } }
            );
          }
          return new Response('Offline', { status: 503 });
        });
    })
  );
});

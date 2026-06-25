// KUETx Service Worker — offline cache + auto-update
const CACHE_NAME = 'kuetx-v3.4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.svg',
  '/icon-512.svg',
  '/vendor/fullcalendar-fallback.css',
];

const isSameOriginAsset = (request) => {
  const url = new URL(request.url);
  return url.origin === self.location.origin && (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/vendor/')
  );
};

// Install — cache static assets, then wait (skipWaiting called after user confirms)
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  // Don't skipWaiting here — wait for user confirmation via message
});

// Activate — clean ALL old caches, claim clients
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache first for assets, network first for navigation
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith('http')) return;

  const acceptsHtml = e.request.headers.get('accept')?.includes('text/html');
  const isNavigation = e.request.mode === 'navigate' || acceptsHtml;
  const shouldUseCacheFirst =
    isSameOriginAsset(e.request) ||
    e.request.destination === 'style' ||
    e.request.destination === 'script' ||
    e.request.destination === 'image';

  const fetchAndCache = () => fetch(e.request)
    .then(res => {
      if (res && res.status === 200) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      }
      return res;
    });

  e.respondWith(
    (shouldUseCacheFirst
      ? caches.match(e.request).then(cached => cached || fetchAndCache())
      : fetchAndCache()
    )
      .catch(() => caches.match(e.request))
      .then(cached => {
        if (cached) return cached;
        if (isNavigation) {
          return caches.match('/index.html')
            .then(r => r || new Response('Offline', { status: 503 }));
        }
        return new Response('Offline', { status: 503 });
      })
  );
});

// Message handler
self.addEventListener('message', (e) => {
  // User confirmed update → activate new SW
  if (e.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Notify all clients when a new SW is waiting
self.addEventListener('install', () => {
  self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
    clients.forEach(client => client.postMessage({ type: 'SW_WAITING' }));
  });
});

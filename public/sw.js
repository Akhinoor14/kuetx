// KUETx Service Worker — offline cache + auto-update
const CACHE_NAME = 'kuetx-v4.1.9'; // bumped to clear browser and mobile caches — bump this on every future deploy too
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.svg',
  '/icon-512.svg',
  '/vendor/fullcalendar-fallback.css',
];

// Question Bank cache: separate bucket, NOT bumped/cleared alongside
// CACHE_NAME above (QB PDFs/tree-data don't change shape just because the
// app shell got a new deploy) and NOT pre-warmed at install — it only ever
// gets entries the first time someone actually opens a QB PDF or browses
// its tree, matching the "only cache what's actually used" ask. R2 and the
// QB Worker are cross-origin (a different host from the app itself), so
// this can't be identified by a fixed hostname — instead matched by the
// same URL *shape* every deploy's R2 bucket and Worker share.
const QB_CACHE_NAME = 'kuetx-qbank-v1';
const isQuestionBankAsset = (request) => {
  try {
    const url = new URL(request.url);
    if (url.origin === self.location.origin) return false; // handled by the app-shell branch below instead
    // Cloudflare R2 public buckets are always served from *.r2.dev
    if (/\.r2\.dev$/.test(url.hostname)) return true;
    // Cloudflare Workers are always served from *.workers.dev (unless on a
    // custom domain, which isn't in use here per .env.example) — QB's tree-
    // listing worker specifically, so also require the path/host to look
    // question-bank-related to avoid accidentally net-catching some other
    // unrelated Worker this project might add later.
    if (/\.workers\.dev$/.test(url.hostname) && /qb|question-?bank/i.test(url.href)) return true;
    return false;
  } catch {
    return false;
  }
};

const isSameOriginAsset = (request) => {
  const url = new URL(request.url);
  return url.origin === self.location.origin && (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/vendor/')
  );
};

// Install — cache static assets, then wait. skipWaiting is NOT called
// here — index.html's registration script decides when to send
// SKIP_WAITING (see the comment there): as soon as this SW finishes
// installing, automatically, no manual "update available, click to
// refresh" UI. Keeping the trigger in index.html (not here) means the
// activation policy lives in one place instead of being split across
// this file and app code.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// Activate — clean old APP-SHELL caches only. QB_CACHE_NAME is deliberately
// left alone here: it's versioned independently (see comment above), so an
// app-shell deploy bump shouldn't force-redownload every previously-viewed
// QB PDF.
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME && k !== QB_CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache first for assets, network first for navigation
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith('http')) return;

  // Question Bank R2/Worker traffic: its own cache-first branch, own
  // bucket. Falls back to network on a cache miss (first time viewing that
  // particular PDF/tree page) and caches the result for next time — same
  // cache-first shape as the app-shell branch below, just scoped to only
  // ever apply to QB requests instead of every request.
  if (isQuestionBankAsset(e.request)) {
    e.respondWith(
      caches.open(QB_CACHE_NAME).then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(res => {
            if (res && res.status === 200) cache.put(e.request, res.clone());
            return res;
          }).catch(() => cached); // offline + never-viewed-before: nothing to serve, undefined falls through below
        })
      ).catch(() => fetch(e.request))
    );
    return;
  }

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
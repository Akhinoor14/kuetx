const CACHE_NAME = 'kuetx-v4.16.0'; // bugfix bump: install-button dismiss flag was being set on every manual-sheet close (even a normal read-and-close, unrelated to declining install), silently suppressing the button for 14 days including after a real uninstall (see FloatingInstallButton.jsx / useInstallPrompt.js). Also forces this fix past cache-first navigation caching for returning visitors.
const CACHE_NAME = 'kuetx-v4.15.0'; // bumped: install button now detects "already installed, viewing in a plain browser tab" via getInstalledRelatedApps() and shows "Open app" / "Update" instead of staying hidden or offering to reinstall (see useInstallPrompt.js). Previous bump: navigation requests (back/forward, reload, address bar) are now cache-first against the precached app shell instead of network-first-with-fallback — removes the flaky-network window that could serve a mismatched/stale shell on deep routes (see fetch handler comment).
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon-32.png',
  '/favicon-16.png',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/vendor/fullcalendar-fallback.css',
  '/splash/mascot.webp',
  '/splash/gate.webp',
  '/splash/academic.webp',
  '/splash/aerial.webp',
  '/splash/sign.webp',
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
    // BUGFIX (stale QB tree-listing / department counts): the app's own
    // fetch() for the Worker's tree JSON (useQuestionBankData.js) explicitly
    // passes { cache: 'no-store' } to force a fresh listing every load — but
    // that option only governs the *browser's* HTTP cache, it does nothing
    // to stop THIS service worker from intercepting the same request and
    // answering cache-first out of QB_CACHE_NAME instead. Net effect: normal
    // reloads kept re-serving whatever tree JSON (dept counts/order) was
    // cached the first time a client ever hit the Worker, and only a hard
    // reload (which bypasses the SW entirely) ever saw a fresh count. A
    // no-store request is an explicit "don't you dare cache this" signal
    // from the caller, so honor it here and always hit the network for it,
    // same as any other no-store/no-cache request — this endpoint returns
    // JSON (a listing), not a downloadable file, so cache-first was never
    // actually appropriate for it in the first place, only for the PDFs.
    if (request.cache === 'no-store' || request.headers.get('Cache-Control') === 'no-store') {
      return false;
    }
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

  // BUGFIX (back/forward landing on the app root instead of the route
  // that was navigated to): browser navigations (back/forward, address
  // bar, reload) to deep SPA routes like /attendance are never
  // themselves pre-cached under their own URL (only '/' and
  // '/index.html' are in STATIC_ASSETS) — so on ANY network hiccup
  // (common on mobile data), the old network-first path for
  // navigations would fail, miss cache under the exact URL, and only
  // THEN fall back to the cached app shell. That fallback itself never
  // changes window.location — React Router still reads the correct
  // pathname on mount — but a slow/degraded network could keep retrying
  // or momentarily render a mismatched shell before hydration caught
  // up, which is what read as "back always resets to the start".
  // Fix: treat navigation requests as cache-first against the
  // precached shell, same as static assets — removes the network
  // round-trip (and its failure window) from the critical path
  // entirely, and still updates the cache in the background so the
  // shell itself stays fresh for next time.
  const respondToRequest = isNavigation
    ? caches.match('/index.html').then(cached => {
        fetchAndCache().catch(() => {}); // refresh cache in background, ignore failures
        return cached || fetchAndCache();
      })
    : (shouldUseCacheFirst
      ? caches.match(e.request).then(cached => cached || fetchAndCache())
      : fetchAndCache()
    );

  e.respondWith(
    respondToRequest
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
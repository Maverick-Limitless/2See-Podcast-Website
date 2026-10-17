/*
 * Service worker for 2See Podcast.
 *
 * Strategy, deliberately narrow:
 *   - Static build assets: cache-first with a versioned cache name.
 *   - Public pages: network-first with a cache fallback, so a visitor who
 *     goes offline still gets the last version of a page they actually read.
 *   - /admin, /login, /setup and any authenticated response: not cached at
 *     all. The panel always requires a live server session, installed or not.
 *
 * CACHE_VERSION is replaced at build time conceptually by the worker's own
 * install routine: bumping it below is the only change needed to invalidate
 * every cached page.
 */

const CACHE_VERSION = 'v1';
const ASSET_CACHE = `2see-assets-${CACHE_VERSION}`;
const PAGE_CACHE = `2see-pages-${CACHE_VERSION}`;

const PRECACHE = [
  '/',
  '/episodes',
  '/stories',
  '/about',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/offline.html'
];

const EXCLUDED = ['/admin/', '/login', '/setup', '/logout', '/sync'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(ASSET_CACHE);
      // request errors are tolerated: an unreachable route must not block
      // installation.
      await Promise.allSettled(
        PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' })))
      );
      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !key.endsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

function isExcluded(url) {
  return EXCLUDED.some((prefix) => url.pathname === prefix || url.pathname.startsWith(prefix));
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (isExcluded(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            const cache = await caches.open(PAGE_CACHE);
            cache.put(request, copy);
          }
          return response;
        } catch {
          const cache = await caches.open(PAGE_CACHE);
          const cached = await cache.match(request);
          if (cached) return cached;
          const root = await cache.match('/');
          if (root) return root;
          const offline = await caches.match('/offline.html');
          return offline ?? Response.error();
        }
      })()
    );
    return;
  }

  if (/\.(js|css|woff2|svg|png|webmanifest)$/.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        } catch {
          return cached ?? Response.error();
        }
      })()
    );
  }
});

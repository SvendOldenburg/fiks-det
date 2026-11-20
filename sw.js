// App-shell cache. Task data always comes live from PocketBase (cross-origin,
// never cached here). Bump CACHE on any frontend change -- without it,
// returning visitors keep the old shell. (Anvil learned this the hard way:
// its cache sat stale for 3 months across a full data-layer rewrite.)
const CACHE = 'fiksdet-v5';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/config.js',
  './js/api.js',
  './icons/favicon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    // cache: 'reload' skips the browser's HTTP cache (GitHub Pages serves
    // max-age=600), so a new version can't be stored half old, half new.
    caches.open(CACHE)
      .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // PocketBase is cross-origin -- always network, never intercepted here.
  if (url.origin !== self.location.origin) return;

  // App shell: cache first, then network (caching what comes back), then
  // index.html. That last fallback is also what satisfies Chrome's
  // "responds when offline" install criterion.
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit =>
      hit ||
      fetch(e.request).then(resp => {
        if (resp.ok && e.request.method === 'GET') {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match('./index.html'))
    )
  );
});

// Gross Income service worker.
// The page is always fetched from the network first, so a deploy reaches people
// the next time they open the app. The cache is only an offline fallback.
// On a weak signal (bathroom wifi) the page waits at most NAV_TIMEOUT_MS for the network
// before opening the saved copy; the fresh copy still lands in the cache for next time.
// Other origins (Supabase, the CDN) are never touched.
const CACHE = 'gi-v5';
const NAV_TIMEOUT_MS = 4000;
const SHELL = [
  './', 'manifest.webmanifest', 'icons/icon-192.png?v=2', 'icons/apple-touch-icon.png?v=2',
  'fonts/bebas-neue-400.woff2', 'fonts/dm-mono-400.woff2', 'fonts/dm-mono-500.woff2', 'fonts/dm-sans-var.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // All pages share one cache entry, so the offline copy also covers links with a
  // query string (magic links, pool invites).
  const nav = req.mode === 'navigate';
  // Other pages (privacy, stats) go straight to the network. Cloudflare redirects
  // privacy.html to /privacy, and Safari refuses a redirected page from a worker.
  const scope = new URL(self.registration.scope);
  if (nav && url.pathname !== scope.pathname) return;
  const key = nav ? new URL('./', self.registration.scope).href : req;
  const network = fetch(nav ? new Request(url.href, { cache: 'no-cache', credentials: 'same-origin' }) : req)
    .then(res => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(key, copy));
      }
      return res;
    });
  // Keep the worker alive until the network answers, even after the saved copy was used
  e.waitUntil(network.then(() => {}, () => {}));
  const cached = () => caches.match(key).then(hit => hit || Response.error());
  if (!nav) { e.respondWith(network.catch(cached)); return; }

  // Pages: whichever comes first of the network, or the saved copy once the network is slow
  e.respondWith(new Promise(resolve => {
    let done = false;
    const finish = res => { if (!done) { done = true; resolve(res); } };
    const timer = setTimeout(() => caches.match(key).then(hit => { if (hit) finish(hit); }), NAV_TIMEOUT_MS);
    network.then(res => { clearTimeout(timer); finish(res); })
      .catch(() => { clearTimeout(timer); cached().then(finish); });
  }));
});

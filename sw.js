// Gross Income service worker.
// The page is always fetched from the network first, so a deploy reaches people
// the next time they open the app. The cache is only an offline fallback.
// Other origins (Supabase, Google Fonts, the CDN) are never touched.
const CACHE = 'gi-v2';
const SHELL = ['./', 'manifest.webmanifest', 'icons/icon-192.png?v=2', 'icons/apple-touch-icon.png?v=2'];

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
  const key = req.mode === 'navigate' ? new URL('./', self.registration.scope).href : req;
  e.respondWith(
    fetch(req.mode === 'navigate' ? new Request(url.href, { cache: 'no-cache', credentials: 'same-origin' }) : req)
      .then(res => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(key, copy));
        }
        return res;
      })
      .catch(() => caches.match(key).then(hit => hit || Response.error()))
  );
});

/* NoteFlow service worker: lets the app open instantly and without internet once it has been opened/installed.
   - the page itself: network first (so a new version arrives at once), the saved copy when the network is slow or missing
   - status.json, the claim service and every other address: never touched (the access check must always ask the real server) */
const CACHE = 'noteflow-shell-v1';
const SHELL = ['./', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => { })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
function withTimeout(p, ms) { return new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('slow')), ms); p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); }); }); }
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (/status\.json$/.test(url.pathname)) return;
  const isPage = req.mode === 'navigate' || url.pathname === new URL('./', self.registration.scope).pathname || /\.html$/.test(url.pathname);
  if (isPage) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE), key = new URL('./', self.registration.scope).href;
      try {
        const r = await withTimeout(fetch(req), 4000);
        if (r && r.ok && req.mode === 'navigate' && !url.search.includes('_=')) cache.put(key, r.clone());
        return r;
      } catch (err) {
        const hit = await cache.match(key) || await cache.match(req, { ignoreSearch: true });
        if (hit) return hit;
        throw err;
      }
    })());
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});

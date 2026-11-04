/* NoteFlow service worker: lets the app open instantly and without internet once it has been opened/installed.
   - the page itself: the saved copy opens at once while a fresh copy is fetched in the background (the app's own "new version" pill offers it);
     when the address carries ?v= (the person just tapped "update") the network is asked first
   - status.json, the claim service and every other address: never touched (the access check must always ask the real server) */
const CACHE = 'noteflow-shell-v2';
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
      const forceNet = /[?&]v=/.test(url.search);
      const net = fetch(req).then(r => {
        if (r && r.ok && req.mode === 'navigate' && !url.search.includes('_=')) cache.put(key, r.clone());
        return r;
      });
      const hit = await cache.match(key);
      if (hit && !forceNet) { e.waitUntil(net.catch(() => { })); return hit; }   // instant start: never leave the person staring at the launch screen while the network is slow
      try { return await net; }
      catch (err) {
        const old = hit || await cache.match(req, { ignoreSearch: true });
        if (old) return old;
        throw err;
      }
    })());
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});

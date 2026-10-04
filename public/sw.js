// Service worker: asosiy fayllar, teksturalar va rasmlar oflayn ham ishlashi uchun.
// Versiyani o'zgartirsangiz, eski kesh tozalanadi.
const VERSION = 'earth-analogs-v1';
const CORE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/tex/earth-2k.webp',
  '/tex/mars-2k.webp',
  '/tex/moon-2k.webp',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Faqat o'z domenimiz: tashqi tile'lar (Esri, NASA Trek) va /api keshga olinmaydi
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/_vercel/')) return;

  // Sahifa: avval tarmoq, bo'lmasa keshdagi nusxa
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  // Statik fayllar (JS/CSS, rasmlar, teksturalar): avval kesh, keyin tarmoq (va keshga yozish)
  if (/^\/(assets|img|tex|icons)\//.test(url.pathname) || url.pathname.endsWith('.svg') || url.pathname.endsWith('.webmanifest')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});

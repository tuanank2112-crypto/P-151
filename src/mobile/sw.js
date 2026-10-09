// Service worker of the phone app (plan 11, SPEC-P01 §3): caches the app shell only.
// API responses are NEVER cached (00-ARCHITECTURE I-3): data on the phone must always come from the shared DB.
const SHELL_CACHE = 'mo-app-shell-v5';
const SHELL = [
  './',
  'index.html',
  'app.css?v=5',
  'manifest.json',
  'js/main.js?v=5',
  'js/api.js?v=5',
  'js/ui.js?v=5',
  'js/photo.js?v=5',
  'js/resident.js?v=5',
  'js/bql.js?v=5',
  'js/staff.js?v=5',
  'js/dept.js?v=5',
  'js/bptn.js?v=5',
  'js/kho.js?v=5',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('mo-app-shell-') && k !== SHELL_CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return; // straight to the network, never from cache
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    // network first, so a deploy shows up at once; offline → the cached shell
    event.respondWith(fetch(request).catch(() => caches.match('index.html')));
    return;
  }
  event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
});

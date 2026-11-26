/*
 * 离线缓存（Service Worker）
 * - 网页、脚本、样式、字表：优先联网拿最新版，没网或太慢时用缓存
 * - 字体：缓存优先（文件大、很少改）。更换字体时把 FONT_CACHE 版本号加 1
 */
const CORE_CACHE = 'hb-core-v1';
const FONT_CACHE = 'hb-fonts-v1';
const NETWORK_TIMEOUT_MS = 3000;

const CORE_FILES = [
  './',
  'index.html',
  'style.css',
  'hanzilist.csv',
  'js/data.js',
  'js/sound.js',
  'js/questions.js',
  'js/storage.js',
  'js/app.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];
const FONT_FILES = ['fonts/kaiti-subset.woff2'];

self.addEventListener('install', event => {
  event.waitUntil(Promise.all([
    caches.open(CORE_CACHE).then(c => Promise.all(CORE_FILES.map(u =>
      c.add(new Request(u, { cache: 'reload' })).catch(err => console.warn('[sw] 跳过', u, err))
    ))),
    caches.open(FONT_CACHE).then(c => c.addAll(FONT_FILES)).catch(() => {})
  ]).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(k => k.startsWith('hb-') && k !== CORE_CACHE && k !== FONT_CACHE)
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('.woff2')) event.respondWith(cacheFirst(req));
  else event.respondWith(networkFirst(req));
});

async function cacheFirst(req) {
  const cached = await caches.match(req, { ignoreSearch: true });
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) (await caches.open(FONT_CACHE)).put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(CORE_CACHE);
  const network = fetch(req, { cache: 'no-cache' }).then(res => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  });
  const timeout = new Promise(resolve => setTimeout(resolve, NETWORK_TIMEOUT_MS));
  try {
    const res = await Promise.race([network, timeout]);
    if (res) return res;
  } catch (e) { /* 没网，用缓存 */ }
  const cached = await cache.match(req, { ignoreSearch: true });
  if (cached) return cached;
  return network;
}

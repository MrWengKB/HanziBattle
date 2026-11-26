/*
 * 离线缓存（Service Worker）
 * - 网页、脚本、样式、字表：优先联网拿最新版，没网或太慢时用缓存
 * - 字体：缓存优先（文件大、很少改）。更换字体时把 FONT_CACHE 版本号加 1
 */
const CORE_CACHE = 'hb-core-v9';
const FONT_CACHE = 'hb-fonts-v2';
const AUDIO_CACHE = 'hb-audio-v1';   // 读音：第一次用到时下载并缓存
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
  'js/speak.js',
  'js/app.js',
  'manifest.webmanifest',
  'icons/favicon.svg',
  'icons/favicon-16.png',
  'icons/favicon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];
const FONT_FILES = ['fonts/kaiti.ttf'];

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
        .filter(k => k.startsWith('hb-') && k !== CORE_CACHE && k !== FONT_CACHE && k !== AUDIO_CACHE)
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('.ttf')) event.respondWith(cacheFirst(req));
  else if (url.pathname.includes('/audio/')) event.respondWith(audioFirst(url));
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

async function audioFirst(url) {
  const cache = await caches.open(AUDIO_CACHE);
  const key = url.origin + url.pathname;
  const cached = await cache.match(key);
  if (cached) return cached;
  const res = await fetch(key);
  if (res.status === 200) await cache.put(key, res.clone());
  return res;
}

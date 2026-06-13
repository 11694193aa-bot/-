// PWA Service Worker — 纯网络透传，API 调用不受缓存干扰
const CACHE = 'tarot-v1';

// 安装时跳过等待
self.addEventListener('install', () => self.skipWaiting());

// 激活时清理所有旧缓存
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => caches.delete(k))
    )).then(() => clients.claim())
  );
});

// GET 请求全部走网络，不缓存（避免 API /save /list 被缓存）
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request));
});

const CACHE_NAME = 'dtc-v4';

const FILES_TO_CACHE = [
  '.',
  'index.html',
  'css/style.css',
  'js/storage.js',
  'js/history.js',
  'js/calculator.js',
  'js/theme.js',
  'js/ui.js',
  'js/app.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

// 安装：预缓存文件
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

// 激活：清理旧缓存 + 通知所有页面刷新
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => {
      // 通知页面有新版本可用（由用户决定是否更新）
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => client.postMessage('update-available'));
      });
    })
  );
  self.clients.claim();
});

// 请求拦截：网络优先，缓存回退
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request, { cache: 'no-cache' }).then(response => {
      // 网络成功 → 更新缓存 + 返回
      if (response && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, clone);
        });
      }
      return response;
    }).catch(() => {
      // 网络失败 → 返回缓存
      return caches.match(event.request).then(cached => {
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          return caches.match('index.html');
        }
      });
    })
  );
});

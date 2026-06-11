// 自毁：清除所有缓存并注销自己
self.addEventListener('install', () => {
  self.skipWaiting();
});
self.addEventListener('activate', () => {
  caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  self.registration.unregister();
});

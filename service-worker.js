self.addEventListener('install', e => {
  e.waitUntil(
    caches.open('lite-cache').then(cache => {
      return cache.addAll([
        './',
        './index.html',
        './style.css',
        './manifest.json',
      ]);
    })
  );
});
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
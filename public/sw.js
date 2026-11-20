// Service worker: recebe as notificações da fila e abre a senha ao tocar.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data && event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(d.title || 'Na Vez', {
      body: d.body || '',
      tag: d.tag || 'navez',
      renotify: true,
      requireInteraction: /vez!/i.test(d.title || ''),
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [300, 120, 300, 120, 300],
      data: { url: d.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) if (w.url.includes(url) && 'focus' in w) return w.focus();
      return self.clients.openWindow(url);
    })
  );
});

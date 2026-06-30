/* PoreiaGo customer Web Push service worker */

self.addEventListener('push', (event) => {
  let payload = {
    title: 'PoreiaGo',
    body: 'Νέα ενημέρωση κράτησης',
    url: '/wallet',
    tag: 'aerostride',
    data: {},
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body,
    tag: payload.tag || 'aerostride',
    data: {
      url: payload.url || (payload.data?.type === 'driver_shift' ? '/admin' : '/wallet'),
      ...(payload.data || {}),
    },
    icon: payload.data?.type === 'driver_shift' ? '/icons/driver-pwa-192.png' : '/vite.svg',
    badge: '/icons/driver-pwa-192.png',
  };

  event.waitUntil(self.registration.showNotification(payload.title || 'PoreiaGo', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification?.data || {};
  let target = data.url || '/wallet';
  if (data.type === 'driver_shift' && data.tab) {
    target = `/admin?tab=${encodeURIComponent(data.tab)}`;
  }
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(target);
      }
      return undefined;
    }),
  );
});

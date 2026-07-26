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

  const isShift = payload.data?.type === 'driver_shift';
  const isChat = payload.data?.type === 'driver_office_chat';
  const options = {
    body: payload.body,
    tag: payload.tag || 'aerostride',
    renotify: Boolean(isShift || isChat || payload.renotify),
    requireInteraction:
      payload.requireInteraction === true || Boolean(isShift || isChat),
    data: {
      url:
        payload.url ||
        (isChat
          ? '/admin?tab=driver_chat'
          : isShift
            ? '/admin?tab=fleet_live_map'
            : '/wallet'),
      ...(payload.data || {}),
    },
    icon: isShift || isChat ? '/icons/driver-pwa-192.png' : '/vite.svg',
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
  if (data.type === 'driver_office_chat') {
    const driverId = data.driver_id ? `&driverId=${encodeURIComponent(data.driver_id)}` : '';
    target = data.url || `/admin?tab=driver_chat${driverId}`;
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

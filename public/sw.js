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
  const isSos = payload.data?.type === 'sos' || String(payload.data?.alert_type || '').toUpperCase() === 'SOS';
  const isChat = payload.data?.type === 'driver_office_chat';
  const isLost = payload.data?.type === 'lost_item_report';
  const options = {
    body: payload.body,
    tag: payload.tag || 'aerostride',
    renotify: Boolean(isShift || isSos || isChat || isLost || payload.renotify),
    requireInteraction:
      payload.requireInteraction === true || Boolean(isShift || isSos || isChat || isLost),
    data: {
      url:
        payload.url ||
        (isLost
          ? '/admin?tab=lost_found'
          : isChat
            ? '/admin?tab=driver_chat'
            : isShift || isSos
              ? '/admin?tab=fleet_live_map'
              : '/wallet'),
      ...(payload.data || {}),
    },
    icon: isShift || isSos || isChat || isLost ? '/icons/driver-pwa-192.png' : '/vite.svg',
    badge: '/icons/driver-pwa-192.png',
  };

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of clientsList) {
        try {
          client.postMessage({
            type: 'ADMIN_PUSH_RECEIVED',
            payload: {
              title: payload.title,
              body: payload.body,
              tag: payload.tag || options.tag,
              url: options.data?.url || payload.url,
              data: options.data || {},
            },
          });
        } catch {
          /* ignore */
        }
      }
      await self.registration.showNotification(payload.title || 'PoreiaGo', options);
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification?.data || {};
  let target = data.url || '/wallet';
  if (data.type === 'driver_shift' && data.tab) {
    target = `/admin?tab=${encodeURIComponent(data.tab)}`;
  }
  if (data.type === 'sos' || String(data.alert_type || '').toUpperCase() === 'SOS') {
    target = data.url || '/admin?tab=fleet_live_map';
  }
  if (data.type === 'driver_office_chat') {
    const driverId = data.driver_id ? `&driverId=${encodeURIComponent(data.driver_id)}` : '';
    target = data.url || `/admin?tab=driver_chat${driverId}`;
  }
  if (data.type === 'lost_item_report') {
    target = data.url || '/admin?tab=lost_found';
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

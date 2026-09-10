
self.addEventListener('push', (event) => {
  let data = { title: 'Notification title', body: 'Notification body' };

  if (event.data) {
    data = event.data.json();
  }

  const options = {
    body: data.body,
    icon: data.icon || '/favicon.png',
    badge: '/favicon.png',
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
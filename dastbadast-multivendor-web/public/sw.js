// dastbadast-multivendor-web/public/sw.js
//
// ⭐ Шаг 4: Service Worker для Web Push API.
// Слушает событие "push" от браузера, показывает системное уведомление,
// и открывает/фокусирует нужную вкладку по клику.

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      title: "Dastbadast",
      body: event.data ? event.data.text() : "",
    };
  }

  const title = payload.title || "Dastbadast";
  const options = {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const deepLink =
    (event.notification.data && event.notification.data.deepLink) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(deepLink) && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(deepLink);
        }
      }),
  );
});

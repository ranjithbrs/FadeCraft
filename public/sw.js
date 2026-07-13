// Service Worker for Push Notifications
self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  const title = data.title || "MediQ Notification";
  const options = {
    body: data.message || "You have a new notification",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: data.id || "mediq-notification",
    data: {
      url: data.url || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || "/")
  );
});

/* eslint-disable no-undef */
// Firebase Messaging Service Worker
// Handles background push notifications when the tab is inactive or closed.
// Uses compat SDK because service workers don't support ES module imports.

importScripts(
  "https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "AIzaSyDk6kjTUeMQvvuSVqnwEDO-g0WNiiEvX1M",
  authDomain: "dealer-kia.firebaseapp.com",
  projectId: "dealer-kia",
  storageBucket: "dealer-kia.firebasestorage.app",
  messagingSenderId: "139586273307",
  appId: "1:139586273307:web:56a64022b7b3977c2578be",
});

const messaging = firebase.messaging();

// Background message handler — fires when the tab is NOT in focus
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? "KIA Dealer";
  const body = payload.notification?.body ?? "";
  const icon = payload.notification?.icon ?? "/icons/kia-icon.png";

  self.registration.showNotification(title, {
    body,
    icon,
    badge: "/icons/kia-icon.png",
    tag: payload.data?.type ?? "kia-notification",
    data: {
      url: self.location.origin,
      vehicleId: payload.data?.vehicleId ?? "",
      type: payload.data?.type ?? "",
    },
  });
});

// Click handler — open/focus the app when user clicks the notification
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || self.location.origin;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If a tab is already open, focus it
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open a new tab
        return self.clients.openWindow(urlToOpen);
      })
  );
});

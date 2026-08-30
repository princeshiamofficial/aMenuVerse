// aMenuVerse Web Push Service Worker (Standard VAPID Web Push)
// Handles background notifications, custom vibration patterns, badge count, and audio synchronization

const SW_VERSION = "2.2.0";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// 1. Push Event - Triggered when server sends a Web Push payload
self.addEventListener("push", (event) => {
  let data = {
    title: "🔔 aMenuVerse Alert",
    body: "You have a new update.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    url: "/dashboard",
    sound: "chime",
    unreadCount: 1,
    vibrate: [200, 100, 200, 100, 400],
    tag: `amenuverse-${Date.now()}`,
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch {
      data.body = event.data.text() || data.body;
    }
  }

  // A. Update App Icon Badge Count
  try {
    if ("setAppBadge" in navigator && typeof data.unreadCount === "number") {
      navigator.setAppBadge(data.unreadCount).catch(() => {});
    } else if ("setAppBadge" in self.registration && typeof data.unreadCount === "number") {
      self.registration.setAppBadge(data.unreadCount).catch(() => {});
    }
  } catch {
    /* ignore badge failure */
  }

  // B. Notify all active tabs / windows to play the in-browser custom audio chime
  const broadcastPromise = self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clientList) => {
      for (const client of clientList) {
        try {
          client.postMessage({
            type: "PLAY_NOTIFICATION_SOUND",
            sound: data.sound || "chime",
            payload: data,
          });
        } catch {
          /* ignore */
        }
      }
    })
    .catch(() => {});

  // C. Display the OS-level System Notification (Must use PNG/ICO, never SVG)
  const options = {
    body: data.body,
    icon: data.icon && !data.icon.endsWith(".svg") ? data.icon : "/icon-192.png",
    badge: data.badge && !data.badge.endsWith(".svg") ? data.badge : "/icon-192.png",
    vibrate: data.vibrate || [200, 100, 200, 100, 400],
    tag: data.tag || `alert-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    silent: false,
    data: {
      url: data.url || "/dashboard",
      orderId: data.orderId,
      sound: data.sound || "chime",
    },
  };

  const notificationPromise = self.registration
    .showNotification(data.title, options)
    .catch((err) => {
      console.warn("[SW] showNotification warning:", err);
    });

  event.waitUntil(Promise.allSettled([broadcastPromise, notificationPromise]));
});

// 2. Notification Click Event - Direct staff or customer to relevant page
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "close") {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If a window is already open with the application, focus and navigate it
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client) {
              client.navigate(targetUrl);
            }
            return;
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});

// 3. Notification Close Event
self.addEventListener("notificationclose", (event) => {
  // Clear app badge if all notifications are cleared
  if ("clearAppBadge" in navigator) {
    navigator.clearAppBadge().catch(() => {});
  } else if ("clearAppBadge" in self.registration) {
    self.registration.clearAppBadge().catch(() => {});
  }
});

// aMenuVerse Web Push Service Worker (Standard VAPID Web Push)
// Handles background notifications, custom vibration patterns, badge count, and audio synchronization

const SW_VERSION = "2.3.0";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// 1. Push Event - Triggered when server sends a Web Push payload (even when tab/panel is closed)
self.addEventListener("push", (event) => {
  const origin = self.location.origin;
  let data = {
    title: "🔔 MenuVerse Alert",
    body: "You have a new update.",
    icon: `${origin}/icon-192.png`,
    badge: `${origin}/favicon.ico`,
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

  // B. Notify any open tabs / windows to play the in-browser custom audio chime
  self.clients
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

  // C. Display the OS-level System Notification (Absolute HTTPS URL for background rendering)
  const title = data.title || "🔔 MenuVerse Alert";
  const iconUrl =
    data.icon && (data.icon.startsWith("http://") || data.icon.startsWith("https://"))
      ? data.icon
      : `${origin}/icon-192.png`;
  const badgeUrl =
    data.badge && (data.badge.startsWith("http://") || data.badge.startsWith("https://"))
      ? data.badge
      : `${origin}/favicon.ico`;

  const options = {
    body: data.body || "New update received",
    icon: iconUrl,
    badge: badgeUrl,
    vibrate: data.vibrate || [200, 100, 200, 100, 400],
    tag: data.tag || `alert-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.url || "/dashboard",
      orderId: data.orderId,
      sound: data.sound || "chime",
    },
  };

  // Crucial: event.waitUntil guarantees background OS notification is shown even when panel is closed
  event.waitUntil(self.registration.showNotification(title, options));
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

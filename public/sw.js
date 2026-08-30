// aMenuVerse Web Push Service Worker (Standard VAPID Web Push)
// Handles background notifications, custom vibration patterns, badge count, and audio synchronization

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
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    url: "/orders",
    sound: "chime",
    unreadCount: 1,
    vibrate: [200, 100, 200, 100, 400],
    tag: "amenuverse-notification",
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch {
      data.body = event.data.text() || data.body;
    }
  }

  // A. Update App Icon Badge Count (Windows Taskbar, macOS Dock, Android Icons)
  if ("setAppBadge" in navigator && typeof data.unreadCount === "number") {
    navigator.setAppBadge(data.unreadCount).catch(() => {});
  } else if ("setAppBadge" in self.registration && typeof data.unreadCount === "number") {
    self.registration.setAppBadge(data.unreadCount).catch(() => {});
  }

  // B. Notify all active tabs / windows to play the in-browser custom audio chime
  const broadcastPromise = self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clientList) => {
      for (const client of clientList) {
        client.postMessage({
          type: "PLAY_NOTIFICATION_SOUND",
          sound: data.sound || "chime",
          payload: data,
        });
      }
    });

  // C. Display the OS-level System Notification
  const options = {
    body: data.body,
    icon: data.icon || "/favicon.ico",
    badge: data.badge || "/favicon.ico",
    vibrate: data.vibrate || [200, 100, 200, 100, 400],
    tag: data.tag || `alert-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.url || "/orders",
      orderId: data.orderId,
      sound: data.sound || "chime",
    },
    actions: [
      { action: "open", title: "👀 View Details" },
      { action: "close", title: "Dismiss" },
    ],
  };

  const notificationPromise = self.registration.showNotification(data.title, options);

  event.waitUntil(Promise.all([broadcastPromise, notificationPromise]));
});

// 2. Notification Click Event - Direct staff or customer to relevant page
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "close") {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || "/orders";

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
            } else {
              client.postMessage({ type: "NAVIGATE_TO", url: targetUrl });
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

// 3. Client Message Listener (e.g., clear badge when order is opened)
self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "CLEAR_APP_BADGE") {
    if ("clearAppBadge" in navigator) {
      navigator.clearAppBadge().catch(() => {});
    } else if ("clearAppBadge" in self.registration) {
      self.registration.clearAppBadge().catch(() => {});
    }
  } else if (event.data.type === "SET_APP_BADGE" && typeof event.data.count === "number") {
    if ("setAppBadge" in navigator) {
      navigator.setAppBadge(event.data.count).catch(() => {});
    } else if ("setAppBadge" in self.registration) {
      self.registration.setAppBadge(event.data.count).catch(() => {});
    }
  }
});

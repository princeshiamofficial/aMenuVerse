/**
 * Client-Side Self-Hosted Web Push Notification Service
 * - Standard VAPID Web Push (RFC 8030 / RFC 8292)
 * - Zero third-party dependencies / Zero paid SaaS SDKs
 * - Built-in High-Fidelity Web Audio Sound Engine (Chimes, Kitchen Bells, POS Cash Dings)
 * - Badging API support (Windows Taskbar, macOS Dock, Android app icon badge count)
 */

import { toast } from "sonner";

export type SoundType = "chime" | "kitchen-bell" | "cash-register" | "ping" | "urgent";

/**
 * Converts a base64 string to a Uint8Array for VAPID applicationServerKey
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

let globalAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!globalAudioCtx || globalAudioCtx.state === "closed") {
      globalAudioCtx = new AudioContextClass();
    }
    if (globalAudioCtx.state === "suspended") {
      globalAudioCtx.resume().catch(() => {});
    }
    return globalAudioCtx;
  } catch {
    return null;
  }
}

// Auto-unlock audio on first user interaction
if (typeof window !== "undefined") {
  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    window.removeEventListener("click", unlock);
    window.removeEventListener("touchstart", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("click", unlock, { passive: true });
  window.addEventListener("touchstart", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });
}

/**
 * Synthesizes high-fidelity custom chime and alert tones via native Web Audio API with audio fallback
 */
export function playNotificationSound(type: SoundType | string = "chime") {
  if (typeof window === "undefined") return;

  try {
    const ctx = getAudioContext();
    if (!ctx) {
      const audio = new Audio("/sound.wav");
      audio.volume = 0.8;
      audio.play().catch(() => {});
      return;
    }

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    if (type === "kitchen-bell" || type === "bell") {
      // 🛎️ Rich Kitchen Bell / Dining Bell
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, now); // A5
      osc1.frequency.exponentialRampToValueAtTime(440, now + 1.2);

      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(1760, now); // Overtones
      osc2.frequency.exponentialRampToValueAtTime(880, now + 0.8);

      gain.gain.setValueAtTime(0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.2);
      osc2.stop(now + 1.2);
    } else if (type === "cash-register" || type === "cash") {
      // 💵 POS Cash Register Ding
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6

      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.7);
    } else if (type === "urgent") {
      // 🚨 Dual-tone Urgent alert
      [0, 0.15, 0.3].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(1046.5, now + delay); // C6
        gain.gain.setValueAtTime(0.35, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.12);
      });
    } else {
      // 🎵 Clean melodious Chime (Default)
      const freqs = [587.33, 880, 1174.66]; // D5, A5, D6 chord
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        gain.gain.setValueAtTime(0.45, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.8);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.8);
      });
    }
  } catch (err) {
    console.warn("[WebAudio Alert]", err);
    try {
      const audio = new Audio("/sound.wav");
      audio.volume = 0.8;
      audio.play().catch(() => {});
    } catch {
      /* ignore */
    }
  }
}

/**
 * Checks if Service Worker and Push Notifications are supported in current browser
 */
export function isPushNotificationSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/**
 * Registers the Service Worker (`/sw.js`)
 */
export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushNotificationSupported()) return null;

  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.warn("[Push Service Worker Registration Failed]", err);
    return null;
  }
}

/**
 * Subscribes current device / browser to Web Push Notifications
 */
export async function subscribeToPushNotifications(options: {
  restaurantId: number | string;
  branchId?: string | null;
  userId?: string | null;
  role?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  if (!isPushNotificationSupported()) {
    return { success: false, error: "Push notifications are not supported in this browser." };
  }

  try {
    // 1. Request Notification Permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { success: false, error: "Notification permission was denied or dismissed." };
    }

    // 2. Ensure Service Worker is registered
    const reg = await registerPushServiceWorker();
    if (!reg) {
      return { success: false, error: "Could not register push service worker." };
    }

    // 3. Get VAPID Public Key
    const vapidPublicKey =
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
      "BFCWjOYUAdv3FqiTopV07F48-nmqk7g-NJkkd-1ZU4XVwhXSXirasbeJpi8qEMIj50WKQ6h8lay1wOGKWxuGhjM";

    // 4. Subscribe with PushManager
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
    let subscription = await reg.pushManager.getSubscription();

    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as unknown as BufferSource,
      });
    }

    const subJson = subscription.toJSON();
    if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
      return { success: false, error: "Invalid push subscription object received." };
    }

    // 5. Send subscription to our Next.js backend server
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId: options.restaurantId,
        branchId: options.branchId || null,
        userId: options.userId || null,
        role: options.role || null,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
        userAgent: navigator.userAgent,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { success: false, error: errData.error || "Failed to persist push subscription on server." };
    }

    return { success: true };
  } catch (err: unknown) {
    console.error("[Push Subscription Error]", err);
    return { success: false, error: (err as Error).message || "Unknown error occurred during subscription." };
  }
}

/**
 * Unsubscribes from Web Push
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!isPushNotificationSupported()) return false;

  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      // Notify backend to remove subscription
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      }).catch(() => {});
    }
    return true;
  } catch (err) {
    console.warn("[Push Unsubscribe Error]", err);
    return false;
  }
}

/**
 * Attaches the message listener to play custom chimes & handle badge synchronization
 */
export function setupPushNotificationListener() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return () => {};

  const handler = (event: MessageEvent) => {
    if (event.data?.type === "PLAY_NOTIFICATION_SOUND") {
      playNotificationSound(event.data.sound || "chime");

      if (event.data.payload) {
        const p = event.data.payload;
        toast(p.title || "🔔 New Notification", {
          description: p.body,
          duration: 6000,
          action: p.url
            ? {
                label: "View",
                onClick: () => {
                  if (typeof window !== "undefined") {
                    window.location.href = p.url;
                  }
                },
              }
            : undefined,
        });
      }
    }
  };

  navigator.serviceWorker.addEventListener("message", handler);

  return () => {
    navigator.serviceWorker.removeEventListener("message", handler);
  };
}

/**
 * Sets the numerical badge count on the app icon
 */
export function updateAppBadge(count: number) {
  if (typeof navigator !== "undefined" && "setAppBadge" in navigator) {
    if (count > 0) {
      navigator.setAppBadge(count).catch(() => {});
    } else {
      navigator.clearAppBadge().catch(() => {});
    }
  }
}

import { useEffect, useRef, useState } from "react";
import type { RealtimeEvent, RealtimeEventType } from "./realtime.server";

// Persistent singleton AudioContext and decoded sound buffer cache
let sharedAudioCtx: AudioContext | null = null;
let soundWavBuffer: AudioBuffer | null = null;

function getSharedAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudioCtx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

// Pre-load and decode sound.wav into Web Audio buffer for instant zero-latency background tab playback
async function loadSoundWavBuffer() {
  if (typeof window === "undefined" || soundWavBuffer) return;
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    const response = await fetch("/sound.wav");
    if (!response.ok) return;
    const arrayBuffer = await response.arrayBuffer();
    soundWavBuffer = await ctx.decodeAudioData(arrayBuffer);
  } catch {
    /* ignore fetch/decode errors */
  }
}

// Eagerly pre-load sound.wav buffer on module import
if (typeof window !== "undefined") {
  setTimeout(() => {
    loadSoundWavBuffer();
  }, 100);
}

export function requestNotificationPermission() {
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }
}

export function triggerDesktopNotification(title: string, body?: string) {
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted" && document.hidden) {
      try {
        new Notification(title, {
          body,
          icon: "/favicon.ico",
        });
      } catch {
        /* ignore */
      }
    }
  }
}

// Global user gesture listener to permanently unlock audio in browser engine
export function unlockAudioEngine() {
  if (typeof window === "undefined") return;
  const ctx = getSharedAudioContext();
  if (ctx) {
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  }
  loadSoundWavBuffer();
  requestNotificationPermission();
}

let originalTabTitle = "";
let tabTitleFlashInterval: NodeJS.Timeout | null = null;
let flashTimeout: NodeJS.Timeout | null = null;

// Attach auto-unlock listener on first user click/tap/keydown anywhere on window
if (typeof window !== "undefined") {
  const unlockEvents = ["click", "pointerdown", "keydown", "touchstart", "mousemove"];
  const handleUserGesture = () => {
    unlockAudioEngine();
    if (tabTitleFlashInterval && originalTabTitle) {
      clearInterval(tabTitleFlashInterval);
      tabTitleFlashInterval = null;
      if (flashTimeout) clearTimeout(flashTimeout);
      document.title = originalTabTitle;
    }
  };
  unlockEvents.forEach((evt) =>
    window.addEventListener(evt, handleUserGesture, { passive: true }),
  );

  // Restore title when user returns to tab
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && originalTabTitle) {
      if (tabTitleFlashInterval) clearInterval(tabTitleFlashInterval);
      if (flashTimeout) clearTimeout(flashTimeout);
      tabTitleFlashInterval = null;
      document.title = originalTabTitle;
    }
  });
}

export function flashTabTitle(message: string, durationMs = 15000) {
  if (typeof document === "undefined") return;
  if (!originalTabTitle || originalTabTitle.startsWith("🔔") || originalTabTitle.startsWith("🚨")) {
    const raw = document.title || "aMenuVerse";
    originalTabTitle = raw.replace(/^🔔.*?\|\s*/, "").replace(/^🚨.*?\|\s*/, "") || "aMenuVerse";
  }
  if (tabTitleFlashInterval) clearInterval(tabTitleFlashInterval);
  if (flashTimeout) clearTimeout(flashTimeout);

  let isFlashed = true;
  document.title = message;

  tabTitleFlashInterval = setInterval(() => {
    document.title = isFlashed ? message : originalTabTitle;
    isFlashed = !isFlashed;
  }, 1000);

  flashTimeout = setTimeout(() => {
    if (tabTitleFlashInterval) {
      clearInterval(tabTitleFlashInterval);
      tabTitleFlashInterval = null;
    }
    if (originalTabTitle) {
      document.title = originalTabTitle;
    }
  }, durationMs);
}

let lastChimeTime = 0;

/**
 * Plays order alert audio using sound.wav with Web Audio buffer fallback.
 */
export function playChime(type: "order" | "waiter" | "success" | "alert" = "order") {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastChimeTime < 1000) return;
  lastChimeTime = now;

  // 1. Flash tab title & trigger native desktop notification
  if (type === "order") {
    flashTabTitle("🔔 (1) NEW ORDER!");
    triggerDesktopNotification("🔔 New Order Received!", "A new order was placed by a customer.");
  } else if (type === "waiter") {
    flashTabTitle("🚨 WAITER CALLED!");
    triggerDesktopNotification("🚨 Waiter Called!", "A guest requested table service.");
  }

  // 2. Play Audio via HTML5 Audio element
  try {
    const audio = new Audio("/sound.wav");
    audio.volume = 1.0;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        playSynthesizedChime(type);
      });
    }
  } catch {
    playSynthesizedChime(type);
  }

  // 3. Parallel synthesized multi-tone Web Audio chime for guaranteed audibility
  playSynthesizedChime(type);
}

/**
 * Synthesizes pure Web Audio chimes as a 100% reliable fallback.
 */
export function playSynthesizedChime(type: "order" | "waiter" | "success" | "alert" = "order") {
  if (typeof window === "undefined") return;
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    if (type === "order") {
      // 3-tone pleasant crisp POS bell (C5 523Hz -> G5 784Hz -> C6 1046Hz)
      const t = ctx.currentTime;
      [
        { freq: 523.25, offset: 0, dur: 0.25, vol: 0.4 },
        { freq: 783.99, offset: 0.12, dur: 0.3, vol: 0.45 },
        { freq: 1046.5, offset: 0.25, dur: 0.6, vol: 0.5 },
      ].forEach(({ freq, offset, dur, vol }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t + offset);
        gain.gain.setValueAtTime(vol, t + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, t + offset + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t + offset);
        osc.stop(t + offset + dur);
      });
    } else if (type === "waiter") {
      // Triple urgent ringtone: E5, G5, C6
      const t = ctx.currentTime;
      [
        { freq: 659.25, offset: 0, dur: 0.15 },
        { freq: 783.99, offset: 0.15, dur: 0.15 },
        { freq: 1046.5, offset: 0.3, dur: 0.4 },
      ].forEach(({ freq, offset, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, t + offset);
        gain.gain.setValueAtTime(0.4, t + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, t + offset + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t + offset);
        osc.stop(t + offset + dur);
      });
    } else if (type === "success") {
      // Two-tone rising chime
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, t); // D5
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.18); // A5
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.35);
    }
  } catch {
    /* ignore audio synthesis issues */
  }
}



export interface UseRealtimeOptions {
  restaurantId?: string | number;
  branchId?: string | null;
  eventTypes?: RealtimeEventType[];
  onEvent?: (event: RealtimeEvent) => void;
  enabled?: boolean;
}

export function useRealtime({
  restaurantId,
  branchId,
  eventTypes,
  onEvent,
  enabled = true,
}: UseRealtimeOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const eventTypesKey = eventTypes ? eventTypes.join(",") : "";

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let retryDelay = 1000;
    let isCleanedUp = false;

    function connect() {
      if (isCleanedUp) return;

      const params = new URLSearchParams();
      if (restaurantId) params.set("restaurantId", String(restaurantId));
      if (branchId && branchId !== "all") params.set("branchId", String(branchId));

      const queryStr = params.toString();
      const url = `/api/realtime${queryStr ? `?${queryStr}` : ""}`;

      try {
        eventSource = new EventSource(url);

        eventSource.onopen = () => {
          setIsConnected(true);
          retryDelay = 1000;
        };

        eventSource.onerror = () => {
          setIsConnected(false);
          eventSource?.close();
          if (!isCleanedUp) {
            reconnectTimeout = setTimeout(() => {
              retryDelay = Math.min(retryDelay * 1.5, 10000);
              connect();
            }, retryDelay);
          }
        };

        const targetTypes: RealtimeEventType[] =
          eventTypesKey.length > 0
            ? (eventTypesKey.split(",") as RealtimeEventType[])
            : [
                "order:created",
                "order:updated",
                "order:deleted",
                "waiter:called",
                "waiter:resolved",
                "reservation:created",
                "table:updated",
                "announcement:created",
              ];

        targetTypes.forEach((type) => {
          eventSource?.addEventListener(type, (e: MessageEvent) => {
            try {
              const event: RealtimeEvent = JSON.parse(e.data);
              onEventRef.current?.(event);
            } catch (err) {
              console.warn("[Realtime] Failed to parse event:", err);
            }
          });
        });

        eventSource.addEventListener("connected", () => {
          setIsConnected(true);
        });

        eventSource.addEventListener("ping", () => {
          setIsConnected(true);
        });
      } catch {
        setIsConnected(false);
      }
    }

    connect();

    return () => {
      isCleanedUp = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) {
        eventSource.close();
      }
      setIsConnected(false);
    };
  }, [restaurantId, branchId, enabled, eventTypesKey]);

  return { isConnected };
}

"use client";

import React, { useState, useEffect } from "react";
import { Bell, BellOff, Volume2, Sparkles, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  isPushNotificationSupported,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  playNotificationSound,
  setupPushNotificationListener,
  updateAppBadge,
  type SoundType,
} from "@/lib/push-notifications";
import { toast } from "sonner";

interface PushNotificationManagerProps {
  restaurantId?: number | string;
  branchId?: string | null;
  userId?: string | null;
  role?: string | null;
  compact?: boolean;
}

export function PushNotificationManager({
  restaurantId = 1,
  branchId,
  userId,
  role,
  compact = false,
}: PushNotificationManagerProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const supported = isPushNotificationSupported();
    setIsSupported(supported);

    if (supported && typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
      if (Notification.permission === "granted" && "serviceWorker" in navigator) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.pushManager.getSubscription().then((sub) => {
            setIsSubscribed(!!sub);
          });
        });
      }
    }

    // Attach sound listener for incoming web push broadcasts
    const unsubscribeListener = setupPushNotificationListener();
    return () => {
      unsubscribeListener();
    };
  }, []);

  const handleToggleSubscribe = async () => {
    if (!isSupported) {
      toast.error("Push notifications are not supported in this browser.");
      return;
    }

    setIsLoading(true);
    try {
      if (isSubscribed) {
        const ok = await unsubscribeFromPushNotifications();
        if (ok) {
          setIsSubscribed(false);
          toast.success("Push notifications disabled for this device.");
        }
      } else {
        const result = await subscribeToPushNotifications({
          restaurantId,
          branchId,
          userId,
          role,
        });

        if (result.success) {
          setIsSubscribed(true);
          setPermission("granted");
          playNotificationSound("chime");
          toast.success("🔔 Push notifications enabled! You will receive live alerts with sound.");
        } else {
          toast.error(result.error || "Failed to enable notifications.");
        }
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || "An error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlaySound = (sound: SoundType) => {
    playNotificationSound(sound);
    toast.info(`Playing ${sound} sound`, { duration: 1500 });
  };

  const handleSendTestPush = async (sound: SoundType = "kitchen-bell") => {
    try {
      playNotificationSound(sound);
      updateAppBadge(1);

      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          branchId,
          sound,
          title: "🛎️ Kitchen Order #1024 (Table 04)",
          message: "2x Gourmet Double Smash Burgers, 1x Truffle Pizza ($28.50)",
          unreadCount: 1,
        }),
      });

      if (res.ok) {
        toast.success("Test push notification dispatched with sound & badge!");
      } else {
        toast.info("Sound played in browser. (Enable push notifications to test background OS banner)");
      }
    } catch {
      toast.info("Playing chime alert in browser.");
    }
  };

  if (!isSupported) {
    return null;
  }

  if (compact) {
    return (
      <Button
        variant={isSubscribed ? "secondary" : "outline"}
        size="sm"
        disabled={isLoading}
        onClick={handleToggleSubscribe}
        className="gap-2 text-xs h-8 rounded-lg transition-all"
        title={isSubscribed ? "Push notifications active" : "Enable push notifications"}
      >
        {isSubscribed ? (
          <>
            <Bell className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Alerts ON</span>
          </>
        ) : (
          <>
            <BellOff className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Enable Alerts</span>
          </>
        )}
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-semibold text-sm flex items-center gap-2">
              Self-Hosted Web Push Notifications
              {isSubscribed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> Active
                </span>
              )}
            </h4>
            <p className="text-xs text-muted-foreground">
              Direct VAPID notifications • Custom sound chimes • Badge count • 100% Free
            </p>
          </div>
        </div>

        <Button
          onClick={handleToggleSubscribe}
          disabled={isLoading}
          variant={isSubscribed ? "outline" : "default"}
          className="gap-2"
        >
          {isSubscribed ? (
            <>
              <BellOff className="h-4 w-4" /> Disable Alerts
            </>
          ) : (
            <>
              <Bell className="h-4 w-4" /> Enable Device Push
            </>
          )}
        </Button>
      </div>

      <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Volume2 className="h-3.5 w-3.5" /> Test Custom Sounds:
          </span>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 text-xs px-2.5 rounded-lg"
            onClick={() => handlePlaySound("kitchen-bell")}
          >
            🛎️ Kitchen Bell
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 text-xs px-2.5 rounded-lg"
            onClick={() => handlePlaySound("cash-register")}
          >
            💵 POS Cash Ding
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 text-xs px-2.5 rounded-lg"
            onClick={() => handlePlaySound("chime")}
          >
            🎵 Melodic Chime
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 text-xs px-2.5 rounded-lg"
            onClick={() => handlePlaySound("urgent")}
          >
            🚨 Urgent Alert
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
          onClick={() => handleSendTestPush("kitchen-bell")}
        >
          <Sparkles className="h-3.5 w-3.5" /> Send Test Push
        </Button>
      </div>
    </div>
  );
}

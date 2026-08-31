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
import { Switch } from "@/components/ui/switch";
import {
  getRestaurantPushStatusServer,
  toggleRestaurantPushStatusServer,
} from "@/lib/db-queries.server";
import { toast } from "sonner";

interface PushNotificationManagerProps {
  restaurantId?: number | string;
  branchId?: string | null;
  userId?: string | null;
  role?: string | null;
  compact?: boolean;
  showAdminToggle?: boolean;
}

export function PushNotificationManager({
  restaurantId = 1,
  branchId,
  userId,
  role,
  compact = false,
  showAdminToggle = true,
}: PushNotificationManagerProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [serverPushEnabled, setServerPushEnabled] = useState<boolean>(true);
  const [globalPushEnabled, setGlobalPushEnabled] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isTogglingAdmin, setIsTogglingAdmin] = useState(false);

  const loadServerStatus = async () => {
    try {
      const res = await getRestaurantPushStatusServer({ data: { restaurantId } });
      if (res) {
        setServerPushEnabled(res.enabled);
        setGlobalPushEnabled(res.globalEnabled);
      }
    } catch {
      /* ignore */
    }
  };

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

    loadServerStatus();

    // Attach sound listener for incoming web push broadcasts
    const unsubscribeListener = setupPushNotificationListener();
    return () => {
      unsubscribeListener();
    };
  }, [restaurantId]);

  const handleToggleAdminStatus = async (enabled: boolean) => {
    setIsTogglingAdmin(true);
    try {
      const res = await toggleRestaurantPushStatusServer({
        data: { restaurantId, enabled },
      });
      if (res.success) {
        setServerPushEnabled(enabled);
        toast.success(
          enabled
            ? "🟢 Web Push Notifications enabled for this restaurant."
            : "🔴 Web Push Notifications disabled for this restaurant.",
        );
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to update restaurant push setting.");
    } finally {
      setIsTogglingAdmin(false);
    }
  };

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
      {/* Platform / Restaurant Pause Warning */}
      {(!globalPushEnabled || !serverPushEnabled) && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              {!globalPushEnabled
                ? "Web push notifications are temporarily paused platform-wide by the Super Admin."
                : "Web push notifications are currently disabled for this restaurant."}
            </span>
          </div>
          {showAdminToggle && globalPushEnabled && (
            <Button
              size="sm"
              variant="outline"
              disabled={isTogglingAdmin}
              onClick={() => handleToggleAdminStatus(true)}
              className="h-6 text-[11px] px-2 rounded-md border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
            >
              Re-Enable Now
            </Button>
          )}
        </div>
      )}

      {/* Admin Restaurant-Level Push Toggle Row */}
      {showAdminToggle && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-muted/40 border border-border/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">
                Restaurant Push Service:
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  serverPushEnabled
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                }`}
              >
                {serverPushEnabled ? "🟢 Active" : "🔴 Muted"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Allow staff and dine-in guests to receive live web push alerts for this restaurant.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">
              {serverPushEnabled ? "Enabled" : "Disabled"}
            </span>
            <Switch
              checked={serverPushEnabled}
              disabled={isTogglingAdmin}
              onCheckedChange={handleToggleAdminStatus}
              className="data-[state=checked]:bg-emerald-600"
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-semibold text-sm flex items-center gap-2">
              Device Push Notifications & Audio Alerts
              {isSubscribed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> Subscribed
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

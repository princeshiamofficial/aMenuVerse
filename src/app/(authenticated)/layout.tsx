"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { getCurrentUser, getRestaurantProfile } from "@/lib/db-queries.server";
import type { AuthenticatedUser } from "@/lib/auth.server";
import { DashboardShell } from "@/components/menuverse/dashboard-shell";
import { useRealtime, playChime } from "@/lib/use-realtime";
import { SkeletonDashboard } from "@/components/menuverse/skeletons";
import { setupPushNotificationListener } from "@/lib/push-notifications";

const PAGE_TITLE_MAP: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/restaurant-profile": "Restaurant Profile",
  "/food-items": "Food Items",
  "/categories": "Categories",
  "/orders": "Orders",
  "/pos": "POS Billing",
  "/reservations": "Reservations",
  "/branches": "Branches",
  "/staff": "Staff Management",
  "/kitchen": "Kitchen Display",
  "/waiter-panel": "Waiter Panel",
  "/promotions": "Promotions",
  "/subscription": "Subscription",
  "/analytics": "Analytics",
  "/settings": "Settings",
  "/menu-ai": "Menu AI",
  "/feedback": "Customer Feedback",
};

function GlobalRealtimeNotifier({
  restaurantId,
  branch,
  role,
}: {
  restaurantId?: string | number | null;
  branch?: string | null;
  role?: string | null;
}) {
  const userRole = (role || "").toLowerCase().trim();
  const isGuestOrCustomer = userRole === "customer" || userRole === "guest";

  useRealtime({
    restaurantId: restaurantId ? String(restaurantId) : undefined,
    branchId: branch && branch !== "all" ? String(branch) : undefined,
    enabled: !isGuestOrCustomer,
    onEvent: (event) => {
      if (event.type === "order:created") {
        playChime("order");
        const payload = event.payload as Record<string, unknown>;
        const orderNum = payload?.number ? `#${payload.number}` : "New Order";
        const customerName = (payload?.customerName as string) || "Guest";

        toast.success(`🔔 New Order Received! ${orderNum}`, {
          description: `Customer: ${customerName}`,
          duration: 7000,
        });

        // Trigger native system notification if permission is granted
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          try {
            navigator.serviceWorker.ready.then((reg) => {
              reg.showNotification(`🔔 New Order! ${orderNum}`, {
                body: `Customer: ${customerName}`,
                icon: "/favicon.ico",
                badge: "/favicon.ico",
                tag: `order-${payload?.id || Date.now()}`,
                data: { url: "/orders" },
              });
            }).catch(() => {
              new Notification(`🔔 New Order! ${orderNum}`, {
                body: `Customer: ${customerName}`,
                icon: "/favicon.ico",
              });
            });
          } catch {
            /* ignore */
          }
        }
      } else if (event.type === "waiter:called") {
        playChime("waiter");
        const payload = event.payload as Record<string, unknown>;
        const tableNum = payload?.tableNumber ? `Table ${payload.tableNumber}` : "A table";

        toast.warning(`🚨 Waiter Call! ${tableNum}`, {
          description: "Guest needs assistance",
          duration: 7000,
        });

        // Trigger native system notification if permission is granted
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          try {
            navigator.serviceWorker.ready.then((reg) => {
              reg.showNotification(`🚨 Waiter Call! ${tableNum}`, {
                body: "Guest needs assistance",
                icon: "/placeholder.svg",
                badge: "/placeholder.svg",
                tag: `waiter-${payload?.id || Date.now()}`,
                data: { url: "/waiter-panel" },
              });
            }).catch(() => {
              new Notification(`🚨 Waiter Call! ${tableNum}`, {
                body: "Guest needs assistance",
                icon: "/placeholder.svg",
              });
            });
          } catch {
            /* ignore */
          }
        }
      } else if (event.type === "announcement:created") {
        const payload = event.payload as Record<string, unknown>;
        const sound = (payload?.sound as string) || "chime";
        import("@/lib/push-notifications").then((m) => {
          m.playNotificationSound(sound as any);
        });

        toast.info(`📢 ${(payload?.title as string) || "Announcement"}`, {
          description: (payload?.body as string) || "New system announcement published",
          duration: 9000,
        });

        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          try {
            navigator.serviceWorker.ready.then((reg) => {
              reg.showNotification(`📢 ${(payload?.title as string) || "Announcement"}`, {
                body: (payload?.body as string) || "New system update",
                icon: "/placeholder.svg",
                badge: "/placeholder.svg",
                tag: `announcement-${payload?.id || Date.now()}`,
                data: { url: (payload?.url as string) || "/dashboard" },
              });
            }).catch(() => {
              new Notification(`📢 ${(payload?.title as string) || "Announcement"}`, {
                body: (payload?.body as string) || "New system update",
                icon: "/placeholder.svg",
              });
            });
          } catch {
            /* ignore */
          }
        }
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("menuverse:realtime-event", { detail: event }));
      }
    },
  });

  useEffect(() => {
    const unsub = setupPushNotificationListener();

    // Auto-subscribe if notification permission is already granted
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted" &&
      restaurantId
    ) {
      import("@/lib/push-notifications").then((m) => {
        m.subscribeToPushNotifications({
          restaurantId,
          branchId: branch || null,
          role: role || null,
        }).catch(() => {});
      });
    }

    return () => unsub();
  }, [restaurantId, branch, role]);

  return null;
}

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || "/dashboard";
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [restaurantName, setRestaurantName] = useState<string>("MenuVerse");

  useEffect(() => {
    let isMounted = true;
    async function initAuth() {
      try {
        let token: string | undefined;
        if (typeof window !== "undefined") {
          token = localStorage.getItem("menuverse_session") || undefined;
        }
        const user = await getCurrentUser({ data: { token } });
        if (!isMounted) return;

        if (!user) {
          router.replace("/auth");
          return;
        }

        // RBAC path restrictions
        const role = (user.role || "").toLowerCase().trim().replace(/ /g, "_");
        const isOwnerOrSuperAdmin =
          role === "owner" || role === "super_admin" || role === "superadmin";
        const isAdminOnlyRoute =
          pathname.startsWith("/restaurant-profile") ||
          pathname.startsWith("/branches") ||
          pathname.startsWith("/categories") ||
          pathname.startsWith("/food-items") ||
          pathname.startsWith("/subscription");

        if (isAdminOnlyRoute && !isOwnerOrSuperAdmin) {
          if (role === "waiter") {
            router.replace("/waiter-panel");
            return;
          }
          if (role === "chef") {
            router.replace("/kitchen");
            return;
          }
          if (role === "cashier") {
            router.replace("/dashboard");
            return;
          }
          if (role === "host") {
            router.replace("/reservations");
            return;
          }
          router.replace("/dashboard");
          return;
        }

        if (role === "waiter" && !pathname.startsWith("/waiter-panel")) {
          router.replace("/waiter-panel");
          return;
        }
        if (
          role === "chef" &&
          !pathname.startsWith("/kitchen") &&
          !pathname.startsWith("/orders")
        ) {
          router.replace("/kitchen");
          return;
        }
        if (
          role === "cashier" &&
          !pathname.startsWith("/dashboard") &&
          !pathname.startsWith("/pos") &&
          !pathname.startsWith("/orders") &&
          !pathname.startsWith("/reservations") &&
          !pathname.startsWith("/waiter-panel")
        ) {
          router.replace("/pos");
          return;
        }
        if (role === "host" && !pathname.startsWith("/reservations")) {
          router.replace("/reservations");
          return;
        }

        setCurrentUser(user);
        setLoading(false);
      } catch {
        if (isMounted) {
          router.replace("/auth");
        }
      }
    }

    initAuth();
    return () => {
      isMounted = false;
    };
  }, [pathname, router]);

  useEffect(() => {
    async function loadRestaurantName() {
      try {
        const profile = await getRestaurantProfile();
        if (profile?.name?.trim()) {
          setRestaurantName(profile.name.trim());
        }
      } catch {
        /* ignore */
      }
    }
    loadRestaurantName();

    const handleProfileUpdate = (e: Event) => {
      const customEv = e as CustomEvent<{ name?: string }>;
      if (customEv.detail?.name?.trim()) {
        setRestaurantName(customEv.detail.name.trim());
      }
    };
    window.addEventListener("menuverse:profile-updated", handleProfileUpdate);
    return () => {
      window.removeEventListener("menuverse:profile-updated", handleProfileUpdate);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const pageTitle =
      PAGE_TITLE_MAP[pathname] ||
      pathname
        .replace(/^\//, "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()) ||
      "Dashboard";

    document.title = `${pageTitle} | ${restaurantName}`;
  }, [pathname, restaurantName]);

  if (loading || !currentUser) {
    return <SkeletonDashboard />;
  }

  return (
    <DashboardShell
      userId={currentUser?.id ?? ""}
      userName={currentUser?.full_name ?? ""}
      userEmail={currentUser?.email ?? ""}
      userAvatarUrl={currentUser?.avatar_url ?? null}
      userRole={currentUser?.role ?? "Owner"}
      userBranch={currentUser?.branch ?? null}
    >
      <GlobalRealtimeNotifier
        restaurantId={currentUser?.restaurant_id}
        branch={currentUser?.branch}
        role={currentUser?.role}
      />
      {children}
    </DashboardShell>
  );
}
